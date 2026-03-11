mod commands;
mod daemon;
mod state;

use commands::{daemon_commands, session_commands};
use daemon::client::DaemonClient;
use state::app_state::AppState;
use tauri::Manager;

async fn ensure_daemon_and_connect(app: tauri::AppHandle) -> Result<DaemonClient, String> {
    // Try connecting to already-running daemon first
    if let Ok(client) = DaemonClient::connect(app.clone()).await {
        return Ok(client);
    }

    // Find and spawn the daemon binary
    let daemon_exe = {
        let exe_dir = std::env::current_exe()
            .ok()
            .and_then(|p| p.parent().map(|p| p.to_path_buf()))
            .unwrap_or_default();
        #[cfg(windows)]
        { exe_dir.join("v-terminal-daemon.exe") }
        #[cfg(not(windows))]
        { exe_dir.join("v-terminal-daemon") }
    };

    std::process::Command::new(&daemon_exe)
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .spawn()
        .map_err(|e| format!("spawn daemon: {e}"))?;

    // Wait up to 5s for daemon to be ready
    for _ in 0..50 {
        tokio::time::sleep(std::time::Duration::from_millis(100)).await;
        if let Ok(client) = DaemonClient::connect(app.clone()).await {
            return Ok(client);
        }
    }

    Err("daemon did not start in time".to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app_state = AppState::new();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .manage(app_state)
        .setup(|app| {
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                match ensure_daemon_and_connect(app_handle.clone()).await {
                    Ok(client) => {
                        let state = app_handle.state::<AppState>();
                        *state.daemon_client.lock().await = Some(client);
                        eprintln!("daemon connected");
                    }
                    Err(e) => eprintln!("daemon error: {e}"),
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            daemon_commands::daemon_list_sessions,
            daemon_commands::daemon_create_session,
            daemon_commands::daemon_attach,
            daemon_commands::daemon_detach,
            daemon_commands::daemon_write,
            daemon_commands::daemon_resize,
            daemon_commands::daemon_kill_session,
            daemon_commands::get_wsl_distros,
            session_commands::save_session,
            session_commands::load_session,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
