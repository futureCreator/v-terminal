mod commands;
mod pty;
mod state;

use state::app_state::AppState;
use commands::{pty_commands, session_commands};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app_state = AppState::new();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            pty_commands::pty_create,
            pty_commands::pty_write,
            pty_commands::pty_resize,
            pty_commands::pty_kill,
            session_commands::save_session,
            session_commands::load_session,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
