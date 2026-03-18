pub mod local_session;
pub mod manager;
pub mod ssh_pool;
pub mod ssh_session;

use async_trait::async_trait;

/// Distinguishes session types for CWD resolution routing.
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "lowercase")]
pub enum SessionType {
    Local,
    Wsl,
    Ssh,
}

/// Unified session interface for local PTY and SSH shell sessions.
#[async_trait]
pub trait Session: Send + Sync {
    async fn write(&self, data: &[u8]) -> Result<(), String>;
    async fn resize(&self, cols: u16, rows: u16) -> Result<(), String>;
    async fn kill(&self) -> Result<(), String>;
    fn session_type(&self) -> SessionType;
    fn connection_id(&self) -> Option<String> {
        None
    }
}
