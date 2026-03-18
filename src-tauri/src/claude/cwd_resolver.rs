use crate::session::SessionType;
use crate::session::manager::SessionManager;

/// Result of CWD resolution.
#[derive(Debug, serde::Serialize)]
#[serde(tag = "type", content = "value", rename_all = "camelCase")]
pub enum CwdResult {
    Resolved(String),
    Pending,
}

/// Resolves the current working directory for a given session.
pub async fn resolve_cwd(
    manager: &SessionManager,
    session_id: &str,
) -> Result<CwdResult, String> {
    let (session_type, _connection_id) = manager.get_session_info(session_id).await?;

    match session_type {
        SessionType::Local => resolve_local_cwd(manager, session_id).await,
        SessionType::Wsl | SessionType::Ssh => {
            trigger_pty_cwd_injection(manager, session_id).await
        }
    }
}

/// Trigger PTY injection to get CWD from WSL or SSH session.
async fn trigger_pty_cwd_injection(
    manager: &SessionManager,
    session_id: &str,
) -> Result<CwdResult, String> {
    let cmd = b" echo -e \"\\x1b]7337;cwd;$(pwd)\\x07\"\r";
    manager.write(session_id, cmd).await?;
    Ok(CwdResult::Pending)
}

#[cfg(windows)]
async fn resolve_local_cwd(
    _manager: &SessionManager,
    _session_id: &str,
) -> Result<CwdResult, String> {
    // TODO: Windows CWD detection via NtQueryInformationProcess
    // Fall back to PTY injection for now
    Err("local CWD detection not yet implemented on Windows".to_string())
}

#[cfg(not(windows))]
async fn resolve_local_cwd(
    manager: &SessionManager,
    session_id: &str,
) -> Result<CwdResult, String> {
    // On macOS/Linux dev, use PTY injection as fallback
    trigger_pty_cwd_injection(manager, session_id).await
}
