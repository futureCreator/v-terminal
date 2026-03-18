use crate::session::manager::SessionManager;
use crate::session::SessionType;
use crate::claude::claude_md;
use crate::claude::cwd_resolver::{self, CwdResult};
use crate::claude::ClaudeMdFile;
use crate::claude::usage;
use crate::claude::UsageData;

#[tauri::command]
pub async fn get_session_cwd(
    state: tauri::State<'_, SessionManager>,
    session_id: String,
) -> Result<CwdResult, String> {
    cwd_resolver::resolve_cwd(&state, &session_id).await
}

#[tauri::command]
pub async fn discover_claude_md(
    state: tauri::State<'_, SessionManager>,
    session_id: String,
    cwd: String,
) -> Result<Vec<ClaudeMdFile>, String> {
    let (session_type, connection_id) = state.get_session_info(&session_id).await?;

    match session_type {
        SessionType::Local | SessionType::Wsl => {
            claude_md::discover_local(&cwd)
        }
        SessionType::Ssh => {
            let conn_id = connection_id.ok_or("no connection_id for SSH session")?;
            let sftp = state.open_sftp(&conn_id).await?;
            let home = ".".to_string(); // TODO: resolve home via SFTP canonicalize
            claude_md::discover_sftp(&sftp, &cwd, &home).await
        }
    }
}

#[tauri::command]
pub async fn read_claude_md(
    state: tauri::State<'_, SessionManager>,
    session_id: String,
    path: String,
) -> Result<String, String> {
    let (session_type, _connection_id) = state.get_session_info(&session_id).await?;

    match session_type {
        SessionType::Local | SessionType::Wsl => {
            let file = claude_md::read_local(&path)?;
            Ok(file.content)
        }
        SessionType::Ssh => {
            // TODO: Implement SFTP read
            Err(format!("SFTP read not yet implemented for: {path}"))
        }
    }
}

#[tauri::command]
pub async fn get_usage(
    state: tauri::State<'_, SessionManager>,
    session_id: String,
) -> Result<UsageData, String> {
    let (session_type, connection_id) = state.get_session_info(&session_id).await?;

    match session_type {
        SessionType::Local | SessionType::Wsl => {
            usage::read_local_usage()
        }
        SessionType::Ssh => {
            let conn_id = connection_id.ok_or("no connection_id for SSH session")?;
            let sftp = state.open_sftp(&conn_id).await?;
            let home = ".".to_string();
            usage::read_sftp_usage(&sftp, &home).await
        }
    }
}

#[tauri::command]
pub async fn write_claude_md(
    state: tauri::State<'_, SessionManager>,
    session_id: String,
    path: String,
    content: String,
    expected_mtime: Option<u64>,
) -> Result<(), String> {
    let (session_type, connection_id) = state.get_session_info(&session_id).await?;

    match session_type {
        SessionType::Local | SessionType::Wsl => {
            claude_md::write_local(&path, &content, expected_mtime)
        }
        SessionType::Ssh => {
            let conn_id = connection_id.ok_or("no connection_id for SSH session")?;
            let sftp = state.open_sftp(&conn_id).await?;
            claude_md::write_sftp(&sftp, &path, &content, expected_mtime).await
        }
    }
}
