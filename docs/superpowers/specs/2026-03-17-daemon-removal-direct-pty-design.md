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
    sessions: Mutex<HashMap<String, PtySession>>,
}

struct PtySession {
    writer: Box<dyn Write + Send>,   // Write to PTY master
    pair: PtyPair,                    // For resize
    child: Box<dyn Child + Send>,     // For kill
}
```

### Tauri Commands

| Command | Role |
|---------|------|
| `pty_create` | Spawn PTY, return session ID. Starts reader thread that emits `pty-output-{id}` events. |
| `pty_write` | Write input bytes to PTY master (binary, no base64) |
| `pty_resize` | Resize PTY terminal dimensions |
| `pty_kill` | Kill child process + cleanup session |

### Simplified lib.rs

```rust
pub fn run() {
    let pty_manager = PtyManager::new();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
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
| `daemonCreateSession()` → TCP → daemon | `ptyCreate()` → Tauri IPC → PtyManager |
| `daemonWrite()` → base64 → TCP | `ptyWrite()` → Tauri IPC (binary) |
| `daemonResize()` → TCP | `ptyResize()` → Tauri IPC |
| `daemonKillSession()` → TCP | `ptyKill()` → Tauri IPC |
| `daemonAttach()` / `daemonDetach()` | **Removed** (no attach/detach concept) |
| `daemonListSessions()` | **Removed** (no sessions to restore) |

### TerminalPane Changes

- Receive PTY output via Tauri Event (`pty-output-{sessionId}`) instead of TCP stream
- Remove attach/detach logic — `ptyCreate` on mount, `ptyKill` on unmount
- Remove scrollback snapshot restore
- Remove base64 decoding

### Removed Components

| Component/Code | Reason |
|---|---|
| `src/components/SessionPicker/` | Session restore UI |
| Daemon status banner in `App.tsx` | No daemon to reconnect |
| `tabStore.ts` saved tabs (`savedTabs`, `saveAndRemoveTab`, `saveAllOpenTabsToBackground`) | No session persistence |

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

- Create `pty/manager.rs` with PtyManager struct
- Create `pty_commands.rs` with 4 commands
- Register alongside existing daemon commands in `lib.rs`
- Daemon still alive at this point

### Step 2: Switch Frontend to New IPC

- Add new functions to `tauriIpc.ts` (`ptyCreate`, `ptyWrite`, `ptyResize`, `ptyKill`)
- Switch `TerminalPane` to use new IPC
- Switch to Tauri Event listener for PTY output
- **Verify terminal works through new path**

### Step 3: Remove Daemon Code

- Delete daemon binary, client module, daemon commands
- Delete session commands, persistence module
- Delete `SessionPicker/` component
- Remove saved tabs from `tabStore.ts`
- Delete `app_state.rs`
- Remove splash screen (`splash.html`, splash window config, `app_ready`)
- Simplify `lib.rs`

### Step 4: Cleanup & Verification

- Remove unused dependencies from `Cargo.toml` (base64, etc.)
- Remove splash window from `tauri.conf.json`, set main window `visible: true`
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
