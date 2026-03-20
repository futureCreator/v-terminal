# Phase 1: Daemon Removal & Direct PTY Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the daemon-based PTY architecture and replace it with direct in-process PTY management via Tauri IPC.

**Architecture:** Replace the 3-hop path (React → Tauri IPC → TCP → Daemon → portable-pty) with a 2-hop path (React → Tauri IPC → PtyManager → portable-pty). PtyManager lives in the Tauri process, managed as Tauri State. Frontend communicates via `invoke()` commands and `listen()` events.

**Tech Stack:** Tauri 2, Rust, portable-pty 0.8, React 18, TypeScript, xterm.js 6, Zustand 4

---

## File Structure Overview

### Files to Create/Rewrite

| File | Responsibility |
|------|---------------|
| `src-tauri/src/pty/manager.rs` | Rewrite: PtyManager with child handle, shell params, kill_process_tree, kill_all |
| `src-tauri/src/pty/session.rs` | Rewrite: PtySession with child field |
| `src-tauri/src/commands/pty_commands.rs` | Rewrite: pty_create/write/resize/kill referencing PtyManager directly |
| `src-tauri/src/commands/wsl_commands.rs` | New: extract get_wsl_distros from daemon_commands |
| `src/lib/tauriIpc.ts` | Rewrite: replace daemon IPC with pty IPC |

### Files to Modify

| File | Change |
|------|--------|
| `src-tauri/src/lib.rs` | Simplify: remove daemon watchdog/splash, register PtyManager + new commands |
| `src-tauri/src/pty/mod.rs` | Keep as-is (already exports manager + session) |
| `src-tauri/src/commands/mod.rs` | Update exports: pty_commands + wsl_commands |
| `src-tauri/Cargo.toml` | Remove daemon binary, base64, dirs deps |
| `src-tauri/tauri.conf.json` | Remove splash window, externalBin, daemon build scripts; set visible: true |
| `src-tauri/nsis/preinstall.nsh` | Remove daemon taskkill line |
| `src/components/TerminalPane/TerminalPane.tsx` | Replace daemon IPC with pty IPC, remove attach/detach/resync |
| `src/App.tsx` | Remove SessionPicker, DaemonStatusBanner, daemon-status useEffect, saveAllOpenTabs |
| `src/store/tabStore.ts` | Remove savedTabs, saveAndRemoveTab, restoreSavedTab, saveAllOpenTabsToBackground, pendingSessionPick, resolveSessionPick |
| `src/types/terminal.ts` | Remove DaemonSessionInfo, SavedTab, SavedTabPanel, pendingSessionPick, existingSessionId |
| `src/components/TitleBar/TitleBar.tsx` | Remove daemon status indicator (dot + status text) |
| `src/components/TabBar/TabBar.tsx` | Remove savedTabs reference and background tray indicator |

### Files to Delete

| File | Reason |
|------|--------|
| `src-tauri/src/bin/daemon.rs` | Daemon binary |
| `src-tauri/src/daemon/` (entire dir) | Daemon client |
| `src-tauri/src/state/` (entire dir) | AppState + persistence |
| `src-tauri/src/commands/daemon_commands.rs` | Daemon-proxied commands |
| `src-tauri/src/commands/session_commands.rs` | Session save/restore |
| `public/splash.html` | Splash screen |
| `scripts/build-daemon-dev.mjs` | Daemon build script |
| `scripts/build-daemon-release.mjs` | Daemon build script |
| `src-tauri/binaries/` (entire dir) | Daemon binary artifacts |
| `src/components/SessionPicker/` (entire dir) | Session restore UI |
| `src/components/DaemonStatusBanner/` (entire dir) | Daemon status banner |

---

## Task 1: Rewrite PtySession and PtyManager (Rust)

**Files:**
- Rewrite: `src-tauri/src/pty/session.rs`
- Rewrite: `src-tauri/src/pty/manager.rs`

- [ ] **Step 1: Rewrite `src-tauri/src/pty/session.rs`**

Replace the entire file with:

```rust
use portable_pty::{Child, MasterPty};
use std::io::Write;
use tokio::task::JoinHandle;

pub struct PtySession {
    pub writer: Box<dyn Write + Send>,
    pub master: Box<dyn MasterPty + Send>,
    pub child: Box<dyn Child + Send + Sync>,
    pub _reader_task: JoinHandle<()>,
}

// Safety: all field access is serialized through PtyManager's std::sync::Mutex.
// portable-pty types are not Send on all platforms, but exclusive Mutex access
// guarantees no concurrent use.
unsafe impl Send for PtySession {}
```

- [ ] **Step 2: Rewrite `src-tauri/src/pty/manager.rs`**

Replace the entire file. Key changes from current version:
- Add `child` field storage (current version discards it as `_child`)
- Add `shell_program` / `shell_args` parameters to `create()`
- Add `kill_process_tree()` (ported from `daemon.rs:22-37`)
- Add `kill_all()` for app shutdown cleanup
- Add session limit (MAX_SESSIONS = 64)
- Move `wsl_distros_cache` into PtyManager
- Use `std::sync::Mutex` wrapping

```rust
use std::collections::HashMap;
use std::io::Write;
use std::sync::Mutex;

use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

use super::session::PtySession;

const MAX_SESSIONS: usize = 64;

pub struct PtyManager {
    sessions: Mutex<HashMap<String, PtySession>>,
    pub wsl_distros_cache: std::sync::OnceLock<Vec<String>>,
}

fn kill_process_tree(pid: u32) {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        let _ = std::process::Command::new("taskkill")
            .args(["/F", "/T", "/PID", &pid.to_string()])
            .creation_flags(0x08000000) // CREATE_NO_WINDOW
            .output();
    }
    #[cfg(not(windows))]
    {
        let _ = std::process::Command::new("kill")
            .args(["-9", &pid.to_string()])
            .output();
    }
}

impl PtyManager {
    pub fn new() -> Self {
        Self {
            sessions: Mutex::new(HashMap::new()),
            wsl_distros_cache: std::sync::OnceLock::new(),
        }
    }

    pub fn create(
        &self,
        app: AppHandle,
        cwd: String,
        cols: u16,
        rows: u16,
        shell_program: Option<String>,
        shell_args: Option<Vec<String>>,
    ) -> Result<String, String> {
        {
            let sessions = self.sessions.lock().map_err(|e| e.to_string())?;
            if sessions.len() >= MAX_SESSIONS {
                return Err(format!("session limit reached ({MAX_SESSIONS})"));
            }
        }

        let pty_id = Uuid::new_v4().to_string();

        let pty_system = native_pty_system();
        let pair = pty_system
            .openpty(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| format!("openpty failed: {e}"))?;

        let shell = shell_program.unwrap_or_else(|| {
            #[cfg(target_os = "windows")]
            {
                // Prefer PowerShell 7 → Windows PowerShell → cmd.exe
                std::env::var("COMSPEC").unwrap_or_else(|_| "cmd.exe".to_string())
            }
            #[cfg(not(target_os = "windows"))]
            {
                std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string())
            }
        });

        let mut cmd = CommandBuilder::new(&shell);
        if let Some(args) = &shell_args {
            for arg in args {
                cmd.arg(arg);
            }
        }
        cmd.cwd(&cwd);

        let child = pair
            .slave
            .spawn_command(cmd)
            .map_err(|e| format!("spawn failed: {e}"))?;

        let writer = pair
            .master
            .take_writer()
            .map_err(|e| format!("take_writer failed: {e}"))?;

        let mut reader = pair
            .master
            .try_clone_reader()
            .map_err(|e| format!("clone reader failed: {e}"))?;

        let task_app = app.clone();
        let task_id = pty_id.clone();
        let reader_task = tokio::task::spawn_blocking(move || {
            use std::io::Read;
            let mut buf = vec![0u8; 8192];
            loop {
                match reader.read(&mut buf) {
                    Ok(0) => break,
                    Ok(n) => {
                        let data: Vec<u8> = buf[..n].to_vec();
                        let _ = task_app.emit(
                            "pty-data",
                            serde_json::json!({
                                "ptyId": task_id,
                                "data": data,
                            }),
                        );
                    }
                    Err(_) => break,
                }
            }
            let _ = task_app.emit("pty-exit", serde_json::json!({ "ptyId": task_id }));
        });

        let session = PtySession {
            master: pair.master,
            writer,
            child,
            _reader_task: reader_task,
        };

        self.sessions
            .lock()
            .map_err(|e| e.to_string())?
            .insert(pty_id.clone(), session);

        Ok(pty_id)
    }

    pub fn write(&self, pty_id: &str, data: &[u8]) -> Result<(), String> {
        let mut sessions = self.sessions.lock().map_err(|e| e.to_string())?;
        if let Some(session) = sessions.get_mut(pty_id) {
            session
                .writer
                .write_all(data)
                .map_err(|e| format!("write failed: {e}"))?;
            Ok(())
        } else {
            Err(format!("PTY session not found: {pty_id}"))
        }
    }

    pub fn resize(&self, pty_id: &str, cols: u16, rows: u16) -> Result<(), String> {
        let sessions = self.sessions.lock().map_err(|e| e.to_string())?;
        if let Some(session) = sessions.get(pty_id) {
            session
                .master
                .resize(PtySize {
                    rows,
                    cols,
                    pixel_width: 0,
                    pixel_height: 0,
                })
                .map_err(|e| format!("resize failed: {e}"))?;
            Ok(())
        } else {
            Err(format!("PTY session not found: {pty_id}"))
        }
    }

    pub fn kill(&self, pty_id: &str) -> Result<(), String> {
        let mut sessions = self.sessions.lock().map_err(|e| e.to_string())?;
        if let Some(mut session) = sessions.remove(pty_id) {
            if let Some(pid) = session.child.process_id() {
                kill_process_tree(pid);
            }
            let _ = session.child.kill();
            Ok(())
        } else {
            Err(format!("PTY session not found: {pty_id}"))
        }
    }

    /// Kill all sessions — called on app shutdown.
    pub fn kill_all(&self) {
        if let Ok(mut sessions) = self.sessions.lock() {
            for (_, mut session) in sessions.drain() {
                if let Some(pid) = session.child.process_id() {
                    kill_process_tree(pid);
                }
                let _ = session.child.kill();
            }
        }
    }
}
```

- [ ] **Step 3: Verify Rust compiles**

Run: `cd /Users/handongho/.openclaw/workspace/projects/v-terminal/src-tauri && cargo check 2>&1 | head -20`

Note: Will have warnings about unused code since the new PtyManager isn't wired into commands yet. That's expected. Fix any errors only.

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/pty/session.rs src-tauri/src/pty/manager.rs
git commit -m "refactor: rewrite PtyManager with child handle, shell params, and kill_all"
```

---

## Task 2: Create pty_commands and wsl_commands (Rust)

**Files:**
- Rewrite: `src-tauri/src/commands/pty_commands.rs`
- Create: `src-tauri/src/commands/wsl_commands.rs`
- Modify: `src-tauri/src/commands/mod.rs`

- [ ] **Step 1: Rewrite `src-tauri/src/commands/pty_commands.rs`**

Replace the entire file. Key change: reference `PtyManager` directly instead of `AppState`:

```rust
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
```

- [ ] **Step 2: Create `src-tauri/src/commands/wsl_commands.rs`**

Extract from `daemon_commands.rs:8-47`:

```rust
use crate::pty::manager::PtyManager;

#[tauri::command]
pub fn get_wsl_distros(state: tauri::State<'_, PtyManager>) -> Result<Vec<String>, String> {
    #[cfg(windows)]
    {
        let cached = state.wsl_distros_cache.get_or_init(|| {
            let mut cmd = std::process::Command::new("wsl");
            cmd.args(["--list", "--quiet"]);
            {
                use std::os::windows::process::CommandExt;
                cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
            }
            let Ok(output) = cmd.output() else {
                return vec![];
            };

            let bytes = output.stdout;
            let text = if bytes.len() >= 2 && bytes[1] == 0 {
                let u16_chars: Vec<u16> = bytes
                    .chunks_exact(2)
                    .map(|c| u16::from_le_bytes([c[0], c[1]]))
                    .collect();
                String::from_utf16_lossy(&u16_chars).to_string()
            } else {
                String::from_utf8_lossy(&bytes).to_string()
            };

            text.lines()
                .map(|l| l.trim().trim_start_matches('\u{feff}').to_string())
                .filter(|l| !l.is_empty())
                .collect()
        });

        Ok(cached.clone())
    }
    #[cfg(not(windows))]
    {
        let _ = state;
        Ok(vec![])
    }
}
```

- [ ] **Step 3: Update `src-tauri/src/commands/mod.rs`**

Replace contents with:

```rust
pub mod daemon_commands;
pub mod session_commands;
pub mod pty_commands;
pub mod wsl_commands;
```

(Keep daemon_commands and session_commands for now — they'll be removed in Task 5.)

- [ ] **Step 4: Verify Rust compiles**

Run: `cd /Users/handongho/.openclaw/workspace/projects/v-terminal/src-tauri && cargo check 2>&1 | head -20`

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/commands/pty_commands.rs src-tauri/src/commands/wsl_commands.rs src-tauri/src/commands/mod.rs
git commit -m "feat: add pty_commands and wsl_commands for direct PTY management"
```

---

## Task 3: Wire PtyManager into lib.rs (Rust)

**Files:**
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Add PtyManager registration and new commands alongside existing daemon code**

In `src-tauri/src/lib.rs`, add to the top:

```rust
mod pty;
```

(This should be added alongside the existing `mod commands; mod daemon; mod state;`)

In the `run()` function, add PtyManager creation and registration:

```rust
pub fn run() {
    let app_state = AppState::new();
    let pty_manager = pty::manager::PtyManager::new();
    // ... existing builder ...
        .manage(app_state)
        .manage(pty_manager)
    // ... add to invoke_handler ...
        .invoke_handler(tauri::generate_handler![
            // existing daemon commands stay for now
            app_ready,
            daemon_commands::get_daemon_status,
            // ... all existing commands ...
            // NEW: add pty commands
            commands::pty_commands::pty_create,
            commands::pty_commands::pty_write,
            commands::pty_commands::pty_resize,
            commands::pty_commands::pty_kill,
            commands::wsl_commands::get_wsl_distros,
        ])
```

Also add the window close cleanup hook:

```rust
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                if window.label() == "main" {
                    let manager = window.state::<pty::manager::PtyManager>();
                    manager.kill_all();
                }
            }
        })
```

- [ ] **Step 2: Verify Rust compiles**

Run: `cd /Users/handongho/.openclaw/workspace/projects/v-terminal/src-tauri && cargo check 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/lib.rs
git commit -m "feat: register PtyManager and pty commands alongside daemon"
```

---

## Task 4: Switch Frontend to New IPC

**Files:**
- Rewrite: `src/lib/tauriIpc.ts`
- Modify: `src/components/TerminalPane/TerminalPane.tsx`

- [ ] **Step 1: Rewrite `src/lib/tauriIpc.ts`**

Replace the entire file. Remove all daemon-related functions, resync, and daemon-status. Keep the efficient single-listener dispatcher pattern:

```typescript
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export interface PtyDataPayload {
  ptyId: string;
  data: number[];
}

export interface PtyExitPayload {
  ptyId: string;
}

// Centralized per-pty event dispatchers.
// Single global listener per event type, dispatch in-process to per-pty handlers.
const ptyDataHandlers = new Map<string, (data: Uint8Array) => void>();
const ptyExitHandlers = new Map<string, () => void>();
let ptyDataUnlisten: UnlistenFn | null = null;
let ptyExitUnlisten: UnlistenFn | null = null;
let ptyDataListenerPromise: Promise<void> | null = null;
let ptyExitListenerPromise: Promise<void> | null = null;

async function ensurePtyDataListener(): Promise<void> {
  if (ptyDataUnlisten) return;
  if (!ptyDataListenerPromise) {
    ptyDataListenerPromise = listen<PtyDataPayload>("pty-data", (event) => {
      const { ptyId, data } = event.payload;
      ptyDataHandlers.get(ptyId)?.(new Uint8Array(data));
    }).then((unlisten) => { ptyDataUnlisten = unlisten; });
  }
  return ptyDataListenerPromise;
}

async function ensurePtyExitListener(): Promise<void> {
  if (ptyExitUnlisten) return;
  if (!ptyExitListenerPromise) {
    ptyExitListenerPromise = listen<PtyExitPayload>("pty-exit", (event) => {
      ptyExitHandlers.get(event.payload.ptyId)?.();
    }).then((unlisten) => { ptyExitUnlisten = unlisten; });
  }
  return ptyExitListenerPromise;
}

export const ipc = {
  async ptyCreate(
    cwd: string,
    cols: number,
    rows: number,
    shellProgram?: string,
    shellArgs?: string[],
  ): Promise<string> {
    return invoke<string>("pty_create", { cwd, cols, rows, shellProgram, shellArgs });
  },

  async ptyWrite(sessionId: string, data: Uint8Array): Promise<void> {
    return invoke("pty_write", { ptyId: sessionId, data: Array.from(data) });
  },

  async ptyResize(sessionId: string, cols: number, rows: number): Promise<void> {
    return invoke("pty_resize", { ptyId: sessionId, cols, rows });
  },

  async ptyKill(sessionId: string): Promise<void> {
    return invoke("pty_kill", { ptyId: sessionId });
  },

  async getWslDistros(): Promise<string[]> {
    return invoke<string[]>("get_wsl_distros");
  },

  /** Register a per-pty data handler. One global Tauri listener is shared across all panels. */
  async onPtyData(ptyId: string, handler: (data: Uint8Array) => void): Promise<() => void> {
    await ensurePtyDataListener();
    ptyDataHandlers.set(ptyId, handler);
    return () => { ptyDataHandlers.delete(ptyId); };
  },

  /** Register a per-pty exit handler. One global Tauri listener is shared across all panels. */
  async onPtyExit(ptyId: string, handler: () => void): Promise<() => void> {
    await ensurePtyExitListener();
    ptyExitHandlers.set(ptyId, handler);
    return () => { ptyExitHandlers.delete(ptyId); };
  },
};
```

- [ ] **Step 2: Update `src/components/TerminalPane/TerminalPane.tsx`**

Apply these changes throughout the file:

**2a. Remove `existingSessionId` prop** (line 30): Delete `existingSessionId?: string;` from `TerminalPaneProps` and the destructured props.

**2b. Remove daemon-status useEffect** (lines 96-106): Delete the entire `useEffect` that listens to `ipc.onDaemonStatus`.

**2c. Replace session init block** (lines 171-194). Replace the `daemonCreateSession` + `daemonAttach` two-step with single `ptyCreate`:

```typescript
      let ptyId: string;
      try {
        ptyId = await ipc.ptyCreate(cwd, cols, rows, shellProgram, shellArgs);
      } catch (e) {
        term.write(`\r\n\x1b[31mFailed to start session: ${e}\x1b[0m\r\n`);
        setLoading(false);
        return;
      }
```

(Removes: `existingSessionId` check, `daemonAttach`, scrollback restore)

**2d. Replace detach with kill on dispose** (lines 196-199, 329-333). In the disposed check after session creation:

```typescript
      if (disposed) {
        ipc.ptyKill(ptyId).catch(() => {});
        term.dispose();
        return;
      }
```

**2e. Replace SSH command execution** (line 209): Change `ipc.daemonWrite` to `ipc.ptyWrite`:

```typescript
      if (sshCommand) {
        ipc.ptyWrite(ptyId, encoder.encode(sshCommand + "\r")).catch(() => {});
      }
```

**2f. Replace all `ipc.daemonWrite` calls with `ipc.ptyWrite`** (lines 244, 248): In the `onData` handler:

```typescript
      term.onData((data) => {
        const encoded = encoder.encode(data);
        ipc.ptyWrite(ptyId, encoded).catch(() => {});
        if (broadcastRef.current) {
          for (const sibId of siblingsRef.current) {
            if (sibId !== ptyId) {
              ipc.ptyWrite(sibId, encoded).catch(() => {});
            }
          }
        }
      });
```

**2g. Remove resync listener** (lines 264-268): Delete `unlistenResync` declaration and `ipc.onPtyResync` registration. Also delete `unlistenResync?.()` in the cleanup.

**2h. Replace resize call** (line 289): Change `ipc.daemonResize` to `ipc.ptyResize`:

```typescript
ipc.ptyResize(ptyId, term.cols, term.rows).catch(() => {});
```

**2i. Replace cleanup detach with kill** (lines 328-333): In the effect cleanup:

```typescript
      const ptyId = ptyIdRef.current;
      if (ptyId) {
        terminalRegistry.delete(ptyId);
        ipc.ptyKill(ptyId).catch(() => {});
        ptyIdRef.current = null;
      }
```

**2j. Replace resize in font-change effect** (line 372): Change `ipc.daemonResize` to `ipc.ptyResize`:

```typescript
ipc.ptyResize(ptyId, term.cols, term.rows).catch(() => {});
```

- [ ] **Step 3: Update `ipc.daemonKillSession` calls in `src/App.tsx`**

Since `tauriIpc.ts` no longer exports daemon functions, App.tsx will fail to compile if not updated now. Change all `ipc.daemonKillSession` → `ipc.ptyKill`:

**3a.** `handleLayoutChange` (line 214):
```typescript
.forEach((p) => ipc.ptyKill(p.ptyId!).catch(() => {}));
```

**3b.** `handleTabKill` (line 866):
```typescript
.map((p) => ipc.ptyKill(p.ptyId!).catch(() => {}))
```

**3c.** `handleKillSavedTab` (line 883):
```typescript
.map((p) => ipc.ptyKill(p.ptyId as string).catch(() => {}))
```

- [ ] **Step 4: Disable daemon watchdog in lib.rs**

In `src-tauri/src/lib.rs`, comment out the `start_daemon_watchdog(app.handle().clone());` line in the `setup` closure. This prevents stale daemon-status events during testing.

- [ ] **Step 5: Verify build**

Run: `cd /Users/handongho/.openclaw/workspace/projects/v-terminal && pnpm build 2>&1 | tail -20`

This checks both TypeScript compilation and Rust compilation. Fix any errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/tauriIpc.ts src/components/TerminalPane/TerminalPane.tsx src/App.tsx src-tauri/src/lib.rs
git commit -m "feat: switch frontend to direct PTY IPC, bypass daemon"
```

---

## Task 5: Remove Daemon Code (Rust)

**Files:**
- Delete: `src-tauri/src/bin/daemon.rs`
- Delete: `src-tauri/src/daemon/` (entire directory)
- Delete: `src-tauri/src/state/` (entire directory)
- Delete: `src-tauri/src/commands/daemon_commands.rs`
- Delete: `src-tauri/src/commands/session_commands.rs`
- Modify: `src-tauri/src/commands/mod.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Delete daemon and state files**

```bash
rm src-tauri/src/bin/daemon.rs
rm -rf src-tauri/src/daemon/
rm -rf src-tauri/src/state/
rm src-tauri/src/commands/daemon_commands.rs
rm src-tauri/src/commands/session_commands.rs
```

- [ ] **Step 2: Update `src-tauri/src/commands/mod.rs`**

Replace contents with:

```rust
pub mod pty_commands;
pub mod wsl_commands;
```

- [ ] **Step 3: Simplify `src-tauri/src/lib.rs`**

Replace the entire file with:

```rust
mod commands;
mod pty;

use pty::manager::PtyManager;
use commands::{pty_commands, wsl_commands};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
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
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                if window.label() == "main" {
                    let manager = window.state::<PtyManager>();
                    manager.kill_all();
                }
            }
        })
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

- [ ] **Step 4: Remove daemon binary from `Cargo.toml`**

In `src-tauri/Cargo.toml`, remove the `[[bin]]` section (lines 13-15):

```toml
[[bin]]
name = "v-terminal-daemon"
path = "src/bin/daemon.rs"
```

Also remove unused dependencies:

```toml
base64 = "0.22"
dirs = "5"
url = "2"
```

- [ ] **Step 5: Verify Rust compiles**

Run: `cd /Users/handongho/.openclaw/workspace/projects/v-terminal/src-tauri && cargo check 2>&1 | head -20`

- [ ] **Step 6: Commit**

```bash
git add -A src-tauri/
git commit -m "refactor: remove daemon binary, client, state, and daemon commands"
```

---

## Task 6: Remove Daemon Frontend Components

**Files:**
- Delete: `src/components/SessionPicker/` (entire directory)
- Delete: `src/components/DaemonStatusBanner/` (entire directory)
- Modify: `src/types/terminal.ts`
- Modify: `src/store/tabStore.ts`
- Modify: `src/App.tsx`

- [ ] **Step 1: Delete SessionPicker and DaemonStatusBanner directories**

```bash
rm -rf src/components/SessionPicker/
rm -rf src/components/DaemonStatusBanner/
```

- [ ] **Step 2: Clean up `src/types/terminal.ts`**

Remove `DaemonSessionInfo`, `SavedTab`, `SavedTabPanel` types. Remove `existingSessionId` from `Panel`. Remove `pendingSessionPick` from `Tab`. The file becomes:

```typescript
export type Layout = 1 | 2 | 3 | 4 | "4c" | 6 | 9;

export interface Panel {
  id: string;
  ptyId: string | null;
  connection?: PanelConnection;
}

export interface Tab {
  id: string;
  label: string;
  cwd: string;
  layout: Layout;
  panels: Panel[];
  broadcastEnabled: boolean;
}

export interface SshProfile {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  identityFile?: string;
}

export interface PanelConnection {
  type: 'local' | 'ssh' | 'wsl';
  sshCommand?: string;
  shellProgram?: string;
  shellArgs?: string[];
  label?: string;
}
```

- [ ] **Step 3: Simplify `src/store/tabStore.ts`**

Remove all saved-tab and session-picker related code:

**3a.** Remove imports: `SavedTab` from types, `useNoteStore` (only used for saved tabs notes).

**3b.** Remove `SAVED_TABS_KEY`, `loadSavedTabs()`, `persistSavedTabs()` functions (lines 12-27).

**3c.** Remove from `TabStore` interface: `savedTabs`, `saveAndRemoveTab`, `removeSavedTab`, `restoreSavedTab`, `resolveSessionPick`, `saveAllOpenTabsToBackground`.

**3d.** Remove `savedTabs: loadSavedTabs()` from store initialization (line 99).

**3e.** Remove `pendingSessionPick: true` from `createDefaultTab()` (line 89) and `addTab()` (line 111).

**3f.** Replace `saveAndRemoveTab` with the simple `removeTab` behavior (delete the `saveAndRemoveTab` method entirely, lines 133-173).

**3g.** Remove `removeSavedTab` method (lines 175-180).

**3h.** Remove `restoreSavedTab` method (lines 182-231).

**3i.** Remove `resolveSessionPick` method (lines 344-365).

**3j.** Remove `saveAllOpenTabsToBackground` method (lines 367-396).

**3k.** In `switchPanelConnection` method (line 327), remove the `existingSessionId: undefined` assignment — the field no longer exists on `Panel`:

```typescript
? { ...p, connection, ptyId: null }
```

New tab creation: `addTab()` creates a tab with panels ready to use (no `pendingSessionPick`). The tab starts immediately as a local terminal. Users can switch to SSH/WSL via command palette or context menu after.

- [ ] **Step 4: Update `src/App.tsx`**

**4a.** Remove imports: `SessionPicker`, `SessionPickResult`, `DaemonStatusBanner`, `ipc` (only check — if ipc is still used for kill, keep it. Actually `ipc` is used for `daemonKillSession` in handleLayoutChange and handleTabKill — these need updating too).

**4b.** Remove from useTabStore destructuring: `savedTabs`, `saveAndRemoveTab`, `restoreSavedTab`, `resolveSessionPick`, `saveAllOpenTabsToBackground`.

**4c.** Remove the daemon-ready useEffect (lines 87-108 — the `appReady` / `onDaemonStatus` block).

**4d.** Remove the close-requested useEffect (lines 831-850 — `saveAllOpenTabsToBackground`).

**4e.** Remove `handleNewSession` (line 852-854), `handleRestoreTab` (lines 872-875), `handleKillSavedTab` (lines 877-887) functions.

**4f.** Update `handleLayoutChange` (line 214): Change `ipc.daemonKillSession` to `ipc.ptyKill`:

```typescript
removed
  .filter((p) => p.ptyId !== null)
  .forEach((p) => ipc.ptyKill(p.ptyId!).catch(() => {}));
```

**4g.** Update `handleCloseCurrentTab` (line 222): Change `saveAndRemoveTab` to `removeTab`:

```typescript
const handleCloseCurrentTab = useCallback(() => {
  if (activeTab) removeTab(activeTab.id);
}, [activeTab, removeTab]);
```

**4h.** Update `handleTabClose` (line 856): Change to use `removeTab`:

```typescript
const handleTabClose = (tabId: string) => {
  removeTab(tabId);
};
```

**4i.** Update `handleTabKill` (lines 860-870): Change `ipc.daemonKillSession` to `ipc.ptyKill`:

```typescript
const handleTabKill = async (tabId: string) => {
  const tab = tabs.find((t) => t.id === tabId);
  if (tab) {
    await Promise.all(
      tab.panels
        .filter((p) => p.ptyId !== null)
        .map((p) => ipc.ptyKill(p.ptyId!).catch(() => {}))
    );
  }
  removeTab(tabId);
};
```

**4j.** Replace `SessionPicker` / `PanelGrid` conditional render (lines 920-934). Remove the `pendingSessionPick` branch entirely — always render `PanelGrid`:

```tsx
{tabs.map((tab) => (
  <div
    key={tab.id}
    className="tab-viewport"
    style={{ display: tab.id === activeTabId ? "flex" : "none" }}
  >
    <PanelGrid
      tab={tab}
      isVisible={tab.id === activeTabId && !paletteOpen && !sshModalOpen && !settingsModalOpen}
      onActivePanelChanged={tab.id === activeTabId ? handleActivePanelChanged : undefined}
      navRef={tab.id === activeTabId ? panelNavRef : undefined}
    />
  </div>
))}
```

**4k.** Remove `<DaemonStatusBanner />` (line 958).

**4l.** Remove `backgroundTabsPaletteSection` from CommandPalette extraSections if it references savedTabs. Check the palette sections and remove any that reference `savedTabs`, `restoreSavedTab`, or `handleKillSavedTab`.

- [ ] **Step 5: Update `PanelGrid.tsx`**

Remove `existingSessionId` prop from `TerminalPane` rendering. Check `src/components/PanelGrid/PanelGrid.tsx` for `existingSessionId={panel.existingSessionId}` and remove it.

- [ ] **Step 6: Update `TitleBar.tsx`**

Remove daemon status indicator from `src/components/TitleBar/TitleBar.tsx`:
- Remove `ipc.getDaemonStatus()` and `ipc.onDaemonStatus()` calls
- Remove daemon connection state (`useState<"connected" | "reconnecting" | null>`)
- Remove the daemon dot / status indicator JSX
- Remove related CSS classes from `TitleBar.css` (`.daemon-indicator`, `.daemon-dot`, `.daemon-dot--connected`, etc.)

- [ ] **Step 7: Update `TabBar.tsx`**

Remove saved tabs / background tray from `src/components/TabBar/TabBar.tsx`:
- Remove `savedTabs` from `useTabStore()` destructuring
- Remove the background tray indicator button/badge that shows `savedTabs.length`
- Remove related CSS from `TabBar.css` if present (`.tabbar-bg-tray`, etc.)

- [ ] **Step 8: Verify TypeScript compiles**

Run: `cd /Users/handongho/.openclaw/workspace/projects/v-terminal && npx tsc --noEmit 2>&1 | head -30`

Fix any type errors.

- [ ] **Step 9: Commit**

```bash
git add -A src/
git commit -m "refactor: remove SessionPicker, DaemonStatusBanner, saved tabs, and session persistence"
```

---

## Task 7: Cleanup Config and Build Files

**Files:**
- Modify: `src-tauri/tauri.conf.json`
- Modify: `src-tauri/nsis/preinstall.nsh`
- Delete: `public/splash.html`
- Delete: `scripts/build-daemon-dev.mjs`
- Delete: `scripts/build-daemon-release.mjs`
- Delete: `src-tauri/binaries/` (entire directory)

- [ ] **Step 1: Update `src-tauri/tauri.conf.json`**

**1a.** Remove the splash window entry (lines 28-39).

**1b.** Set main window `"visible": true` (change from `false` on line 26).

**1c.** Simplify build commands — remove daemon build scripts:

```json
"beforeDevCommand": "pnpm dev",
"beforeBuildCommand": "pnpm build",
```

**1d.** Remove `externalBin` (line 56):

```json
"externalBin": [],
```

(Or remove the key entirely.)

- [ ] **Step 2: Update `src-tauri/nsis/preinstall.nsh`**

Remove the daemon taskkill line. Keep only v-terminal.exe:

```nsh
; Kill running processes before install/reinstall to prevent file-lock errors
!macro NSIS_HOOK_PREINSTALL
  nsExec::ExecToLog 'taskkill /F /IM v-terminal.exe /T'
  Sleep 1000
!macroend

; Kill running processes before uninstall to prevent file-lock errors
!macro NSIS_HOOK_PREUNINSTALL
  nsExec::ExecToLog 'taskkill /F /IM v-terminal.exe /T'
  Sleep 1000
!macroend
```

- [ ] **Step 3: Delete build artifacts and scripts**

```bash
rm public/splash.html
rm scripts/build-daemon-dev.mjs
rm scripts/build-daemon-release.mjs
rm -rf src-tauri/binaries/
```

- [ ] **Step 4: Verify full build**

Run: `cd /Users/handongho/.openclaw/workspace/projects/v-terminal/src-tauri && cargo check 2>&1 | head -20`

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: remove splash screen, daemon build scripts, and binary artifacts"
```

---

## Task 8: Final Verification

- [ ] **Step 1: Full Rust build**

Run: `cd /Users/handongho/.openclaw/workspace/projects/v-terminal/src-tauri && cargo build 2>&1 | tail -10`

- [ ] **Step 2: Full frontend build**

Run: `cd /Users/handongho/.openclaw/workspace/projects/v-terminal && pnpm build 2>&1 | tail -10`

- [ ] **Step 3: Verify no daemon references remain**

Run grep to check for leftover daemon references:

```bash
rg -i "daemon" --type rust --type ts src-tauri/src/ src/ --glob '!*.md' || echo "Clean"
```

(ripgrep's `ts` type includes `.tsx` files)

Any results should be in docs only, not in source code.

- [ ] **Step 4: Check for stale imports**

```bash
rg "SessionPicker|DaemonStatusBanner|DaemonSessionInfo|SavedTab|savedTabs|saveAndRemoveTab|saveAllOpenTabs|daemonCreate|daemonAttach|daemonDetach|daemonWrite|daemonResize|daemonKill|appReady|getDaemonStatus|onDaemonStatus|onPtyResync|pendingSessionPick|existingSessionId|resolveSessionPick" --type ts src/ || echo "Clean"
```

- [ ] **Step 5: Commit any final fixes**

If steps 3-4 found issues, fix and commit:

```bash
git add -A
git commit -m "chore: clean up remaining daemon references"
```
