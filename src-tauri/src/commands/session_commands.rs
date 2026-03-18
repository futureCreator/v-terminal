use serde::Deserialize;
use tauri::AppHandle;
use crate::session::manager::{SessionCreateResult, SessionManager};
use crate::session::SessionType;

#[derive(Deserialize)]
pub struct SshParams {
    pub host: String,
    pub port: u16,
    pub username: String,
    #[serde(rename = "identityFile")]
    pub identity_file: Option<String>,
}

#[tauri::command]
pub async fn session_create(
    state: tauri::State<'_, SessionManager>,
    app: AppHandle,
    r#type: String,
    cwd: Option<String>,
    cols: u16,
    rows: u16,
    shell_program: Option<String>,
    shell_args: Option<Vec<String>>,
    ssh: Option<SshParams>,
    wsl_distro: Option<String>,
) -> Result<SessionCreateResult, String> {
    let cwd = cwd.unwrap_or_else(|| "~".to_string());
    match r#type.as_str() {
        "local" => state.create_local(app, cwd, cols, rows, shell_program, shell_args, SessionType::Local).await,
        "wsl" => {
            let distro = wsl_distro.ok_or("wsl_distro is required for type 'wsl'")?;
            state.create_wsl_ssh(app, distro, cols, rows, None).await
        }
        "ssh" => {
            let ssh = ssh.ok_or("ssh params required for type 'ssh'")?;
            state.create_ssh(app, ssh.host, ssh.port, ssh.username, ssh.identity_file, cols, rows).await
        }
        other => Err(format!("unknown session type: {other}")),
    }
}

#[tauri::command]
pub async fn session_create_wsl_with_sudo(
    state: tauri::State<'_, SessionManager>,
    app: AppHandle,
    distro: String,
    password: String,
    cols: u16,
    rows: u16,
) -> Result<SessionCreateResult, String> {
    state.create_wsl_ssh(app, distro, cols, rows, Some(password)).await
}

#[tauri::command]
pub async fn session_create_with_password(
    state: tauri::State<'_, SessionManager>,
    app: AppHandle,
    host: String,
    port: u16,
    username: String,
    password: String,
    cols: u16,
    rows: u16,
) -> Result<SessionCreateResult, String> {
    state.create_ssh_with_password(app, host, port, username, password, cols, rows).await
}

#[tauri::command]
pub async fn session_write(
    state: tauri::State<'_, SessionManager>,
    session_id: String,
    data: Vec<u8>,
) -> Result<(), String> {
    state.write(&session_id, &data).await
}

#[tauri::command]
pub async fn session_resize(
    state: tauri::State<'_, SessionManager>,
    session_id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    state.resize(&session_id, cols, rows).await
}

#[tauri::command]
pub async fn session_kill(
    state: tauri::State<'_, SessionManager>,
    session_id: String,
) -> Result<(), String> {
    state.kill(&session_id).await
}
