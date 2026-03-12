mod commands;
mod daemon;
mod state;

use commands::{daemon_commands, session_commands};
use daemon::client::DaemonClient;
use state::app_state::AppState;
use tauri::{Emitter, Manager};

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

fn start_daemon_watchdog(app: tauri::AppHandle) {
    tauri::async_runtime::spawn(async move {
        let mut backoff_ms = 500u64;
        let mut first_connect = true;

        loop {
            // Keep retrying until connected
            let client = loop {
                match ensure_daemon_and_connect(app.clone()).await {
                    Ok(c) => {
                        backoff_ms = 500;
                        break c;
                    }
                    Err(e) => {
                        eprintln!("daemon connect failed: {e}, retrying in {backoff_ms}ms");
                        tokio::time::sleep(std::time::Duration::from_millis(backoff_ms)).await;
                        backoff_ms = (backoff_ms * 2).min(10_000);
                    }
                }
            };

            // Store client in app state
            {
                let state = app.state::<AppState>();
                *state.daemon_client.lock().await = Some(client.clone());
            }

            if first_connect {
                first_connect = false;
                eprintln!("daemon connected");
            } else {
                eprintln!("daemon reconnected");
            }
            let _ = app.emit("daemon-status", "connected");

            // Block until connection drops
            client.wait_for_disconnect().await;

            // Clear stale client and notify frontend
            {
                let state = app.state::<AppState>();
                *state.daemon_client.lock().await = None;
            }
            eprintln!("daemon disconnected, reconnecting...");
            let _ = app.emit("daemon-status", "reconnecting");
        }
    });
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
            start_daemon_watchdog(app.handle().clone());
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
