# Phase 1: Daemon Removal & Direct PTY Architecture

## Problem

The current daemon-based architecture maintains PTY sessions in a separate process (`v-terminal-daemon`) communicating via TCP on localhost:57320. This was designed for session persistence across app restarts, but since the daemon runs on the client side (not a remote server), restarting the PC kills all sessions anyway — defeating the purpose.

The daemon adds significant complexity:
- TCP protocol with JSON-RPC commands and base64 encoding
- Heartbeat detection for stale connections
- Backpressure management with bounded channels
- Splash screen for daemon startup wait
- Reconnection logic with exponential backoff
- Scrollback snapshot/resync mechanisms

## Solution

Remove the daemon entirely. Manage PTY sessions directly within the Tauri process using `portable-pty`.

## Architecture

### Current (Daemon)

```
React → Tauri IPC → TCP → Daemon (separate process) → portable-pty
```

### New (Direct PTY)

```
React → Tauri IPC → PtyManager (in-process) → portable-pty
```

## Rust Backend

### Files to Remove

| File | Reason |
|------|--------|
| `src-tauri/src/bin/daemon.rs` | Daemon binary |
| `src-tauri/src/daemon/` | Daemon client module |
| `src-tauri/src/state/app_state.rs` | Held DaemonClient reference |
| `src-tauri/src/commands/daemon_commands.rs` | Daemon-proxied commands |
| `src-tauri/src/commands/session_commands.rs` | Session save/restore |
| `src-tauri/src/state/persistence.rs` | Session persistence |
| `public/splash.html` | Splash screen |
| `scripts/build-daemon-dev.mjs` | Daemon build script |
| `scripts/build-daemon-release.mjs` | Daemon build script |
| `src-tauri/binaries/` | Daemon binary artifacts |

### New File Structure

```
src-tauri/src/
├── lib.rs              // Simplified: register PtyManager + command handlers
├── pty/
│   ├── mod.rs
│   └── manager.rs      // PtyManager struct
└── commands/
    ├── mod.rs
    ├── pty_commands.rs  // pty_create, pty_write, pty_resize, pty_kill
    └── wsl_commands.rs  // get_wsl_distros (extracted from daemon_commands)
```

### PtyManager

```rust
pub struct PtyManager {
    sessions: std::sync::Mutex<HashMap<String, PtySession>>,
    wsl_distros_cache: std::sync::Mutex<Option<Vec<String>>>,
}

struct PtySession {
    writer: Box<dyn Write + Send>,
    master: Box<dyn MasterPty + Send>,   // For resize (PtyPair cannot be stored — slave is consumed by spawn)
    child: Box<dyn Child + Send>,         // For kill + exit detection
}

// Safety: all field access is serialized through the Mutex.
// portable-pty types are not Send on all platforms, but exclusive
// Mutex access guarantees no concurrent use.
unsafe impl Send for PtySession {}
```

**Constraints:**
- `std::sync::Mutex` is used (not `tokio::sync::Mutex`) because all `PtyManager` methods are synchronous. PTY write and resize are blocking `std::io` operations. PtyManager methods must remain synchronous — do not add `.await` while holding the lock.
- `wsl_distros_cache` is stored here since `AppState` is being removed.
- Max 64 concurrent sessions enforced in `pty_create` (defensive limit, carried from daemon).

### Tauri Commands

| Command | Parameters | Role |
|---------|-----------|------|
| `pty_create` | `cwd`, `shell_program?`, `shell_args?`, `rows`, `cols` | Spawn PTY with optional custom shell (needed for WSL: `wsl.exe -d <distro>`, SSH: system `ssh`). Return session ID. Start reader thread emitting `pty-output-{id}` events. |
| `pty_write` | `session_id`, `data: Vec<u8>` | Write input bytes to PTY master (binary, no base64) |
| `pty_resize` | `session_id`, `rows`, `cols` | Resize PTY terminal dimensions |
| `pty_kill` | `session_id` | Kill child process tree (`taskkill /F /T /PID` on Windows) + cleanup session |

### Process Cleanup on App Close

The daemon had explicit `kill_process_tree` logic on exit. The new architecture must preserve this:

```rust
.on_window_event(|window, event| {
    if let tauri::WindowEvent::Destroyed = event {
        if window.label() == "main" {
            let pty_manager = window.state::<PtyManager>();
            pty_manager.kill_all();  // Iterates all sessions, kills child process trees
        }
    }
})
```

On Windows, `kill_process_tree` uses `taskkill /F /T /PID {pid}` to terminate the full child process tree (cmd.exe, pwsh.exe, wsl.exe, etc.).

### Simplified lib.rs

```rust
pub fn run() {
    let pty_manager = PtyManager::new();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .manage(pty_manager)
        .invoke_handler(tauri::generate_handler![
            pty_commands::pty_create,
            pty_commands::pty_write,
            pty_commands::pty_resize,
            pty_commands::pty_kill,
            wsl_commands::get_wsl_distros,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

Removed: daemon watchdog, heartbeat, splash screen, `app_ready`, base64 encoding, TCP reconnection.

### PTY Output Data Flow

```
portable-pty reader thread
    → reads bytes from PTY master
    → app.emit("pty-output-{session_id}", data)
    → frontend listen() receives event
    → xterm.js terminal.write(data)
```

## Frontend Changes

### IPC Layer (`src/lib/tauriIpc.ts`)

| Current (daemon) | New (direct) |
|---|---|
| `daemonCreateSession()` → TCP → daemon | `ptyCreate(cwd, shellProgram?, shellArgs?, rows, cols)` → Tauri IPC → PtyManager |
| `daemonWrite()` → base64 → TCP | `ptyWrite(sessionId, data)` → Tauri IPC (binary) |
| `daemonResize()` → TCP | `ptyResize(sessionId, rows, cols)` → Tauri IPC |
| `daemonKillSession()` → TCP | `ptyKill(sessionId)` → Tauri IPC |
| `daemonAttach()` / `daemonDetach()` | **Removed** (no attach/detach concept) |
| `daemonListSessions()` | **Removed** (no sessions to restore) |
| `onPtyOutput()` / `onPtyResync()` | **Replaced** with Tauri Event `listen("pty-output-{id}")`. Resync is removed — no broadcast channel lag in direct architecture. |

### TerminalPane Changes

- Receive PTY output via Tauri Event (`pty-output-{sessionId}`) instead of TCP stream
- Simplify init from create+attach two-step to single `ptyCreate`. Remove `existingSessionId` / attach-fallback logic.
- Remove attach/detach logic — `ptyCreate` on mount, `ptyKill` on unmount
- Remove scrollback snapshot restore
- Remove base64 decoding

### App.tsx Changes

- Remove daemon-status `useEffect` (daemon connection wait + `ipc.appReady()` call)
- Remove `daemon-status` event listeners
- Main window starts visible immediately (no splash → show sequence)

### Removed Components & Types

| Component/Code | Reason |
|---|---|
| `src/components/SessionPicker/` | Session restore UI. New tabs start a local terminal immediately. Connection type (SSH/WSL) is selected via command palette or panel context menu, same as today. |
| `src/components/DaemonStatusBanner/` | No daemon to reconnect |
| `tabStore.ts` saved tabs (`savedTabs`, `saveAndRemoveTab`, `saveAllOpenTabsToBackground`) | No session persistence |
| `types/terminal.ts` `DaemonSessionInfo` type | Daemon-specific type |
| `tabStore.ts` `pendingSessionPick` on Tab | No session picker flow; new tabs open directly |

### Unchanged (No Modifications Needed)

- Panel layout/split logic
- Broadcast mode (frontend-level input fan-out)
- SSH profiles + `buildSshCommand()` (system ssh, unchanged for Phase 1)
- Notes / Todos / Timer / Cheatsheets / Clipboard history
- Command palette
- Themes / Settings

## Migration Strategy

Incremental, inside-out approach. Steps 1-2 allow daemon and new PTY to coexist for verification.

### Step 1: Implement Rust PtyManager

- Create `pty/manager.rs` with PtyManager struct (store `master`, `writer`, `child`)
- Create `pty_commands.rs` with 4 commands (accepting `shell_program`/`shell_args`)
- Extract `get_wsl_distros` into `wsl_commands.rs`, move cache to PtyManager
- Add process cleanup hook (`on_window_event` / Destroyed)
- Register alongside existing daemon commands in `lib.rs`
- Daemon still alive at this point

Note: partial implementation exists in `src-tauri/src/pty/` and `src-tauri/src/commands/pty_commands.rs` but is not wired up and has gaps (no child handle, no shell_program params). This will be replaced.

### Step 2: Switch Frontend to New IPC

- Add new functions to `tauriIpc.ts` (`ptyCreate`, `ptyWrite`, `ptyResize`, `ptyKill`)
- Switch `TerminalPane` to use new IPC (single `ptyCreate` instead of create+attach)
- Switch to Tauri Event listener for PTY output
- Disable daemon watchdog in `lib.rs` (comment out `start_daemon_watchdog`) to prevent stale events
- **Verify terminal works through new path**

### Step 3: Remove Daemon Code

- Delete daemon binary, client module, daemon commands
- Delete session commands, persistence module
- Delete `SessionPicker/` component, `DaemonStatusBanner/` component
- Remove saved tabs + `pendingSessionPick` from `tabStore.ts`
- Remove `DaemonSessionInfo` from `types/terminal.ts`
- Delete `app_state.rs`
- Remove splash screen (`splash.html`, splash window config, `app_ready`)
- Remove `App.tsx` daemon-status useEffect
- Simplify `lib.rs`

### Step 4: Cleanup & Verification

- Remove unused dependencies from `Cargo.toml` (base64, etc.)
- Remove splash window from `tauri.conf.json`, set main window `visible: true`
- Remove `externalBin` entry from `tauri.conf.json`
- Simplify `beforeDevCommand` / `beforeBuildCommand` (remove daemon build scripts)
- Delete `scripts/build-daemon-dev.mjs`, `scripts/build-daemon-release.mjs`
- Delete `src-tauri/binaries/` directory
- Build verification
- Full feature test: tabs, panel splits, broadcast, SSH, notes/todos/timer

## What This Enables

After Phase 1 completion:
- Significantly simpler codebase (daemon + TCP + protocol code removed)
- Faster app startup (no daemon spawn + connection wait)
- No splash screen needed
- Stable foundation for Phase 2 (Rust SSH + SFTP + Claude Code toolkit panels)

## Out of Scope (Phase 2)

- Rust-level SSH library (`russh`) integration
- SFTP channel support
- Claude Code toolkit panels (CLAUDE.md editor, Git diff watcher, token tracker)
- Remote file tree
- AI agent workflow optimization
