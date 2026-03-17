use std::collections::HashMap;
use std::sync::Arc;

use tauri::AppHandle;
use tokio::sync::Mutex;
use uuid::Uuid;

use super::local_session::LocalSession;
use super::ssh_pool::SshConnectionPool;
use super::ssh_session::SshSession;
use super::Session;

const MAX_SESSIONS: usize = 64;

pub struct SessionManager {
    sessions: Mutex<HashMap<String, Box<dyn Session>>>,
    ssh_pool: Mutex<SshConnectionPool>,
    pub wsl_distros_cache: std::sync::OnceLock<Vec<String>>,
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
        let identity_file =
            identity_file.ok_or_else(|| "{\"code\":\"PASSWORD_REQUIRED\"}".to_string())?;
        let session_id = Uuid::new_v4().to_string();

        let connection_id = {
            let mut pool = self.ssh_pool.lock().await;
            pool.connect_with_key(&host, port, &username, &identity_file).await?
        };

        // Clone Arc<Handle> and release pool lock BEFORE network I/O in SshSession::create.
        let handle = {
            let pool = self.ssh_pool.lock().await;
            let conn = pool.get(&connection_id).ok_or("connection lost")?;
            Arc::clone(&conn.handle)
        };

        let session =
            SshSession::create(app, session_id.clone(), connection_id.clone(), &*handle, cols, rows)
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
            SshSession::create(app, session_id.clone(), connection_id.clone(), &*handle, cols, rows)
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
        let mut pool = self.ssh_pool.lock().await;
        pool.disconnect_all().await;
    }
}
