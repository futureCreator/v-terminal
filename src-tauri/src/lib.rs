mod commands;
mod session;

use session::manager::SessionManager;
use commands::{session_commands, wsl_commands, browser_commands};
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let session_manager = SessionManager::new();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin({
            use tauri_plugin_window_state::StateFlags;
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(StateFlags::all() & !StateFlags::VISIBLE)
                .build()
        })
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .manage(session_manager)
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                if window.label() == "main" {
                    let manager = window.state::<SessionManager>();
                    tokio::task::block_in_place(|| {
                        tokio::runtime::Handle::current().block_on(manager.kill_all());
                    });
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            session_commands::session_create,
            session_commands::session_create_with_password,
            session_commands::session_create_wsl_with_sudo,
            session_commands::session_write,
            session_commands::session_resize,
            session_commands::session_kill,
            wsl_commands::get_wsl_distros,
            browser_commands::browser_create,
            browser_commands::browser_navigate,
            browser_commands::browser_go_back,
            browser_commands::browser_go_forward,
            browser_commands::browser_reload,
            browser_commands::browser_resize,
            browser_commands::browser_destroy,
            browser_commands::browser_get_current_url,
            browser_commands::browser_url_report,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
