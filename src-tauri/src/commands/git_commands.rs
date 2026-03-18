use crate::git::{self, GitStatusResult};
use crate::git::watcher::GitWatcher;
use crate::session::manager::SessionManager;
use crate::session::SessionType;
use std::sync::Mutex;

#[tauri::command]
pub async fn git_status(
    state: tauri::State<'_, SessionManager>,
    watcher: tauri::State<'_, Mutex<GitWatcher>>,
    app: tauri::AppHandle,
    session_id: String,
    cwd: String,
) -> Result<GitStatusResult, String> {
    let (session_type, connection_id) = state.get_session_info(&session_id).await?;

    let result = match session_type {
        SessionType::Local => git::local::status(&cwd),
        SessionType::Wsl => git::wsl::status(&cwd),
        SessionType::Ssh => {
            let conn_id = connection_id.ok_or("no connection_id for SSH session")?;
            git::ssh::status(&state, &conn_id, &cwd).await
        }
    }?;

    // Start file watcher for local sessions if this is a git repo
    if result.is_git_repo && matches!(session_type, SessionType::Local) {
        let git_dir = std::path::PathBuf::from(&cwd).join(".git");
        if git_dir.exists() {
            if let Ok(mut w) = watcher.lock() {
                w.watch(git_dir, app);
            }
        }
    }

    Ok(result)
}

#[tauri::command]
pub async fn git_diff(
    state: tauri::State<'_, SessionManager>,
    session_id: String,
    cwd: String,
    file: String,
    staged: bool,
) -> Result<String, String> {
    let (session_type, connection_id) = state.get_session_info(&session_id).await?;

    match session_type {
        SessionType::Local => git::local::diff(&cwd, &file, staged),
        SessionType::Wsl => git::wsl::diff(&cwd, &file, staged),
        SessionType::Ssh => {
            let conn_id = connection_id.ok_or("no connection_id for SSH session")?;
            git::ssh::diff(&state, &conn_id, &cwd, &file, staged).await
        }
    }
}
