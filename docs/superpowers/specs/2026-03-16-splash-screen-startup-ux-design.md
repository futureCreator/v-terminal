# Splash Screen & Startup UX Improvement

## Problem

1. **App freezes on startup**: The app window appears but is unresponsive while the daemon starts and WebView2 initializes. No visual feedback is provided during initial daemon connection (only reconnection shows a banner).
2. **Console window flash**: `get_wsl_distros` spawns `wsl.exe` without `CREATE_NO_WINDOW` flag, causing a Windows console window to briefly appear and disappear on startup.

## Solution

### Fix 1: Console Flash (WSL)

Add `CREATE_NO_WINDOW` (0x08000000) creation flag to the `wsl` process in `get_wsl_distros`.

**File**: `src-tauri/src/commands/daemon_commands.rs`

Change the `std::process::Command::new("wsl")` call to include:
```rust
let mut cmd = std::process::Command::new("wsl");
cmd.args(["--list", "--quiet"]);
#[cfg(windows)]
{
    use std::os::windows::process::CommandExt;
    cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
}
let Ok(output) = cmd.output() else { return vec![]; };
```

### Fix 2: Splash Screen

Add a small, minimal splash window that displays during startup, providing visual feedback while the daemon starts and the main window loads in the background.

#### Window Configuration

**Splash window** (new entry in `tauri.conf.json` windows array):
- Label: `"splash"`
- Size: 300x120
- Decorations: false (no title bar)
- Resizable: false
- AlwaysOnTop: true
- Center: true
- Transparent: false
- URL: `/splash.html`

**Main window** changes:
- Add `"visible": false` (hidden on startup, shown programmatically after ready)

**`tauri-plugin-window-state` fix**: This plugin restores saved window state including visibility. On second launch, it would restore the main window as visible (since it was visible when closed), overriding `visible: false` in config. To prevent this, exclude the `VISIBLE` flag from state restoration:

```rust
// In lib.rs, replace:
//   .plugin(tauri_plugin_window_state::Builder::default().build())
// With:
use tauri_plugin_window_state::StateFlags;
.plugin(
    tauri_plugin_window_state::Builder::default()
        .with_state_flags(StateFlags::all() & !StateFlags::VISIBLE)
        .build()
)
```

This ensures the plugin restores position/size/maximized state but never overrides visibility. The splash window is transient and not managed by this plugin.

#### Splash HTML (`public/splash.html`)

The splash HTML is placed in `public/` so Vite copies it as-is to `dist/`. The URL in `tauri.conf.json` is `/splash.html`.

Since `withGlobalTauri` is `false`, the splash HTML **cannot** import Tauri event APIs. Instead, the Rust backend will update the splash UI by calling `webview.eval()` on the splash window to invoke a global JS function:

```javascript
// In splash.html
function updateStatus(text) {
  document.getElementById('status').textContent = text;
}
function showError(message) {
  document.getElementById('status').textContent = message;
  document.getElementById('progress').style.display = 'none';
}
```

```rust
// In Rust
if let Some(splash) = app.get_webview_window("splash") {
    let _ = splash.eval("updateStatus('Connecting...')");
}
```

Contents:
- App name "v-terminal" in small text
- Indeterminate CSS progress bar (animated, no percentage)
- Status text (updated via `eval()`)
- Dark theme (#1a1a1a background, white/light text)
- Font: system font stack (no external dependencies)

#### New Tauri Command: `app_ready`

**File**: `src-tauri/src/lib.rs`

Must be registered in `tauri::generate_handler![...]` in the `invoke_handler` call.

```rust
use std::sync::atomic::{AtomicBool, Ordering};

static APP_READY_DONE: AtomicBool = AtomicBool::new(false);

#[tauri::command]
async fn app_ready(app: tauri::AppHandle) {
    // Idempotent: guard against double invocation
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
```

This is placed directly in `lib.rs` (not in `commands/`) because it is an app-lifecycle command, not a domain command.

Note: The existing codebase uses `get_window()` in `browser_commands.rs`. In Tauri v2 with `unstable` feature, `get_webview_window()` is the current API. Both work, but `get_webview_window()` is preferred for new code.

#### Daemon Watchdog Changes

**File**: `src-tauri/src/lib.rs`

Modify `start_daemon_watchdog` to:
1. Emit splash progress via `webview.eval()` at each stage
2. Add a 15-second total timeout wrapping the **first** connection attempt only (not subsequent reconnections)
3. On timeout: show error on splash via `eval()`, wait 3 seconds, then `std::process::exit(1)`

**Timeout integration with existing retry loop** — the 15-second timeout wraps the entire first-connect retry loop:

```rust
fn start_daemon_watchdog(app: tauri::AppHandle) {
    tauri::async_runtime::spawn(async move {
        // --- First connect: 15s hard timeout ---
        update_splash(&app, "Starting daemon...");

        let first_result = tokio::time::timeout(
            std::time::Duration::from_secs(15),
            first_connect_loop(&app),  // inner retry loop
        ).await;

        let client = match first_result {
            Ok(Ok(c)) => c,
            _ => {
                // Timeout or all retries failed
                show_splash_error(&app, "Failed to start daemon. Please restart the application.");
                tokio::time::sleep(std::time::Duration::from_secs(3)).await;
                std::process::exit(1);
            }
        };

        // Store client, emit connected, proceed to normal watchdog loop...
        // (existing reconnection logic with infinite retry remains unchanged)
    });
}
```

Note: `std::process::exit(1)` bypasses Tauri cleanup, but this is intentional — at startup failure there is no meaningful state to save.

**Handling instant daemon connection**: If the daemon is already running, `ensure_daemon_and_connect` connects immediately on the first try. In this case, the "Starting daemon..." stage is never visible. This is fine — the splash will show briefly with the initial status and close almost immediately when `app_ready` is called. The progress text sequence is best-effort, not guaranteed to show every step.

#### Startup Event Flow

```
App starts
|-- Splash window opens immediately (lightweight WebView)
|-- Main window created with visible: false (WebView2 loads in background)
|
|-- Rust setup() runs
|   |-- start_daemon_watchdog() spawned (async)
|   |   |-- eval("updateStatus('Starting daemon...')")
|   |   |-- Try connect to existing daemon
|   |   |   |-- Success: skip to "connected"
|   |   |   |-- Fail: spawn daemon binary
|   |   |       |-- eval("updateStatus('Connecting...')")
|   |   |       |-- Wait for daemon to bind (up to 5s per attempt)
|   |   |
|   |   |-- Connected:
|   |   |   |-- eval("updateStatus('Almost ready...')")
|   |   |   |-- emit("daemon-status", "connected")
|   |   |
|   |   |-- Failed (15s total timeout):
|   |       |-- eval("showError('Failed to start daemon...')")
|   |       |-- sleep 3s -> std::process::exit(1)
|   |
|-- Frontend (main window) React mounts
|   |-- 1. Register listener for "daemon-status" event
|   |-- 2. Check get_daemon_status() (in case event already fired)
|   |-- 3. When connected: invoke("app_ready")
|
|-- app_ready command (Rust)
    |-- splash window -> close()
    |-- main window -> show() + set_focus()
```

**Race condition prevention**: The frontend must register the `daemon-status` event listener BEFORE checking `get_daemon_status()`. This ensures that if the daemon connects between the check and listener registration, the event is not missed.

#### Frontend Changes

**File**: `src/App.tsx`

Add a `useEffect` that:
1. Registers a listener for `daemon-status` = `"connected"` event
2. Then checks current status via `get_daemon_status()` (in case already connected)
3. On either path confirming connected: invoke `app_ready` once

The `app_ready` call should only happen once (use a ref flag to guard).

#### Capabilities

**File**: `src-tauri/capabilities/default.json`

The splash window does not invoke any Tauri commands or use any Tauri APIs (all updates come via Rust `eval()` calls). The capabilities scope `"windows": ["main"]` does not need to change. The splash window only needs the default WebView rendering capability which is always available.

## Files Changed

| File | Change |
|------|--------|
| `src-tauri/tauri.conf.json` | Add splash window config, add `"visible": false` to main window |
| `public/splash.html` | New file: splash UI (HTML + CSS + global JS functions for eval) |
| `src-tauri/src/lib.rs` | Add `app_ready` command + register in `generate_handler![]`, modify watchdog for splash eval + 15s first-connect timeout, exclude `VISIBLE` from window-state plugin flags |
| `src-tauri/src/commands/daemon_commands.rs` | Add `CREATE_NO_WINDOW` to WSL command |
| `src/App.tsx` | Add `app_ready` invocation: register listener first, then check status |

## Design Decisions

- **Indeterminate progress bar**: Daemon startup time is unpredictable (0-5s depending on whether daemon is already running). A percentage-based bar would feel inaccurate.
- **Separate splash window over overlay**: An overlay on the main window would not be visible during WebView2 initialization, defeating the purpose.
- **Main window hidden, not absent**: Creating the main window early (but hidden) allows WebView2 to initialize in parallel with daemon startup, minimizing total wait time.
- **Rust `eval()` over Tauri events**: Since `withGlobalTauri` is `false`, the splash HTML cannot import Tauri event APIs without a bundler. Using `webview.eval()` from Rust is simpler and avoids this dependency.
- **15-second timeout on first connect only**: The watchdog's existing retry/backoff logic handles reconnection after initial startup. The 15s timeout prevents the splash from hanging indefinitely on first launch.
- **`std::process::exit(1)` on daemon failure**: Intentionally bypasses cleanup. At startup there is no user state to save. Daemon is required for all functionality.
- **Listener before status check**: Prevents TOCTOU race where daemon connects between check and listener registration.
- **Idempotent `app_ready`**: Guards against edge case where daemon quickly disconnects and reconnects during startup, causing double invocation.
