pub mod local_session;
pub mod manager;
pub mod ssh_pool;
pub mod ssh_session;
pub mod wsl_ssh_setup;

use async_trait::async_trait;

/// Unified session interface for local PTY and SSH shell sessions.
#[async_trait]
pub trait Session: Send + Sync {
    async fn write(&self, data: &[u8]) -> Result<(), String>;
    async fn resize(&self, cols: u16, rows: u16) -> Result<(), String>;
    async fn kill(&self) -> Result<(), String>;
}
