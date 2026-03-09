use tauri::AppHandle;
use crate::state::app_state::AppState;

#[tauri::command]
pub async fn pty_create(
    state: tauri::State<'_, AppState>,
    app: AppHandle,
    cwd: String,
    cols: u16,
    rows: u16,
) -> Result<String, String> {
    let mut manager = state.pty_manager.lock().map_err(|e| e.to_string())?;
    manager.create(app, cwd, cols, rows)
}

#[tauri::command]
pub fn pty_write(
    state: tauri::State<'_, AppState>,
    pty_id: String,
    data: Vec<u8>,
) -> Result<(), String> {
    let mut manager = state.pty_manager.lock().map_err(|e| e.to_string())?;
    manager.write(&pty_id, &data)
}

#[tauri::command]
pub fn pty_resize(
    state: tauri::State<'_, AppState>,
    pty_id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    let mut manager = state.pty_manager.lock().map_err(|e| e.to_string())?;
    manager.resize(&pty_id, cols, rows)
}

#[tauri::command]
pub fn pty_kill(
    state: tauri::State<'_, AppState>,
    pty_id: String,
) -> Result<(), String> {
    let mut manager = state.pty_manager.lock().map_err(|e| e.to_string())?;
    manager.kill(&pty_id);
    Ok(())
}
