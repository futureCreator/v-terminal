mod commands;
mod daemon;
mod pty;
mod state;

use commands::{daemon_commands, pty_commands, session_commands, wsl_commands};
use daemon::client::DaemonClient;
use state::app_state::AppState;
use tauri::{Emitter, Manager};
use std::sync::atomic::{AtomicBool, Ordering};

// Note: In dev mode, frontend hot-reloads will not reset this flag.
// The splash is already closed at that point, so subsequent app_ready calls are correctly no-ops.
static APP_READY_DONE: AtomicBool = AtomicBool::new(false);

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

    #[allow(unused_mut)]
    let mut cmd = std::process::Command::new(&daemon_exe);
    cmd.stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null());

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    cmd.spawn().map_err(|e| format!("spawn daemon: {e}"))?;

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
        // --- First connect: 15s hard timeout ---
        update_splash(&app, "Starting daemon...");

        let first_result = tokio::time::timeout(
            std::time::Duration::from_secs(15),
            first_connect_loop(&app),
        )
        .await;

        let mut client = match first_result {
            Ok(Ok(c)) => c,
            _ => {
                show_splash_error(
                    &app,
                    "Failed to start daemon. Please restart the application.",
                );
                tokio::time::sleep(std::time::Duration::from_secs(3)).await;
                std::process::exit(1);
            }
        };

        // Store client and notify frontend
        {
            let state = app.state::<AppState>();
            *state.daemon_client.lock().await = Some(client.clone());
        }
        update_splash(&app, "Almost ready...");
        eprintln!("daemon connected");
        let _ = app.emit("daemon-status", "connected");

        // --- Ongoing reconnection loop (no timeout, infinite retry) ---
        loop {
            // Race: either the TCP reader detects a clean disconnect, or the
            // heartbeat detects a stale (half-open) connection first.
            let hb = client.clone();
            tokio::select! {
                _ = client.wait_for_disconnect() => {}
                _ = heartbeat_loop(&hb) => {
                    eprintln!("daemon heartbeat failed — connection stale");
                }
            }

            {
                let state = app.state::<AppState>();
                *state.daemon_client.lock().await = None;
            }
            eprintln!("daemon disconnected, reconnecting...");
            let _ = app.emit("daemon-status", "reconnecting");

            let mut backoff_ms = 500u64;
            client = loop {
                match ensure_daemon_and_connect(app.clone()).await {
                    Ok(c) => {
                        break c;
                    }
                    Err(e) => {
                        eprintln!("daemon reconnect failed: {e}, retrying in {backoff_ms}ms");
                        tokio::time::sleep(std::time::Duration::from_millis(backoff_ms)).await;
                        backoff_ms = (backoff_ms * 2).min(10_000);
                    }
                }
            };

            {
                let state = app.state::<AppState>();
                *state.daemon_client.lock().await = Some(client.clone());
            }
            eprintln!("daemon reconnected");
            let _ = app.emit("daemon-status", "connected");
        }
    });
}

async fn first_connect_loop(app: &tauri::AppHandle) -> Result<DaemonClient, String> {
    let mut backoff_ms = 500u64;
    loop {
        match ensure_daemon_and_connect(app.clone()).await {
            Ok(c) => return Ok(c),
            Err(e) => {
                eprintln!("daemon connect failed: {e}, retrying in {backoff_ms}ms");
                update_splash(app, "Connecting...");
                tokio::time::sleep(std::time::Duration::from_millis(backoff_ms)).await;
                backoff_ms = (backoff_ms * 2).min(10_000);
            }
        }
    }
}

/// Sends periodic pings to the daemon; returns (completing the future) when
/// a ping fails, indicating the connection is stale.
async fn heartbeat_loop(client: &DaemonClient) {
    // Give the connection a moment to stabilise after (re)connect.
    tokio::time::sleep(std::time::Duration::from_secs(5)).await;
    let mut interval = tokio::time::interval(std::time::Duration::from_secs(5));
    loop {
        interval.tick().await;
        if client
            .send(serde_json::json!({"cmd": "ping"}))
            .await
            .is_err()
        {
            return;
        }
    }
}

fn update_splash(app: &tauri::AppHandle, msg: &str) {
    if let Some(splash) = app.get_webview_window("splash") {
        let escaped = msg.replace('\\', "\\\\").replace('"', "\\\"");
        let _ = splash.eval(&format!("updateStatus(\"{escaped}\")"));
    }
}

fn show_splash_error(app: &tauri::AppHandle, msg: &str) {
    if let Some(splash) = app.get_webview_window("splash") {
        let escaped = msg.replace('\\', "\\\\").replace('"', "\\\"");
        let _ = splash.eval(&format!("showError(\"{escaped}\")"));
    }
}

#[tauri::command]
async fn app_ready(app: tauri::AppHandle) {
    if APP_READY_DONE.swap(true, Ordering::SeqCst) {
        return;
    }
    if let Some(splash) = app.get_webview_window("splash") {
        let _ = splash.close();
    }
    if let Some(main) = app.get_webview_window("main") {
        let _ = main.show();
        let _ = main.set_focus();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app_state = AppState::new();
    let pty_manager = pty::manager::PtyManager::new();

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
        .manage(app_state)
        .manage(pty_manager)
        .setup(|app| {
            // Daemon watchdog disabled — using direct PTY IPC instead.
            // start_daemon_watchdog(app.handle().clone());

            // Show main window immediately (no daemon connection required).
            if let Some(splash) = app.get_webview_window("splash") {
                let _ = splash.close();
            }
            if let Some(main) = app.get_webview_window("main") {
                let _ = main.show();
                let _ = main.set_focus();
            }
            APP_READY_DONE.store(true, std::sync::atomic::Ordering::SeqCst);
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                if window.label() == "main" {
                    let manager = window.state::<pty::manager::PtyManager>();
                    manager.kill_all();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            app_ready,
            daemon_commands::get_daemon_status,
            daemon_commands::daemon_list_sessions,
            daemon_commands::daemon_create_session,
            daemon_commands::daemon_attach,
            daemon_commands::daemon_detach,
            daemon_commands::daemon_write,
            daemon_commands::daemon_resize,
            daemon_commands::daemon_kill_session,
            session_commands::save_session,
            session_commands::load_session,
            pty_commands::pty_create,
            pty_commands::pty_write,
            pty_commands::pty_resize,
            pty_commands::pty_kill,
            wsl_commands::get_wsl_distros,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
