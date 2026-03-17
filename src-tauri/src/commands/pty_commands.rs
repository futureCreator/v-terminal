use tauri::AppHandle;
use crate::pty::manager::PtyManager;

#[tauri::command]
pub fn pty_create(
    state: tauri::State<'_, PtyManager>,
    app: AppHandle,
    cwd: String,
    cols: u16,
    rows: u16,
    shell_program: Option<String>,
    shell_args: Option<Vec<String>>,
) -> Result<String, String> {
    state.create(app, cwd, cols, rows, shell_program, shell_args)
}

#[tauri::command]
pub fn pty_write(
    state: tauri::State<'_, PtyManager>,
    pty_id: String,
    data: Vec<u8>,
) -> Result<(), String> {
    state.write(&pty_id, &data)
}

#[tauri::command]
pub fn pty_resize(
    state: tauri::State<'_, PtyManager>,
    pty_id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    state.resize(&pty_id, cols, rows)
}

#[tauri::command]
pub fn pty_kill(
    state: tauri::State<'_, PtyManager>,
    pty_id: String,
) -> Result<(), String> {
    state.kill(&pty_id)
}
