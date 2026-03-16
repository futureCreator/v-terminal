# Splash Screen & Startup UX Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a splash screen during app startup and fix the Windows console flash from WSL command.

**Architecture:** A lightweight Tauri splash window (WebView-based) shows an indeterminate progress bar while the daemon starts and the main window loads in the background. The Rust backend communicates status to the splash via `webview.eval()`. The main window is hidden until both the daemon is connected and the React frontend has mounted.

**Tech Stack:** Tauri v2 (Rust backend), HTML/CSS (splash), React/TypeScript (frontend)

**Spec:** `docs/superpowers/specs/2026-03-16-splash-screen-startup-ux-design.md`

---

## Chunk 1: Console Flash Fix + Splash Window Config

### Task 1: Fix WSL console flash

**Files:**
- Modify: `src-tauri/src/commands/daemon_commands.rs:7-16`

- [ ] **Step 1: Add `CREATE_NO_WINDOW` flag to WSL command**

In `daemon_commands.rs`, replace the `get_wsl_distros` function's command construction (lines 10-16):

```rust
// Before:
let cached = state.wsl_distros_cache.get_or_init(|| {
    let Ok(output) = std::process::Command::new("wsl")
        .args(["--list", "--quiet"])
        .output()
    else {
        return vec![];
    };
```

```rust
// After:
let cached = state.wsl_distros_cache.get_or_init(|| {
    let mut cmd = std::process::Command::new("wsl");
    cmd.args(["--list", "--quiet"]);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }
    let Ok(output) = cmd.output() else {
        return vec![];
    };
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/handongho/.openclaw/workspace/projects/v-terminal && cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | tail -5`
Expected: successful compilation (warnings OK)

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/commands/daemon_commands.rs
git commit -m "fix: add CREATE_NO_WINDOW flag to WSL command to prevent console flash"
```

---

### Task 2: Configure splash window in Tauri config

**Files:**
- Modify: `src-tauri/tauri.conf.json:14-27`

- [ ] **Step 1: Add splash window and hide main window**

In `tauri.conf.json`, replace the `"windows"` array (lines 14-27) with:

```json
"windows": [
  {
    "label": "main",
    "title": "v-terminal",
    "width": 1200,
    "height": 800,
    "minWidth": 600,
    "minHeight": 400,
    "decorations": false,
    "transparent": false,
    "resizable": true,
    "center": true,
    "visible": false
  },
  {
    "label": "splash",
    "title": "v-terminal",
    "url": "/splash.html",
    "width": 300,
    "height": 120,
    "decorations": false,
    "transparent": false,
    "resizable": false,
    "center": true,
    "alwaysOnTop": true
  }
]
```

Key changes:
- Main window: added `"visible": false`
- Splash window: new entry, 300x120, no decorations, always on top

- [ ] **Step 2: Commit**

```bash
git add src-tauri/tauri.conf.json
git commit -m "feat: add splash window config and hide main window on startup"
```

---

### Task 3: Create splash HTML

**Files:**
- Create: `public/splash.html`

- [ ] **Step 1: Create the splash HTML file**

Create `public/splash.html` with a minimal dark-themed splash screen:

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>v-terminal</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background: #1a1a1a;
    color: #e0e0e0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100vh;
    user-select: none;
    -webkit-user-select: none;
    overflow: hidden;
  }
  .title {
    font-size: 16px;
    font-weight: 600;
    letter-spacing: 0.5px;
    margin-bottom: 16px;
    color: #ffffff;
  }
  .progress-track {
    width: 200px;
    height: 3px;
    background: #333;
    border-radius: 2px;
    overflow: hidden;
    margin-bottom: 12px;
  }
  .progress-bar {
    width: 40%;
    height: 100%;
    background: #808080;
    border-radius: 2px;
    animation: indeterminate 1.4s ease-in-out infinite;
  }
  @keyframes indeterminate {
    0%   { transform: translateX(-100%); }
    100% { transform: translateX(350%); }
  }
  .status {
    font-size: 11px;
    color: #888;
    letter-spacing: 0.3px;
  }
  .error .status {
    color: #e06060;
  }
</style>
</head>
<body>
  <div class="title">v-terminal</div>
  <div class="progress-track" id="progress">
    <div class="progress-bar"></div>
  </div>
  <div class="status" id="status">Starting...</div>
  <script>
    function updateStatus(text) {
      document.getElementById('status').textContent = text;
    }
    function showError(message) {
      document.getElementById('status').textContent = message;
      document.getElementById('progress').style.display = 'none';
      document.body.classList.add('error');
    }
  </script>
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add public/splash.html
git commit -m "feat: add minimal splash screen HTML"
```

---

## Chunk 2: Rust Backend Changes

### Task 4: Fix window-state plugin to exclude VISIBLE flag

**Files:**
- Modify: `src-tauri/src/lib.rs:113`

- [ ] **Step 1: Update window-state plugin initialization**

In `lib.rs`, replace line 113:

```rust
// Before:
.plugin(tauri_plugin_window_state::Builder::default().build())
```

```rust
// After:
.plugin({
    use tauri_plugin_window_state::StateFlags;
    tauri_plugin_window_state::Builder::default()
        .with_state_flags(StateFlags::all() & !StateFlags::VISIBLE)
        .build()
})
```

This prevents the plugin from restoring visibility on second launch, which would bypass the splash screen.

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/handongho/.openclaw/workspace/projects/v-terminal && cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | tail -5`
Expected: successful compilation

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/lib.rs
git commit -m "fix: exclude VISIBLE flag from window-state plugin to support splash screen"
```

---

### Task 5: Add `app_ready` command and splash helper functions

**Files:**
- Modify: `src-tauri/src/lib.rs:1-10` (imports), `lib.rs:104-145` (command + handler registration)

- [ ] **Step 1: Add imports and `app_ready` command**

Add the `AtomicBool` import at the top of `lib.rs` (after existing `use` statements, before `ensure_daemon_and_connect`):

```rust
use std::sync::atomic::{AtomicBool, Ordering};

// Note: In dev mode, frontend hot-reloads will not reset this flag.
// The splash is already closed at that point, so subsequent app_ready calls are correctly no-ops.
static APP_READY_DONE: AtomicBool = AtomicBool::new(false);
```

Add the `app_ready` command and splash helper functions before the `run()` function:

```rust
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
```

- [ ] **Step 2: Register `app_ready` in invoke handler**

In the `invoke_handler` macro call inside `run()`, add `app_ready` to the list:

```rust
.invoke_handler(tauri::generate_handler![
    app_ready,
    daemon_commands::get_daemon_status,
    // ... rest of existing commands
])
```

- [ ] **Step 3: Verify it compiles**

Run: `cd /Users/handongho/.openclaw/workspace/projects/v-terminal && cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | tail -5`
Expected: successful compilation

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/lib.rs
git commit -m "feat: add app_ready command and splash helper functions"
```

---

### Task 6: Modify daemon watchdog for splash integration and startup timeout

**Files:**
- Modify: `src-tauri/src/lib.rs:55-102` (the `start_daemon_watchdog` function)

- [ ] **Step 1: Rewrite `start_daemon_watchdog` with splash integration**

Replace the entire `start_daemon_watchdog` function (lines 55-102) with:

```rust
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
            client.wait_for_disconnect().await;

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
```

Key changes vs. the original:
- First connect is wrapped in `tokio::time::timeout(15s)` — if it doesn't connect in 15s, splash shows error and app exits
- Splash status is updated at each stage via `update_splash()` helper
- After first connect, the loop continues with infinite reconnection (same behavior as before, no timeout)
- `first_connect_loop` is extracted as a separate async function so it can be wrapped by `tokio::time::timeout`

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/handongho/.openclaw/workspace/projects/v-terminal && cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | tail -5`
Expected: successful compilation

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/lib.rs
git commit -m "feat: integrate splash progress and 15s startup timeout into daemon watchdog"
```

---

## Chunk 3: Frontend Changes

### Task 7: Add `app_ready` IPC call and frontend wiring

**Files:**
- Modify: `src/lib/tauriIpc.ts:101-109`
- Modify: `src/App.tsx:76-79`

- [ ] **Step 1: Add `appReady` to the IPC module**

In `src/lib/tauriIpc.ts`, add the `appReady` method to the `ipc` object (before the closing `};` on line 110):

```typescript
  async appReady(): Promise<void> {
    return invoke("app_ready");
  },
```

- [ ] **Step 2: Add startup ready logic in App.tsx**

In `src/App.tsx`, replace the WSL prefetch `useEffect` block (lines 76-79):

```typescript
// Before:
  // Prefetch WSL distros on startup to warm the Rust-side cache
  useEffect(() => {
    ipc.getWslDistros().catch(() => {});
  }, []);
```

```typescript
// After:
  // Prefetch WSL distros on startup to warm the Rust-side cache
  useEffect(() => {
    ipc.getWslDistros().catch(() => {});
  }, []);

  // Signal app_ready when daemon is connected (closes splash, shows main window)
  useEffect(() => {
    const readyFired = { current: false };
    const fireReady = () => {
      if (readyFired.current) return;
      readyFired.current = true;
      ipc.appReady().catch(() => {});
    };

    // 1. Register listener FIRST (prevents race condition)
    let unlisten: (() => void) | null = null;
    ipc.onDaemonStatus((status) => {
      if (status === "connected") fireReady();
    }).then((fn) => { unlisten = fn; });

    // 2. THEN check current status (in case already connected)
    ipc.getDaemonStatus().then((status) => {
      if (status === "connected") fireReady();
    }).catch(() => {});

    return () => { unlisten?.(); };
  }, []);
```

The ordering (listener → check) prevents the TOCTOU race where the daemon connects between the check and listener registration.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd /Users/handongho/.openclaw/workspace/projects/v-terminal && npx tsc --noEmit 2>&1 | tail -10`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/tauriIpc.ts src/App.tsx
git commit -m "feat: add app_ready IPC call to close splash when daemon is connected"
```

---

### Task 8: Manual verification checklist

- [ ] **Step 1: Build the app**

Run: `cd /Users/handongho/.openclaw/workspace/projects/v-terminal && pnpm tauri build 2>&1 | tail -20`

This is a Windows-targeted app, so a full build may not work on macOS. Verify at minimum that:
- Rust compilation succeeds
- TypeScript compilation succeeds
- `splash.html` exists in `dist/` after the frontend build

- [ ] **Step 2: Verify splash.html is in dist after frontend build**

Run: `cd /Users/handongho/.openclaw/workspace/projects/v-terminal && pnpm build && ls dist/splash.html`
Expected: file exists

- [ ] **Step 3: Final commit (if any remaining changes)**

```bash
git add -A
git commit -m "chore: splash screen startup UX implementation complete"
```
