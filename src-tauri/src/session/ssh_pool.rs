use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;

use async_trait::async_trait;
use russh::client;
use russh_keys::known_hosts::learn_known_hosts_path;
use russh_keys::PublicKey;
use uuid::Uuid;

#[derive(Debug, Clone)]
#[allow(dead_code)]
pub enum ConnectionStatus {
    Connecting,
    Connected,
    Disconnected(String),
}

pub struct SshConnection {
    pub handle: Arc<client::Handle<SshClientHandler>>,
    pub profile_key: (String, u16, String),
    pub status: ConnectionStatus,
    pub session_ids: Vec<String>,
}

pub struct SshConnectionPool {
    connections: HashMap<String, SshConnection>,
}

impl SshConnectionPool {
    pub fn new() -> Self {
        Self {
            connections: HashMap::new(),
        }
    }

    pub fn find_connection(&self, host: &str, port: u16, username: &str) -> Option<&str> {
        for (id, conn) in &self.connections {
            if conn.profile_key == (host.to_string(), port, username.to_string()) {
                if matches!(conn.status, ConnectionStatus::Connected) {
                    return Some(id.as_str());
                }
            }
        }
        None
    }

    pub async fn connect_with_key(
        &mut self,
        host: &str,
        port: u16,
        username: &str,
        identity_file: &str,
    ) -> Result<String, String> {
        if let Some(id) = self.find_connection(host, port, username) {
            return Ok(id.to_string());
        }
        let connection_id = Uuid::new_v4().to_string();
        let handle = do_ssh_connect(host, port, username, Some(identity_file), None).await?;
        self.connections.insert(
            connection_id.clone(),
            SshConnection {
                handle: Arc::new(handle),
                profile_key: (host.to_string(), port, username.to_string()),
                status: ConnectionStatus::Connected,
                session_ids: Vec::new(),
            },
        );
        Ok(connection_id)
    }

    pub async fn connect_with_password(
        &mut self,
        host: &str,
        port: u16,
        username: &str,
        password: &str,
    ) -> Result<String, String> {
        if let Some(id) = self.find_connection(host, port, username) {
            return Ok(id.to_string());
        }
        let connection_id = Uuid::new_v4().to_string();
        let handle = do_ssh_connect(host, port, username, None, Some(password)).await?;
        self.connections.insert(
            connection_id.clone(),
            SshConnection {
                handle: Arc::new(handle),
                profile_key: (host.to_string(), port, username.to_string()),
                status: ConnectionStatus::Connected,
                session_ids: Vec::new(),
            },
        );
        Ok(connection_id)
    }

    pub fn get_mut(&mut self, id: &str) -> Option<&mut SshConnection> {
        self.connections.get_mut(id)
    }

    pub fn get(&self, id: &str) -> Option<&SshConnection> {
        self.connections.get(id)
    }

    #[allow(dead_code)]
    pub fn mark_disconnected(&mut self, id: &str, reason: String) {
        if let Some(conn) = self.connections.get_mut(id) {
            conn.status = ConnectionStatus::Disconnected(reason);
        }
    }

    pub async fn disconnect_all(&mut self) {
        for (_, conn) in self.connections.drain() {
            let _ = conn
                .handle
                .disconnect(russh::Disconnect::ByApplication, "", "en")
                .await;
        }
    }

    pub async fn open_sftp(
        &mut self,
        connection_id: &str,
    ) -> Result<russh_sftp::client::SftpSession, String> {
        let conn = self
            .connections
            .get_mut(connection_id)
            .ok_or_else(|| format!("connection not found: {connection_id}"))?;
        let channel = conn
            .handle
            .channel_open_session()
            .await
            .map_err(|e| format!("channel open failed: {e}"))?;
        channel
            .request_subsystem(true, "sftp")
            .await
            .map_err(|e| format!("sftp subsystem request failed: {e}"))?;
        let sftp = russh_sftp::client::SftpSession::new(channel.into_stream())
            .await
            .map_err(|e| format!("sftp session init failed: {e}"))?;
        Ok(sftp)
    }

    pub async fn exec_command(
        &mut self,
        connection_id: &str,
        command: &str,
    ) -> Result<(String, String, u32), String> {
        let conn = self.connections.get_mut(connection_id)
            .ok_or_else(|| format!("connection not found: {connection_id}"))?;

        let mut channel = conn.handle.channel_open_session().await
            .map_err(|e| format!("Failed to open exec channel: {e}"))?;

        channel.exec(true, command.as_bytes()).await
            .map_err(|e| format!("Failed to exec command: {e}"))?;

        let mut stdout = Vec::new();
        let mut stderr = Vec::new();
        let mut exit_code: u32 = 0;

        loop {
            match channel.wait().await {
                Some(russh::ChannelMsg::Data { data }) => {
                    stdout.extend_from_slice(&data);
                }
                Some(russh::ChannelMsg::ExtendedData { data, ext }) => {
                    if ext == 1 { // stderr
                        stderr.extend_from_slice(&data);
                    }
                }
                Some(russh::ChannelMsg::ExitStatus { exit_status }) => {
                    exit_code = exit_status;
                }
                Some(russh::ChannelMsg::Eof) => {
                    // Continue reading; ExitStatus may arrive after EOF
                }
                None => break,
                _ => {}
            }
        }

        let stdout_str = String::from_utf8_lossy(&stdout).to_string();
        let stderr_str = String::from_utf8_lossy(&stderr).to_string();
        Ok((stdout_str, stderr_str, exit_code))
    }
}

async fn do_ssh_connect(
    host: &str,
    port: u16,
    username: &str,
    identity_file: Option<&str>,
    password: Option<&str>,
) -> Result<client::Handle<SshClientHandler>, String> {
    let config = Arc::new(client::Config {
        inactivity_timeout: Some(std::time::Duration::from_secs(30)),
        keepalive_interval: Some(std::time::Duration::from_secs(15)),
        keepalive_max: 3,
        ..Default::default()
    });
    let handler = SshClientHandler {
        known_hosts_path: known_hosts_path(),
        host: host.to_string(),
        port,
    };
    let addr = format!("{host}:{port}");

    let mut handle = tokio::time::timeout(
        std::time::Duration::from_secs(10),
        client::connect(config, &addr, handler),
    )
    .await
    .map_err(|_| format!("connection timed out: {addr}"))?
    .map_err(|e| format!("connection failed: {e}"))?;

    if let Some(key_path) = identity_file {
        let key_path = expand_tilde(key_path);
        let key_pair = russh_keys::load_secret_key(&key_path, None)
            .map_err(|e| format!("failed to load key {}: {e}", key_path.display()))?;
        let auth_result = handle
            .authenticate_publickey(username, Arc::new(key_pair))
            .await
            .map_err(|e| format!("key auth failed: {e}"))?;
        if !auth_result {
            return Err(
                "{\"code\":\"AUTH_FAILED\",\"message\":\"public key rejected by server\"}"
                    .to_string(),
            );
        }
    } else if let Some(pwd) = password {
        let auth_result = handle
            .authenticate_password(username, pwd)
            .await
            .map_err(|e| format!("password auth failed: {e}"))?;
        if !auth_result {
            return Err(
                "{\"code\":\"AUTH_FAILED\",\"message\":\"password rejected by server\"}"
                    .to_string(),
            );
        }
    } else {
        return Err("{\"code\":\"PASSWORD_REQUIRED\"}".to_string());
    }
    Ok(handle)
}

pub struct SshClientHandler {
    known_hosts_path: PathBuf,
    host: String,
    port: u16,
}

#[async_trait]
impl client::Handler for SshClientHandler {
    type Error = russh::Error;

    async fn check_server_key(
        &mut self,
        server_public_key: &PublicKey,
    ) -> Result<bool, Self::Error> {
        match russh_keys::check_known_hosts_path(
            &self.host,
            self.port,
            server_public_key,
            &self.known_hosts_path,
        ) {
            Ok(true) => Ok(true),
            Ok(false) => Ok(false),
            Err(_) => {
                if let Some(parent) = self.known_hosts_path.parent() {
                    let _ = std::fs::create_dir_all(parent);
                }
                let _ = learn_known_hosts_path(
                    &self.host,
                    self.port,
                    server_public_key,
                    &self.known_hosts_path,
                );
                Ok(true)
            }
        }
    }
}

fn known_hosts_path() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".vterminal")
        .join("known_hosts")
}

fn expand_tilde(path: &str) -> PathBuf {
    if path.starts_with("~/") || path == "~" {
        if let Some(home) = dirs::home_dir() {
            return home.join(&path[2..]);
        }
    }
    PathBuf::from(path)
}
