use std::collections::HashMap;
use std::sync::Arc;

use tauri::AppHandle;
use tokio::sync::Mutex;
use uuid::Uuid;

use super::local_session::LocalSession;
use super::ssh_pool::SshConnectionPool;
use super::ssh_session::SshSession;
use super::wsl_ssh_setup::{self, WslSshInfo};
use super::Session;

const MAX_SESSIONS: usize = 64;

pub struct SessionManager {
    sessions: Mutex<HashMap<String, Box<dyn Session>>>,
    ssh_pool: Mutex<SshConnectionPool>,
    pub wsl_distros_cache: std::sync::OnceLock<Vec<String>>,
    wsl_ssh_cache: Mutex<HashMap<String, WslSshInfo>>,
}

#[derive(serde::Serialize)]
pub struct SessionCreateResult {
    #[serde(rename = "sessionId")]
    pub session_id: String,
    #[serde(rename = "connectionId", skip_serializing_if = "Option::is_none")]
    pub connection_id: Option<String>,
}

impl SessionManager {
    pub fn new() -> Self {
        Self {
            sessions: Mutex::new(HashMap::new()),
            ssh_pool: Mutex::new(SshConnectionPool::new()),
            wsl_distros_cache: std::sync::OnceLock::new(),
            wsl_ssh_cache: Mutex::new(HashMap::new()),
        }
    }

    pub async fn create_local(
        &self,
        app: AppHandle,
        cwd: String,
        cols: u16,
        rows: u16,
        shell_program: Option<String>,
        shell_args: Option<Vec<String>>,
    ) -> Result<SessionCreateResult, String> {
        {
            let sessions = self.sessions.lock().await;
            if sessions.len() >= MAX_SESSIONS {
                return Err(format!("session limit reached ({MAX_SESSIONS})"));
            }
        }
        let session_id = Uuid::new_v4().to_string();
        let session =
            LocalSession::create(app, session_id.clone(), &cwd, cols, rows, shell_program, shell_args)?;
        self.sessions
            .lock()
            .await
            .insert(session_id.clone(), Box::new(session));
        Ok(SessionCreateResult {
            session_id,
            connection_id: None,
        })
    }

    pub async fn create_ssh(
        &self,
        app: AppHandle,
        host: String,
        port: u16,
        username: String,
        identity_file: Option<String>,
        cols: u16,
        rows: u16,
    ) -> Result<SessionCreateResult, String> {
        {
            let sessions = self.sessions.lock().await;
            if sessions.len() >= MAX_SESSIONS {
                return Err(format!("session limit reached ({MAX_SESSIONS})"));
            }
        }
        let resolved_key = identity_file.or_else(find_default_ssh_key)
            .ok_or_else(|| "{\"code\":\"PASSWORD_REQUIRED\"}".to_string())?;
        let session_id = Uuid::new_v4().to_string();

        let connection_id = {
            let mut pool = self.ssh_pool.lock().await;
            pool.connect_with_key(&host, port, &username, &resolved_key, None).await?
        };

        // Clone Arc<Handle> and release pool lock BEFORE network I/O in SshSession::create.
        let handle = {
            let pool = self.ssh_pool.lock().await;
            let conn = pool.get(&connection_id).ok_or("connection lost")?;
            Arc::clone(&conn.handle)
        };

        let session =
            SshSession::create(app, session_id.clone(), &*handle, cols, rows)
                .await?;

        {
            let mut pool = self.ssh_pool.lock().await;
            if let Some(conn) = pool.get_mut(&connection_id) {
                conn.session_ids.push(session_id.clone());
            }
        }
        self.sessions
            .lock()
            .await
            .insert(session_id.clone(), Box::new(session));
        Ok(SessionCreateResult {
            session_id,
            connection_id: Some(connection_id),
        })
    }

    pub async fn create_ssh_with_password(
        &self,
        app: AppHandle,
        host: String,
        port: u16,
        username: String,
        password: String,
        cols: u16,
        rows: u16,
    ) -> Result<SessionCreateResult, String> {
        {
            let sessions = self.sessions.lock().await;
            if sessions.len() >= MAX_SESSIONS {
                return Err(format!("session limit reached ({MAX_SESSIONS})"));
            }
        }
        let session_id = Uuid::new_v4().to_string();

        let connection_id = {
            let mut pool = self.ssh_pool.lock().await;
            pool.connect_with_password(&host, port, &username, &password).await?
        };

        // Clone Arc<Handle> and release pool lock BEFORE network I/O in SshSession::create.
        let handle = {
            let pool = self.ssh_pool.lock().await;
            let conn = pool.get(&connection_id).ok_or("connection lost")?;
            Arc::clone(&conn.handle)
        };

        let session =
            SshSession::create(app, session_id.clone(), &*handle, cols, rows)
                .await?;

        {
            let mut pool = self.ssh_pool.lock().await;
            if let Some(conn) = pool.get_mut(&connection_id) {
                conn.session_ids.push(session_id.clone());
            }
        }
        self.sessions
            .lock()
            .await
            .insert(session_id.clone(), Box::new(session));
        Ok(SessionCreateResult {
            session_id,
            connection_id: Some(connection_id),
        })
    }

    pub async fn create_wsl_ssh(
        &self,
        app: AppHandle,
        distro: String,
        cols: u16,
        rows: u16,
        sudo_password: Option<String>,
    ) -> Result<SessionCreateResult, String> {
        {
            let sessions = self.sessions.lock().await;
            if sessions.len() >= MAX_SESSIONS {
                return Err(format!("session limit reached ({MAX_SESSIONS})"));
            }
        }

        // Setup sshd — check cache first (fast path), then release lock for blocking setup
        let info = {
            let cached = {
                let cache = self.wsl_ssh_cache.lock().await;
                cache.get(&distro).cloned()
            };
            if let Some(info) = cached {
                info
            } else {
                let info = tokio::task::spawn_blocking({
                    let distro = distro.clone();
                    move || wsl_ssh_setup::ensure_sshd(&distro, sudo_password.as_deref())
                })
                .await
                .map_err(|e| format!("wsl setup task failed: {e}"))??;
                let mut cache = self.wsl_ssh_cache.lock().await;
                cache.insert(distro.clone(), info.clone());
                info
            }
        };

        let known_hosts = wsl_ssh_setup::wsl_known_hosts_path()?;
        let session_id = Uuid::new_v4().to_string();

        // Connect via SSH — retry up to 3 times on connection refused (sshd may still be starting)
        let connection_id = {
            let mut last_err = String::new();
            let mut connected = None;
            for attempt in 0..3 {
                if attempt > 0 {
                    tokio::time::sleep(std::time::Duration::from_secs(1)).await;
                }
                let mut pool = self.ssh_pool.lock().await;
                match pool.connect_with_key(
                    "127.0.0.1", info.port, &info.username, &info.key_path,
                    Some(known_hosts.as_path()),
                ).await {
                    Ok(id) => { connected = Some(id); break; }
                    Err(e) if e.contains("connection") || e.contains("refused") => {
                        last_err = e;
                        continue;
                    }
                    Err(e) => return Err(e),
                }
            }
            match connected {
                Some(id) => id,
                None => {
                    // All retries failed — invalidate cache so next attempt re-runs ensure_sshd
                    self.wsl_ssh_cache.lock().await.remove(&distro);
                    return Err(last_err);
                }
            }
        };

        let handle = {
            let pool = self.ssh_pool.lock().await;
            let conn = pool.get(&connection_id).ok_or("connection lost")?;
            Arc::clone(&conn.handle)
        };

        let session = SshSession::create(
            app,
            session_id.clone(),
            &*handle,
            cols,
            rows,
        ).await?;

        {
            let mut pool = self.ssh_pool.lock().await;
            if let Some(conn) = pool.get_mut(&connection_id) {
                conn.session_ids.push(session_id.clone());
            }
        }
        self.sessions
            .lock()
            .await
            .insert(session_id.clone(), Box::new(session));

        Ok(SessionCreateResult {
            session_id,
            connection_id: Some(connection_id),
        })
    }

    pub async fn write(&self, session_id: &str, data: &[u8]) -> Result<(), String> {
        let sessions = self.sessions.lock().await;
        sessions
            .get(session_id)
            .ok_or_else(|| format!("session not found: {session_id}"))?
            .write(data)
            .await
    }

    pub async fn resize(&self, session_id: &str, cols: u16, rows: u16) -> Result<(), String> {
        let sessions = self.sessions.lock().await;
        sessions
            .get(session_id)
            .ok_or_else(|| format!("session not found: {session_id}"))?
            .resize(cols, rows)
            .await
    }

    pub async fn kill(&self, session_id: &str) -> Result<(), String> {
        if let Some(session) = self.sessions.lock().await.remove(session_id) {
            session.kill().await?;
        }
        Ok(())
    }

    pub async fn kill_all(&self) {
        let mut sessions = self.sessions.lock().await;
        for (_, session) in sessions.drain() {
            let _ = session.kill().await;
        }
        // Clean up WSL sshd processes
        let mut wsl_cache = self.wsl_ssh_cache.lock().await;
        for (distro, info) in wsl_cache.drain() {
            if let Some(pid) = info.sshd_pid {
                wsl_ssh_setup::kill_sshd(&distro, pid);
            }
        }
        let mut pool = self.ssh_pool.lock().await;
        pool.disconnect_all().await;
    }

}

/// Scan standard SSH key locations and return the first one that exists.
/// On Windows: checks %USERPROFILE%\.ssh\ (e.g. C:\Users\user\.ssh\id_ed25519)
fn find_default_ssh_key() -> Option<String> {
    let home = dirs::home_dir()?;
    let ssh_dir = home.join(".ssh");

    const DEFAULT_KEYS: &[&str] = &[
        "id_ed25519",
        "id_rsa",
        "id_ecdsa",
        "id_dsa",
    ];

    for name in DEFAULT_KEYS {
        let path = ssh_dir.join(name);
        if path.is_file() {
            return Some(path.to_string_lossy().into_owned());
        }
    }

    // Windows: also check ProgramData\ssh\ (system-wide OpenSSH keys)
    #[cfg(target_os = "windows")]
    if let Ok(program_data) = std::env::var("ProgramData") {
        let sys_ssh_dir = std::path::PathBuf::from(program_data).join("ssh");
        for name in DEFAULT_KEYS {
            let path = sys_ssh_dir.join(name);
            if path.is_file() {
                return Some(path.to_string_lossy().into_owned());
            }
        }
    }

    None
}
