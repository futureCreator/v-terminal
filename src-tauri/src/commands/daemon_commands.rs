use serde::Serialize;
use tauri::State;
use crate::state::app_state::AppState;
use crate::daemon::client::DaemonClient;

#[tauri::command]
pub fn get_wsl_distros() -> Result<Vec<String>, String> {
    #[cfg(windows)]
    {
        let output = std::process::Command::new("wsl")
            .args(["--list", "--quiet"])
            .output()
            .map_err(|_| "WSL not found".to_string())?;

        // wsl --list outputs UTF-16LE on Windows
        let bytes = output.stdout;
        let text = if bytes.len() >= 2 && bytes[1] == 0 {
            let u16_chars: Vec<u16> = bytes
                .chunks_exact(2)
                .map(|c| u16::from_le_bytes([c[0], c[1]]))
                .collect();
            String::from_utf16_lossy(&u16_chars).to_string()
        } else {
            String::from_utf8_lossy(&bytes).to_string()
        };

        let distros: Vec<String> = text
            .lines()
            .map(|l| l.trim().trim_start_matches('\u{feff}').to_string())
            .filter(|l| !l.is_empty())
            .collect();

        Ok(distros)
    }
    #[cfg(not(windows))]
    {
        Ok(vec![])
    }
}

#[derive(Serialize)]
pub struct DaemonSessionInfo {
    pub id: String,
    pub label: String,
    pub cwd: String,
    pub created_at: u64,
    pub last_active: u64,
}

#[tauri::command]
pub async fn get_daemon_status(state: State<'_, AppState>) -> Result<String, String> {
    let connected = state.daemon_client.lock().await.is_some();
    Ok(if connected { "connected".to_string() } else { "reconnecting".to_string() })
}

async fn client(state: &State<'_, AppState>) -> Result<DaemonClient, String> {
    state
        .daemon_client
        .lock()
        .await
        .clone()
        .ok_or_else(|| "daemon not connected".to_string())
}

#[tauri::command]
pub async fn daemon_list_sessions(
    state: State<'_, AppState>,
) -> Result<Vec<DaemonSessionInfo>, String> {
    let c = client(&state).await?;
    let resp = c.send(serde_json::json!({"cmd": "list_sessions"})).await?;
    let sessions = resp["sessions"]
        .as_array()
        .ok_or("invalid response")?
        .iter()
        .map(|s| DaemonSessionInfo {
            id: s["id"].as_str().unwrap_or("").to_string(),
            label: s["label"].as_str().unwrap_or("").to_string(),
            cwd: s["cwd"].as_str().unwrap_or("").to_string(),
            created_at: s["created_at"].as_u64().unwrap_or(0),
            last_active: s["last_active"].as_u64().unwrap_or(0),
        })
        .collect();
    Ok(sessions)
}

#[tauri::command]
pub async fn daemon_create_session(
    state: State<'_, AppState>,
    cwd: String,
    cols: u16,
    rows: u16,
    label: Option<String>,
    shell_program: Option<String>,
    shell_args: Option<Vec<String>>,
) -> Result<String, String> {
    let c = client(&state).await?;
    let resp = c
        .send(serde_json::json!({
            "cmd": "create_session",
            "cwd": cwd,
            "cols": cols,
            "rows": rows,
            "label": label,
            "shell_program": shell_program,
            "shell_args": shell_args,
        }))
        .await?;
    if resp["event"] == "error" {
        return Err(resp["message"].as_str().unwrap_or("unknown error").to_string());
    }
    resp["session_id"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "missing session_id".to_string())
}

#[tauri::command]
pub async fn daemon_attach(
    state: State<'_, AppState>,
    session_id: String,
) -> Result<Vec<u8>, String> {
    let c = client(&state).await?;
    let resp = c
        .send(serde_json::json!({"cmd": "attach", "session_id": session_id}))
        .await?;
    if resp["event"] == "error" {
        return Err(resp["message"].as_str().unwrap_or("attach failed").to_string());
    }
    let scrollback = resp["scrollback"]
        .as_array()
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_u64().map(|n| n as u8))
                .collect()
        })
        .unwrap_or_default();
    Ok(scrollback)
}

#[tauri::command]
pub async fn daemon_detach(
    state: State<'_, AppState>,
    session_id: String,
) -> Result<(), String> {
    let c = client(&state).await?;
    c.fire(serde_json::json!({"cmd": "detach", "session_id": session_id}));
    Ok(())
}

#[tauri::command]
pub async fn daemon_write(
    state: State<'_, AppState>,
    session_id: String,
    data: Vec<u8>,
) -> Result<(), String> {
    let c = client(&state).await?;
    c.fire(serde_json::json!({"cmd": "write", "session_id": session_id, "data": data}));
    Ok(())
}

#[tauri::command]
pub async fn daemon_resize(
    state: State<'_, AppState>,
    session_id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    let c = client(&state).await?;
    c.fire(serde_json::json!({"cmd": "resize", "session_id": session_id, "cols": cols, "rows": rows}));
    Ok(())
}

#[tauri::command]
pub async fn daemon_kill_session(
    state: State<'_, AppState>,
    session_id: String,
) -> Result<(), String> {
    let c = client(&state).await?;
    c.send(serde_json::json!({"cmd": "kill_session", "session_id": session_id}))
        .await?;
    Ok(())
}
