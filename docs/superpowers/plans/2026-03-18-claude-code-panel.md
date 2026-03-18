# Claude Code Panel & Usage Bar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a left sidebar for CLAUDE.md editing with auto-discovery, a bottom usage bar showing Claude Code limits, and change the cheatsheet icon.

**Architecture:** Rust backend module `claude/` handles CWD detection (via PTY injection for WSL/SSH, Windows API for local), CLAUDE.md discovery/read/write (filesystem or SFTP), file watching, and usage data. React frontend adds `ClaudeCodePanel` (left sidebar) and `UsageBar` (bottom bar) with Zustand stores and Tauri IPC.

**Tech Stack:** Rust (russh-sftp, notify crate, windows-sys), TypeScript/React, CodeMirror 6, Zustand, Tauri IPC

**Spec:** `docs/superpowers/specs/2026-03-18-claude-code-panel-design.md`

---

## File Map

### Rust Backend — New Files
- `src-tauri/src/claude/mod.rs` — Module definition, shared types (`SessionType`, `ClaudeMdFile`, `ClaudeMdLevel`, `UsageData`)
- `src-tauri/src/claude/cwd_resolver.rs` — Per-session CWD detection (Windows API, PTY injection, SFTP)
- `src-tauri/src/claude/claude_md.rs` — CLAUDE.md file discovery, read, write (local fs + SFTP)
- `src-tauri/src/claude/file_watcher.rs` — File change detection (notify crate for local, SFTP stat polling for SSH)
- `src-tauri/src/claude/usage.rs` — Claude Code usage data reading
- `src-tauri/src/commands/claude_commands.rs` — Tauri command handlers for all claude/ operations

### Rust Backend — Modified Files
- `src-tauri/src/session/mod.rs` — Add `SessionType` enum, `session_type()` and `connection_id()` to Session trait
- `src-tauri/src/session/local_session.rs` — Implement new trait methods, store session type (local vs WSL)
- `src-tauri/src/session/ssh_session.rs` — Implement new trait methods, add OSC 7337 parser to reader task
- `src-tauri/src/session/local_session.rs` — Add OSC 7337 parser to reader task (for WSL sessions)
- `src-tauri/src/session/manager.rs` — Add methods to expose session type/connection info and SFTP access
- `src-tauri/src/commands/mod.rs` — Register `claude_commands` module
- `src-tauri/src/lib.rs` — Register new Tauri commands in invoke_handler
- `src-tauri/Cargo.toml` — Add `notify` and `windows-sys` dependencies

### Frontend — New Files
- `src/lib/codemirrorSetup.ts` — Shared CodeMirror 6 config (theme, markdown extensions, highlight styles)
- `src/store/claudeCodeStore.ts` — CLAUDE.md state management (tracked session, files, loading)
- `src/store/usageStore.ts` — Usage data state management (polling, entries)
- `src/components/ClaudeCodePanel/ClaudeCodePanel.tsx` — Left sidebar container with tab bar
- `src/components/ClaudeCodePanel/ClaudeMdTab.tsx` — CLAUDE.md discovery + accordion file list
- `src/components/ClaudeCodePanel/ClaudeMdEditor.tsx` — Single CLAUDE.md file editor (CodeMirror 6)
- `src/components/ClaudeCodePanel/ContextIndicator.tsx` — Session context display (type + CWD)
- `src/components/ClaudeCodePanel/ClaudeCodePanel.css` — Styles for left sidebar
- `src/components/UsageBar/UsageBar.tsx` — Bottom usage bar container
- `src/components/UsageBar/UsageGauge.tsx` — Per-account gauge component
- `src/components/UsageBar/UsageBar.css` — Styles for bottom bar
- `src/components/UsageBar/UsageDetailPopover.tsx` — Click-to-expand detail popover (DEFERRED: implement after usage data format is known)

### Frontend — Modified Files
- `src/components/NotePanel/NoteEditor.tsx` — Import shared CodeMirror setup instead of inline definitions
- `src/components/SidePanel/SidePanel.tsx` — Replace cheatsheet icon SVG with `</>`
- `src/lib/tauriIpc.ts` — Add IPC methods for claude commands + event listeners
- `src/App.tsx` — Add left panel state, keyboard shortcut, command palette entry, layout changes
- `src/App.css` — Add layout rules for left panel and bottom bar

---

## Task 1: Cheatsheet Icon Change

**Files:**
- Modify: `src/components/SidePanel/SidePanel.tsx:59-62`
- Modify: `src/App.tsx:598-605`

- [ ] **Step 1: Replace cheatsheet icon in SidePanel.tsx**

In `src/components/SidePanel/SidePanel.tsx`, replace lines 59-62 (the cheatsheet tab button SVG) with the `</>` code bracket icon:

```tsx
<svg width="15" height="15" viewBox="0 0 15 15" fill="none">
  <path d="M5.5 3.5L2.5 7.5l3 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
  <path d="M9.5 3.5l3 4-3 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
</svg>
```

- [ ] **Step 2: Replace cheatsheet icon in App.tsx command palette**

In `src/App.tsx`, the `cheatsheetPaletteSection` (around line 598-605) defines a `cheatsheetIcon`. Replace its SVG content with the same `</>` icon:

```tsx
const cheatsheetIcon = (
  <span className="cp-cmd-icon">
    <svg width="14" height="14" viewBox="0 0 15 15" fill="none">
      <path d="M5.5 3.5L2.5 7.5l3 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M9.5 3.5l3 4-3 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  </span>
);
```

- [ ] **Step 3: Visual verification**

Run the app with `npm run tauri dev` (or the project's dev command). Open the right sidebar and verify the cheatsheet tab icon now shows `</>` instead of the document+lines icon. Also open command palette (`Ctrl+K`) and verify the cheatsheet section icon matches.

- [ ] **Step 4: Commit**

```bash
git add src/components/SidePanel/SidePanel.tsx src/App.tsx
git commit -m "fix: replace cheatsheet icon with </> code bracket to avoid notes icon conflict"
```

---

## Task 2: Session Trait Extensions

**Files:**
- Modify: `src-tauri/src/session/mod.rs`
- Modify: `src-tauri/src/session/local_session.rs`
- Modify: `src-tauri/src/session/ssh_session.rs`
- Modify: `src-tauri/src/commands/session_commands.rs`

- [ ] **Step 1: Add SessionType enum and trait methods to mod.rs**

Replace the entire contents of `src-tauri/src/session/mod.rs`:

```rust
pub mod local_session;
pub mod manager;
pub mod ssh_pool;
pub mod ssh_session;

use async_trait::async_trait;

/// Distinguishes session types for CWD resolution routing.
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "lowercase")]
pub enum SessionType {
    Local,
    Wsl,
    Ssh,
}

/// Unified session interface for local PTY and SSH shell sessions.
#[async_trait]
pub trait Session: Send + Sync {
    async fn write(&self, data: &[u8]) -> Result<(), String>;
    async fn resize(&self, cols: u16, rows: u16) -> Result<(), String>;
    async fn kill(&self) -> Result<(), String>;
    fn session_type(&self) -> SessionType;
    fn connection_id(&self) -> Option<String> {
        None
    }
}
```

- [ ] **Step 2: Update LocalSession to store and return session type**

In `src-tauri/src/session/local_session.rs`, add a `session_type` field to the struct and implement the new trait methods.

Add field to struct (after `_reader_task`):
```rust
pub struct LocalSession {
    writer: StdMutex<Box<dyn Write + Send>>,
    master: Box<dyn MasterPty + Send>,
    child: StdMutex<Box<dyn Child + Send + Sync>>,
    _reader_task: JoinHandle<()>,
    session_kind: super::SessionType,
}
```

Update `create()` to accept and store session type. Add parameter `session_type: super::SessionType` after `shell_args`. Store it in the struct:
```rust
Ok(Self {
    master: pair.master,
    writer: StdMutex::new(writer),
    child: StdMutex::new(child),
    _reader_task: reader_task,
    session_kind: session_type,
})
```

Add trait method implementations to `impl Session for LocalSession`:
```rust
fn session_type(&self) -> super::SessionType {
    self.session_kind
}
```

- [ ] **Step 3: Update SshSession to implement new trait methods**

In `src-tauri/src/session/ssh_session.rs`, add trait method implementations to `impl Session for SshSession`:

```rust
fn session_type(&self) -> super::SessionType {
    super::SessionType::Ssh
}

fn connection_id(&self) -> Option<String> {
    Some(self.connection_id.clone())
}
```

- [ ] **Step 4: Update SessionManager.create_local to pass session type**

In `src-tauri/src/session/manager.rs`, update `create_local()` to accept `session_type: super::SessionType` parameter and pass it to `LocalSession::create`:

Add parameter to function signature:
```rust
pub async fn create_local(
    &self,
    app: AppHandle,
    cwd: String,
    cols: u16,
    rows: u16,
    shell_program: Option<String>,
    shell_args: Option<Vec<String>>,
    session_type: super::SessionType,
) -> Result<SessionCreateResult, String> {
```

Pass to LocalSession::create:
```rust
let session =
    LocalSession::create(app, session_id.clone(), &cwd, cols, rows, shell_program, shell_args, session_type)?;
```

- [ ] **Step 5: Update session_create command to pass session type**

In `src-tauri/src/commands/session_commands.rs`, update the `session_create` function to route the type string to `SessionType`:

```rust
use crate::session::SessionType;

// In the match block:
match r#type.as_str() {
    "local" => state.create_local(app, cwd, cols, rows, shell_program, shell_args, SessionType::Local).await,
    "wsl" => state.create_local(app, cwd, cols, rows, shell_program, shell_args, SessionType::Wsl).await,
    "ssh" => {
        let ssh = ssh.ok_or("ssh params required for type 'ssh'")?;
        state.create_ssh(app, ssh.host, ssh.port, ssh.username, ssh.identity_file, cols, rows).await
    }
    other => Err(format!("unknown session type: {other}")),
}
```

- [ ] **Step 6: Add session info query method to SessionManager**

In `src-tauri/src/session/manager.rs`, add a method to query session type and connection_id without consuming the session:

```rust
pub async fn get_session_info(&self, session_id: &str) -> Result<(super::SessionType, Option<String>), String> {
    let sessions = self.sessions.lock().await;
    let session = sessions
        .get(session_id)
        .ok_or_else(|| format!("session not found: {session_id}"))?;
    Ok((session.session_type(), session.connection_id()))
}
```

Also add a method to get SFTP session for a connection:
```rust
pub async fn open_sftp(&self, connection_id: &str) -> Result<russh_sftp::client::SftpSession, String> {
    let mut pool = self.ssh_pool.lock().await;
    pool.open_sftp(connection_id).await
}
```

- [ ] **Step 7: Verify compilation**

```bash
cd src-tauri && cargo check
```

Expected: no errors. If there are errors, fix them before proceeding.

- [ ] **Step 8: Commit**

```bash
git add src-tauri/src/session/ src-tauri/src/commands/session_commands.rs
git commit -m "feat: add session_type() and connection_id() to Session trait"
```

---

## Task 3: Backend Claude Module — Types & CWD Resolution

**Files:**
- Create: `src-tauri/src/claude/mod.rs`
- Create: `src-tauri/src/claude/cwd_resolver.rs`
- Modify: `src-tauri/src/lib.rs` (add `mod claude;`)
- Modify: `src-tauri/Cargo.toml` (add dependencies)

- [ ] **Step 1: Add dependencies to Cargo.toml**

Add `notify` to the `[dependencies]` section of `src-tauri/Cargo.toml`:

```toml
notify = "7"
```

Also add `windows-sys` for Windows CWD detection (conditional):
```toml
[target.'cfg(windows)'.dependencies]
windows-sys = { version = "0.59", features = ["Win32_System_Threading", "Win32_System_Diagnostics_Debug", "Win32_Foundation"] }
```

- [ ] **Step 2: Create claude/mod.rs with shared types**

Create `src-tauri/src/claude/mod.rs`:

```rust
pub mod cwd_resolver;
pub mod claude_md;
pub mod file_watcher;
pub mod usage;

use serde::Serialize;

/// Level classification for discovered CLAUDE.md files.
#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ClaudeMdLevel {
    User,
    Project,
    Directory,
    Parent,
}

/// A discovered CLAUDE.md file with metadata.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClaudeMdFile {
    pub path: String,
    pub level: ClaudeMdLevel,
    pub content: String,
    pub last_modified: u64,
    pub readonly: bool,
}

/// Claude Code usage data for an account.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UsageData {
    pub plan: String,
    pub used_percent: f64,
    pub reset_at: Option<u64>,
}
```

- [ ] **Step 3: Create cwd_resolver.rs — Local Windows CWD detection**

Create `src-tauri/src/claude/cwd_resolver.rs`:

```rust
use crate::session::SessionType;
use crate::session::manager::SessionManager;

/// Resolves the current working directory for a given session.
/// - Local (Windows): reads CWD from child process PEB via Windows API
/// - WSL/SSH: uses PTY injection (handled by frontend triggering write + parsing OSC response)
pub async fn resolve_cwd(
    manager: &SessionManager,
    session_id: &str,
) -> Result<CwdResult, String> {
    let (session_type, _connection_id) = manager.get_session_info(session_id).await?;

    match session_type {
        SessionType::Local => resolve_local_cwd(manager, session_id).await,
        SessionType::Wsl | SessionType::Ssh => {
            // For WSL and SSH, CWD is resolved via PTY injection from the frontend.
            // The frontend writes a marker command to the PTY, the backend reader
            // intercepts the OSC 7337 response and emits a "session-cwd" event.
            // This function triggers the injection; the result comes asynchronously.
            trigger_pty_cwd_injection(manager, session_id).await
        }
    }
}

#[derive(Debug, serde::Serialize)]
#[serde(tag = "type", content = "value", rename_all = "camelCase")]
pub enum CwdResult {
    /// CWD resolved immediately (local sessions on Windows)
    Resolved(String),
    /// CWD will be sent asynchronously via "session-cwd" event (WSL/SSH)
    Pending,
}

/// Trigger PTY injection to get CWD from WSL or SSH session.
/// Writes a space-prefixed echo command with OSC 7337 marker.
async fn trigger_pty_cwd_injection(
    manager: &SessionManager,
    session_id: &str,
) -> Result<CwdResult, String> {
    // Space prefix avoids shell history recording.
    // The OSC 7337 sequence will be intercepted by the frontend before reaching xterm.js.
    let cmd = b" echo -e \"\\x1b]7337;cwd;$(pwd)\\x07\"\r";
    manager.write(session_id, cmd).await?;
    Ok(CwdResult::Pending)
}

/// Resolve CWD for a local Windows session using the child process PID.
#[cfg(windows)]
async fn resolve_local_cwd(
    _manager: &SessionManager,
    _session_id: &str,
) -> Result<CwdResult, String> {
    // TODO: Implement Windows CWD detection via NtQueryInformationProcess
    // For now, return the session's initial CWD stored at creation time.
    // This will be enhanced in a future iteration.
    Err("local CWD detection not yet implemented on Windows".to_string())
}

#[cfg(not(windows))]
async fn resolve_local_cwd(
    _manager: &SessionManager,
    _session_id: &str,
) -> Result<CwdResult, String> {
    // On non-Windows (macOS/Linux dev), local sessions can use /proc/PID/cwd
    // or the same PTY injection approach.
    // For development, fall back to PTY injection.
    Err("local CWD detection: use PTY injection on non-Windows".to_string())
}
```

- [ ] **Step 4: Register claude module in lib.rs**

In `src-tauri/src/lib.rs`, add `mod claude;` after the existing module declarations:

```rust
mod commands;
mod session;
mod claude;
```

- [ ] **Step 5: Verify compilation**

```bash
cd src-tauri && cargo check
```

Note: `claude_md.rs`, `file_watcher.rs`, and `usage.rs` don't exist yet but are declared in `mod.rs`. Create empty stub files:

```rust
// src-tauri/src/claude/claude_md.rs
// CLAUDE.md discovery, read, write operations
// Implemented in Task 4.

// src-tauri/src/claude/file_watcher.rs
// File change detection
// Implemented in Task 5.

// src-tauri/src/claude/usage.rs
// Usage data reading
// Implemented in Task 10.
```

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/claude/ src-tauri/src/lib.rs src-tauri/Cargo.toml
git commit -m "feat: add claude module with types and CWD resolver skeleton"
```

---

## Task 3b: Backend — OSC 7337 CWD Parser in Session Readers

**Files:**
- Modify: `src-tauri/src/session/ssh_session.rs`
- Modify: `src-tauri/src/session/local_session.rs`

This task adds the OSC 7337 sequence parser to both session reader tasks. When the CWD resolver injects ` echo -e "\x1b]7337;cwd;$(pwd)\x07"` into the PTY, the reader intercepts the response and emits a `session-cwd` Tauri event instead of forwarding it to xterm.js.

- [ ] **Step 1: Create shared OSC parser utility**

Add a helper function in `src-tauri/src/claude/mod.rs` (or `cwd_resolver.rs`) to scan byte output for the OSC 7337 marker:

```rust
/// Scan a byte buffer for the OSC 7337 CWD marker sequence.
/// Returns (filtered_data, Option<cwd_string>).
/// The marker format is: \x1b]7337;cwd;<path>\x07
pub fn extract_osc_cwd(data: &[u8]) -> (Vec<u8>, Option<String>) {
    let marker_start = b"\x1b]7337;cwd;";
    let marker_end = b"\x07";

    // Search for marker in data
    if let Some(start_pos) = find_subsequence(data, marker_start) {
        let cwd_start = start_pos + marker_start.len();
        if let Some(end_offset) = find_subsequence(&data[cwd_start..], marker_end) {
            let cwd_bytes = &data[cwd_start..cwd_start + end_offset];
            let cwd = String::from_utf8_lossy(cwd_bytes).to_string();

            // Build filtered data (everything except the OSC sequence)
            let mut filtered = Vec::with_capacity(data.len());
            filtered.extend_from_slice(&data[..start_pos]);
            filtered.extend_from_slice(&data[cwd_start + end_offset + marker_end.len()..]);

            return (filtered, Some(cwd));
        }
    }

    (data.to_vec(), None)
}

fn find_subsequence(haystack: &[u8], needle: &[u8]) -> Option<usize> {
    haystack.windows(needle.len()).position(|w| w == needle)
}
```

- [ ] **Step 2: Update SshSession reader to intercept OSC 7337**

In `src-tauri/src/session/ssh_session.rs`, modify the reader task inside `create()`. In the `ChannelMsg::Data` and `ChannelMsg::ExtendedData` match arms, filter through `extract_osc_cwd` before emitting:

```rust
Some(ChannelMsg::Data { ref data }) => {
    let bytes: Vec<u8> = data.to_vec();
    let (filtered, cwd) = crate::claude::extract_osc_cwd(&bytes);
    if let Some(cwd_path) = cwd {
        let _ = task_app.emit(
            "session-cwd",
            serde_json::json!({"sessionId": task_session_id, "cwd": cwd_path}),
        );
    }
    if !filtered.is_empty() {
        let _ = task_app.emit(
            "session-data",
            serde_json::json!({"sessionId": task_session_id, "data": filtered}),
        );
    }
}
```

Apply the same pattern to the `ExtendedData` arm.

- [ ] **Step 3: Update LocalSession reader to intercept OSC 7337**

In `src-tauri/src/session/local_session.rs`, modify the reader task's `spawn_blocking` closure. After reading bytes, filter through `extract_osc_cwd`:

```rust
Ok(n) => {
    let raw_data: Vec<u8> = buf[..n].to_vec();
    let (filtered, cwd) = crate::claude::extract_osc_cwd(&raw_data);
    if let Some(cwd_path) = cwd {
        let _ = task_app.emit(
            "session-cwd",
            serde_json::json!({"sessionId": task_id, "cwd": cwd_path}),
        );
    }
    if !filtered.is_empty() {
        let _ = task_app.emit(
            "session-data",
            serde_json::json!({"sessionId": task_id, "data": filtered}),
        );
    }
}
```

- [ ] **Step 4: Verify compilation**

```bash
cd src-tauri && cargo check
```

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/session/ssh_session.rs src-tauri/src/session/local_session.rs src-tauri/src/claude/mod.rs
git commit -m "feat: add OSC 7337 CWD parser to session readers for PTY-based CWD detection"
```

---

## Task 4: Backend — CLAUDE.md Discovery, Read, Write

**Files:**
- Create/Replace: `src-tauri/src/claude/claude_md.rs`
- Modify: `src-tauri/src/session/manager.rs` (expose SFTP for claude operations)

- [ ] **Step 1: Implement claude_md.rs — local filesystem operations**

Replace `src-tauri/src/claude/claude_md.rs` with:

```rust
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

use super::{ClaudeMdFile, ClaudeMdLevel};

/// Discover all CLAUDE.md files for a given CWD on the local filesystem.
/// Returns files in Claude Code's loading order.
pub fn discover_local(cwd: &str) -> Result<Vec<ClaudeMdFile>, String> {
    let mut files = Vec::new();
    let cwd_path = PathBuf::from(cwd);

    // 1. User-level: ~/.claude/CLAUDE.md
    if let Some(home) = dirs::home_dir() {
        let user_path = home.join(".claude").join("CLAUDE.md");
        if let Some(f) = read_local_claude_md(&user_path, ClaudeMdLevel::User) {
            files.push(f);
        }
    }

    // 2. Walk from CWD up to root, collecting CLAUDE.md files
    let mut project_root: Option<PathBuf> = None;
    let mut current = cwd_path.clone();
    let mut parent_files: Vec<(PathBuf, ClaudeMdFile)> = Vec::new();
    loop {
        // Check for .git to detect project root
        if project_root.is_none() && current.join(".git").exists() {
            project_root = Some(current.clone());
        }

        let claude_md = current.join("CLAUDE.md");
        if claude_md.exists() {
            // Level will be assigned after walk completes (once project root is known)
            if let Some(f) = read_local_claude_md(&claude_md, ClaudeMdLevel::Parent) {
                parent_files.push((current.clone(), f));
            }
        }

        if !current.pop() {
            break;
        }
    }

    // Assign correct levels now that project root is known
    let root = project_root.clone().unwrap_or(cwd_path.clone());
    for (dir, file) in &mut parent_files {
        if *dir == root {
            file.level = ClaudeMdLevel::Project;
        }
        // Everything else stays as Parent
    }

    // Reverse so parent files go from root → CWD (outer first)
    parent_files.reverse();
    files.extend(parent_files.into_iter().map(|(_, f)| f));

    // 3. <project-root>/.claude/CLAUDE.md
    let root = project_root.unwrap_or(cwd_path);
    let dir_level_path = root.join(".claude").join("CLAUDE.md");
    if dir_level_path.exists() {
        if let Some(f) = read_local_claude_md(&dir_level_path, ClaudeMdLevel::Directory) {
            // Avoid duplicate if already found in walk
            if !files.iter().any(|existing| existing.path == f.path) {
                files.push(f);
            }
        }
    }

    Ok(files)
}

/// Read a single CLAUDE.md file from local filesystem.
fn read_local_claude_md(path: &Path, level: ClaudeMdLevel) -> Option<ClaudeMdFile> {
    let content = std::fs::read_to_string(path).ok()?;
    let metadata = std::fs::metadata(path).ok()?;
    let mtime = metadata
        .modified()
        .ok()?
        .duration_since(UNIX_EPOCH)
        .ok()?
        .as_secs();
    let readonly = metadata.permissions().readonly();

    Some(ClaudeMdFile {
        path: path.to_string_lossy().to_string(),
        level,
        content,
        last_modified: mtime,
        readonly,
    })
}

/// Read a single CLAUDE.md file by path (local).
pub fn read_local(path: &str) -> Result<ClaudeMdFile, String> {
    let p = Path::new(path);
    read_local_claude_md(p, ClaudeMdLevel::Project)
        .ok_or_else(|| format!("failed to read: {path}"))
}

/// Write content to a CLAUDE.md file (local).
/// If expected_mtime is provided, checks that the file hasn't been modified externally.
pub fn write_local(path: &str, content: &str, expected_mtime: Option<u64>) -> Result<(), String> {
    let p = Path::new(path);

    // Optimistic concurrency check
    if let Some(expected) = expected_mtime {
        if let Ok(metadata) = std::fs::metadata(p) {
            if let Ok(modified) = metadata.modified() {
                if let Ok(duration) = modified.duration_since(UNIX_EPOCH) {
                    let current_mtime = duration.as_secs();
                    if current_mtime != expected {
                        return Err("{\"code\":\"CONFLICT\",\"message\":\"file modified externally\"}".to_string());
                    }
                }
            }
        }
    }

    // Create parent directories if needed (for new files)
    if let Some(parent) = p.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("failed to create directory: {e}"))?;
    }

    std::fs::write(p, content).map_err(|e| format!("write failed: {e}"))
}

/// Discover CLAUDE.md files on a remote host via SFTP.
pub async fn discover_sftp(
    sftp: &russh_sftp::client::SftpSession,
    cwd: &str,
    home_dir: &str,
) -> Result<Vec<ClaudeMdFile>, String> {
    let mut files = Vec::new();

    // 1. User-level: ~/.claude/CLAUDE.md
    let user_path = format!("{home_dir}/.claude/CLAUDE.md");
    if let Some(f) = read_sftp_claude_md(sftp, &user_path, ClaudeMdLevel::User).await {
        files.push(f);
    }

    // 2. Walk from CWD up to root
    let mut project_root: Option<String> = None;
    let mut current = cwd.to_string();
    let mut parent_files = Vec::new();
    loop {
        // Check for .git
        if project_root.is_none() {
            let git_path = format!("{current}/.git");
            if sftp_exists(sftp, &git_path).await {
                project_root = Some(current.clone());
            }
        }

        let claude_md = format!("{current}/CLAUDE.md");
        let level = if current == cwd {
            ClaudeMdLevel::Project
        } else {
            ClaudeMdLevel::Parent
        };
        if let Some(f) = read_sftp_claude_md(sftp, &claude_md, level).await {
            parent_files.push(f);
        }

        // Pop to parent
        match current.rfind('/') {
            Some(0) if current.len() > 1 => {
                current = "/".to_string();
            }
            Some(pos) if pos > 0 => {
                current.truncate(pos);
            }
            _ => break,
        }
    }
    parent_files.reverse();
    files.extend(parent_files);

    // 3. <project-root>/.claude/CLAUDE.md
    let root = project_root.unwrap_or_else(|| cwd.to_string());
    let dir_path = format!("{root}/.claude/CLAUDE.md");
    if let Some(f) = read_sftp_claude_md(sftp, &dir_path, ClaudeMdLevel::Directory).await {
        if !files.iter().any(|existing| existing.path == f.path) {
            files.push(f);
        }
    }

    Ok(files)
}

/// Read a single file via SFTP.
async fn read_sftp_claude_md(
    sftp: &russh_sftp::client::SftpSession,
    path: &str,
    level: ClaudeMdLevel,
) -> Option<ClaudeMdFile> {
    use russh_sftp::protocol::OpenFlags;

    let file = sftp
        .open_with_flags(path, OpenFlags::READ)
        .await
        .ok()?;
    let data = sftp.read(&file, 0, 1024 * 1024) // max 1MB
        .await
        .ok()?;
    sftp.close(file).await.ok()?;

    let content = String::from_utf8(data).ok()?;
    let attrs = sftp.metadata(path).await.ok()?;
    let mtime = attrs.mtime.unwrap_or(0) as u64;

    Some(ClaudeMdFile {
        path: path.to_string(),
        level,
        content,
        last_modified: mtime,
        readonly: false, // SFTP doesn't easily expose permissions; assume writable
    })
}

/// Write content to a remote file via SFTP with optional mtime check.
pub async fn write_sftp(
    sftp: &russh_sftp::client::SftpSession,
    path: &str,
    content: &str,
    expected_mtime: Option<u64>,
) -> Result<(), String> {
    use russh_sftp::protocol::OpenFlags;

    // Optimistic concurrency check
    if let Some(expected) = expected_mtime {
        if let Ok(attrs) = sftp.metadata(path).await {
            let current_mtime = attrs.mtime.unwrap_or(0) as u64;
            if current_mtime != expected {
                return Err("{\"code\":\"CONFLICT\",\"message\":\"file modified externally\"}".to_string());
            }
        }
    }

    let file = sftp
        .open_with_flags(path, OpenFlags::WRITE | OpenFlags::CREATE | OpenFlags::TRUNCATE)
        .await
        .map_err(|e| format!("sftp open for write failed: {e}"))?;
    sftp.write(&file, 0, content.as_bytes())
        .await
        .map_err(|e| format!("sftp write failed: {e}"))?;
    sftp.close(file)
        .await
        .map_err(|e| format!("sftp close failed: {e}"))?;
    Ok(())
}

/// Check if a path exists on the remote via SFTP.
async fn sftp_exists(sftp: &russh_sftp::client::SftpSession, path: &str) -> bool {
    sftp.metadata(path).await.is_ok()
}
```

**Note:** The exact SFTP API calls (`open_with_flags`, `read`, `write`, `close`, `metadata`) depend on the `russh-sftp 2.0` crate's actual API. The implementer MUST check `russh-sftp` docs and adjust method names/signatures as needed. The patterns above show the intent; exact API may differ.

- [ ] **Step 2: Verify compilation**

```bash
cd src-tauri && cargo check
```

Fix any `russh-sftp` API mismatches. Consult `russh-sftp` docs/source for the correct method signatures.

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/claude/claude_md.rs
git commit -m "feat: implement CLAUDE.md discovery, read, write for local and SFTP"
```

---

## Task 5: Backend — File Watcher

**Files:**
- Create/Replace: `src-tauri/src/claude/file_watcher.rs`

- [ ] **Step 1: Implement file_watcher.rs**

Replace `src-tauri/src/claude/file_watcher.rs`:

```rust
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;

use notify::{RecommendedWatcher, Watcher, RecursiveMode, EventKind};
use tauri::{AppHandle, Emitter};
use tokio::sync::Mutex;
use tokio::task::JoinHandle;

/// Manages file watchers for CLAUDE.md files.
/// Local/WSL: uses `notify` crate for filesystem events.
/// SSH: uses periodic SFTP stat polling (30s interval).
pub struct ClaudeMdWatcher {
    app: AppHandle,
    /// Local filesystem watcher (shared across all local sessions)
    local_watcher: Option<RecommendedWatcher>,
    /// Paths currently watched locally
    local_paths: Vec<PathBuf>,
    /// SSH polling tasks keyed by session_id
    ssh_poll_tasks: HashMap<String, JoinHandle<()>>,
}

impl ClaudeMdWatcher {
    pub fn new(app: AppHandle) -> Self {
        Self {
            app,
            local_watcher: None,
            local_paths: Vec::new(),
            ssh_poll_tasks: HashMap::new(),
        }
    }

    /// Start watching local CLAUDE.md files.
    pub fn watch_local(&mut self, paths: Vec<String>) -> Result<(), String> {
        let app = self.app.clone();

        // Create watcher if not exists
        if self.local_watcher.is_none() {
            let app_clone = app.clone();
            let watcher = notify::recommended_watcher(move |res: Result<notify::Event, _>| {
                if let Ok(event) = res {
                    if matches!(event.kind, EventKind::Modify(_) | EventKind::Create(_)) {
                        for path in &event.paths {
                            let _ = app_clone.emit(
                                "claude-md-changed",
                                serde_json::json!({
                                    "path": path.to_string_lossy(),
                                }),
                            );
                        }
                    }
                }
            })
            .map_err(|e| format!("failed to create watcher: {e}"))?;
            self.local_watcher = Some(watcher);
        }

        let watcher = self.local_watcher.as_mut().unwrap();
        for path_str in &paths {
            let path = PathBuf::from(path_str);
            if !self.local_paths.contains(&path) {
                watcher
                    .watch(&path, RecursiveMode::NonRecursive)
                    .map_err(|e| format!("watch failed for {path_str}: {e}"))?;
                self.local_paths.push(path);
            }
        }

        Ok(())
    }

    /// Stop watching all files for a session.
    pub fn unwatch(&mut self, session_id: &str) {
        // Stop SSH polling task if exists
        if let Some(task) = self.ssh_poll_tasks.remove(session_id) {
            task.abort();
        }

        // For local, remove all watched paths and recreate watcher
        // (simplified: we clear everything since typically only one session is tracked)
        if let Some(watcher) = &mut self.local_watcher {
            for path in self.local_paths.drain(..) {
                let _ = watcher.unwatch(&path);
            }
        }
    }

    /// Stop all watchers (cleanup on shutdown).
    pub fn unwatch_all(&mut self) {
        for (_, task) in self.ssh_poll_tasks.drain() {
            task.abort();
        }
        self.local_watcher = None;
        self.local_paths.clear();
    }
}
```

- [ ] **Step 2: Verify compilation**

```bash
cd src-tauri && cargo check
```

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/claude/file_watcher.rs
git commit -m "feat: add CLAUDE.md file watcher with notify crate for local files"
```

---

## Task 6: Backend — Tauri Commands for Claude Operations

**Files:**
- Create: `src-tauri/src/commands/claude_commands.rs`
- Modify: `src-tauri/src/commands/mod.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Create claude_commands.rs**

Create `src-tauri/src/commands/claude_commands.rs`:

```rust
use tauri::AppHandle;
use crate::session::manager::SessionManager;
use crate::session::SessionType;
use crate::claude::claude_md;
use crate::claude::cwd_resolver::{self, CwdResult};
use crate::claude::ClaudeMdFile;

#[tauri::command]
pub async fn get_session_cwd(
    state: tauri::State<'_, SessionManager>,
    session_id: String,
) -> Result<CwdResult, String> {
    cwd_resolver::resolve_cwd(&state, &session_id).await
}

#[tauri::command]
pub async fn discover_claude_md(
    state: tauri::State<'_, SessionManager>,
    session_id: String,
    cwd: String,
) -> Result<Vec<ClaudeMdFile>, String> {
    let (session_type, connection_id) = state.get_session_info(&session_id).await?;

    match session_type {
        SessionType::Local | SessionType::Wsl => {
            claude_md::discover_local(&cwd)
        }
        SessionType::Ssh => {
            let conn_id = connection_id.ok_or("no connection_id for SSH session")?;
            let sftp = state.open_sftp(&conn_id).await?;
            // Resolve home dir via SFTP
            let home = sftp.canonicalize(".")
                .await
                .unwrap_or_else(|_| "/root".to_string());
            claude_md::discover_sftp(&sftp, &cwd, &home).await
        }
    }
}

#[tauri::command]
pub async fn read_claude_md(
    state: tauri::State<'_, SessionManager>,
    session_id: String,
    path: String,
) -> Result<String, String> {
    let (session_type, connection_id) = state.get_session_info(&session_id).await?;

    match session_type {
        SessionType::Local | SessionType::Wsl => {
            let file = claude_md::read_local(&path)?;
            Ok(file.content)
        }
        SessionType::Ssh => {
            let conn_id = connection_id.ok_or("no connection_id for SSH session")?;
            let sftp = state.open_sftp(&conn_id).await?;
            use russh_sftp::protocol::OpenFlags;
            let file = sftp.open_with_flags(&path, OpenFlags::READ)
                .await
                .map_err(|e| format!("sftp open failed: {e}"))?;
            let data = sftp.read(&file, 0, 1024 * 1024)
                .await
                .map_err(|e| format!("sftp read failed: {e}"))?;
            sftp.close(file).await.map_err(|e| format!("sftp close failed: {e}"))?;
            String::from_utf8(data).map_err(|e| format!("invalid utf8: {e}"))
        }
    }
}

#[tauri::command]
pub async fn write_claude_md(
    state: tauri::State<'_, SessionManager>,
    session_id: String,
    path: String,
    content: String,
    expected_mtime: Option<u64>,
) -> Result<(), String> {
    let (session_type, connection_id) = state.get_session_info(&session_id).await?;

    match session_type {
        SessionType::Local | SessionType::Wsl => {
            claude_md::write_local(&path, &content, expected_mtime)
        }
        SessionType::Ssh => {
            let conn_id = connection_id.ok_or("no connection_id for SSH session")?;
            let sftp = state.open_sftp(&conn_id).await?;
            claude_md::write_sftp(&sftp, &path, &content, expected_mtime).await
        }
    }
}
```

- [ ] **Step 2: Register claude_commands module**

In `src-tauri/src/commands/mod.rs`, add:

```rust
pub mod session_commands;
pub mod wsl_commands;
pub mod claude_commands;
```

- [ ] **Step 3: Register Tauri commands in lib.rs**

In `src-tauri/src/lib.rs`, add the new commands to the `invoke_handler`:

```rust
.invoke_handler(tauri::generate_handler![
    session_commands::session_create,
    session_commands::session_create_with_password,
    session_commands::session_write,
    session_commands::session_resize,
    session_commands::session_kill,
    wsl_commands::get_wsl_distros,
    commands::claude_commands::get_session_cwd,
    commands::claude_commands::discover_claude_md,
    commands::claude_commands::read_claude_md,
    commands::claude_commands::write_claude_md,
])
```

- [ ] **Step 4: Verify compilation**

```bash
cd src-tauri && cargo check
```

Fix any issues. The SFTP API calls may need adjustment based on `russh-sftp 2.0`'s actual API surface.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/commands/ src-tauri/src/lib.rs
git commit -m "feat: add Tauri commands for CLAUDE.md discovery, read, write"
```

---

## Task 7: Frontend — IPC Layer & Stores

**Files:**
- Modify: `src/lib/tauriIpc.ts`
- Create: `src/store/claudeCodeStore.ts`

- [ ] **Step 1: Add CLAUDE.md IPC methods to tauriIpc.ts**

Add types and methods to `src/lib/tauriIpc.ts`:

After the existing type definitions, add:

```typescript
export interface ClaudeMdFile {
  path: string;
  level: "user" | "project" | "directory" | "parent";
  content: string;
  lastModified: number;
  readonly: boolean;
}

export type CwdResult =
  | { type: "resolved"; value: string }
  | { type: "pending" };
```

Add event listener setup for `session-cwd` and `claude-md-changed`:

```typescript
const sessionCwdHandlers = new Map<string, (cwd: string) => void>();
let sessionCwdUnlisten: UnlistenFn | null = null;
let sessionCwdListenerPromise: Promise<void> | null = null;

async function ensureSessionCwdListener(): Promise<void> {
  if (sessionCwdUnlisten) return;
  if (!sessionCwdListenerPromise) {
    sessionCwdListenerPromise = listen<{ sessionId: string; cwd: string }>("session-cwd", (event) => {
      const { sessionId, cwd } = event.payload;
      sessionCwdHandlers.get(sessionId)?.(cwd);
    }).then((unlisten) => { sessionCwdUnlisten = unlisten; });
  }
  return sessionCwdListenerPromise;
}

const claudeMdChangedHandlers: Array<(path: string) => void> = [];
let claudeMdChangedUnlisten: UnlistenFn | null = null;
let claudeMdChangedListenerPromise: Promise<void> | null = null;

async function ensureClaudeMdChangedListener(): Promise<void> {
  if (claudeMdChangedUnlisten) return;
  if (!claudeMdChangedListenerPromise) {
    claudeMdChangedListenerPromise = listen<{ path: string }>("claude-md-changed", (event) => {
      const { path } = event.payload;
      for (const handler of claudeMdChangedHandlers) handler(path);
    }).then((unlisten) => { claudeMdChangedUnlisten = unlisten; });
  }
  return claudeMdChangedListenerPromise;
}
```

Add to the `ipc` object:

```typescript
// Claude Code panel
async getSessionCwd(sessionId: string): Promise<CwdResult> {
  return invoke<CwdResult>("get_session_cwd", { sessionId });
},
async discoverClaudeMd(sessionId: string, cwd: string): Promise<ClaudeMdFile[]> {
  return invoke<ClaudeMdFile[]>("discover_claude_md", { sessionId, cwd });
},
async readClaudeMd(sessionId: string, path: string): Promise<string> {
  return invoke<string>("read_claude_md", { sessionId, path });
},
async writeClaudeMd(sessionId: string, path: string, content: string, expectedMtime?: number): Promise<void> {
  return invoke("write_claude_md", { sessionId, path, content, expectedMtime: expectedMtime ?? null });
},
async onSessionCwd(sessionId: string, handler: (cwd: string) => void): Promise<() => void> {
  await ensureSessionCwdListener();
  sessionCwdHandlers.set(sessionId, handler);
  return () => { sessionCwdHandlers.delete(sessionId); };
},
async onClaudeMdChanged(handler: (path: string) => void): Promise<() => void> {
  await ensureClaudeMdChangedListener();
  claudeMdChangedHandlers.push(handler);
  return () => {
    const idx = claudeMdChangedHandlers.indexOf(handler);
    if (idx >= 0) claudeMdChangedHandlers.splice(idx, 1);
  };
},
```

- [ ] **Step 2: Create claudeCodeStore.ts**

Create `src/store/claudeCodeStore.ts`:

```typescript
import { create } from "zustand";
import { ipc, type ClaudeMdFile } from "../lib/tauriIpc";

interface ClaudeCodeState {
  trackedSessionId: string | null;
  trackedCwd: string | null;
  files: ClaudeMdFile[];
  loading: boolean;
  error: string | null;

  setTrackedSession: (sessionId: string | null) => void;
  setCwd: (cwd: string) => void;
  refreshFiles: () => Promise<void>;
  saveFile: (path: string, content: string) => Promise<void>;
}

export const useClaudeCodeStore = create<ClaudeCodeState>((set, get) => ({
  trackedSessionId: null,
  trackedCwd: null,
  files: [],
  loading: false,
  error: null,

  setTrackedSession: (sessionId) => {
    set({ trackedSessionId: sessionId, files: [], trackedCwd: null, error: null });
  },

  setCwd: (cwd) => {
    const state = get();
    if (state.trackedCwd === cwd) return;
    set({ trackedCwd: cwd });
    // Auto-refresh when CWD changes
    get().refreshFiles();
  },

  refreshFiles: async () => {
    const { trackedSessionId, trackedCwd } = get();
    if (!trackedSessionId || !trackedCwd) {
      set({ files: [], loading: false });
      return;
    }
    set({ loading: true, error: null });
    try {
      const files = await ipc.discoverClaudeMd(trackedSessionId, trackedCwd);
      set({ files, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  saveFile: async (path, content) => {
    const { trackedSessionId, files } = get();
    if (!trackedSessionId) return;
    const file = files.find((f) => f.path === path);
    const expectedMtime = file?.lastModified;
    try {
      await ipc.writeClaudeMd(trackedSessionId, path, content, expectedMtime);
      // Refresh to get updated mtime
      get().refreshFiles();
    } catch (e) {
      const errStr = String(e);
      if (errStr.includes("CONFLICT")) {
        set({ error: `File changed externally: ${path}` });
      } else {
        set({ error: errStr });
      }
      throw e;
    }
  },
}));
```

- [ ] **Step 3: Verify TypeScript compilation**

```bash
npx tsc --noEmit
```

Fix any type errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/tauriIpc.ts src/store/claudeCodeStore.ts
git commit -m "feat: add IPC methods and Zustand store for CLAUDE.md operations"
```

---

## Task 8: Frontend — Extract Shared CodeMirror Setup

**Files:**
- Create: `src/lib/codemirrorSetup.ts`
- Modify: `src/components/NotePanel/NoteEditor.tsx`

- [ ] **Step 1: Create codemirrorSetup.ts**

Extract the shared CodeMirror config from `NoteEditor.tsx` into `src/lib/codemirrorSetup.ts`:

```typescript
import { EditorView, placeholder, keymap } from "@codemirror/view";
import { defaultKeymap, indentWithTab } from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import {
  syntaxHighlighting,
  HighlightStyle,
  defaultHighlightStyle,
} from "@codemirror/language";
import { tags } from "@lezer/highlight";
import type { Extension } from "@codemirror/state";
import { Compartment } from "@codemirror/state";

/** CSS-variable-driven highlight style for markdown tokens */
export const mdHighlight = HighlightStyle.define([
  { tag: tags.heading1, fontWeight: "700", fontSize: "1.25em" },
  { tag: tags.heading2, fontWeight: "700", fontSize: "1.12em" },
  { tag: tags.heading3, fontWeight: "600", fontSize: "1.05em" },
  { tag: [tags.heading4, tags.heading5, tags.heading6], fontWeight: "600" },
  { tag: tags.strong, fontWeight: "600" },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: tags.strikethrough, textDecoration: "line-through", opacity: "0.6" },
  { tag: tags.monospace, fontFamily: '"JetBrains Mono", "JetBrainsMonoNerdFont", monospace' },
  { tag: tags.url, textDecoration: "underline" },
  { tag: tags.link, textDecoration: "underline" },
  { tag: [tags.processingInstruction, tags.contentSeparator], opacity: "0.4" },
  { tag: tags.quote, fontStyle: "italic", opacity: "0.8" },
]);

/** CodeMirror theme that reads from CSS custom properties */
export const cmTheme = EditorView.theme({
  "&": {
    flex: "1",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    fontFamily: '"Pretendard", sans-serif',
    backgroundColor: "transparent",
  },
  ".cm-scroller": {
    flex: "1",
    overflow: "auto",
    scrollbarWidth: "thin",
    scrollbarColor: "var(--bg-tertiary) transparent",
  },
  ".cm-scroller::-webkit-scrollbar": { width: "4px" },
  ".cm-scroller::-webkit-scrollbar-track": { background: "transparent" },
  ".cm-scroller::-webkit-scrollbar-thumb": {
    background: "var(--bg-tertiary)",
    borderRadius: "2px",
  },
  ".cm-content": {
    padding: "10px 14px 20px",
    lineHeight: "1.65",
    caretColor: "var(--accent)",
    color: "var(--label-primary)",
    minHeight: "100%",
    fontFamily: '"Pretendard", sans-serif',
  },
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--accent)" },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
    background: "color-mix(in srgb, var(--accent), transparent 75%) !important",
  },
  ".cm-activeLine": { backgroundColor: "transparent" },
  ".cm-gutters": { display: "none" },
  ".cm-placeholder": {
    color: "var(--label-disabled)",
    fontFamily: '"Pretendard", sans-serif',
    fontStyle: "normal",
  },
  "&.cm-focused": { outline: "none" },
});

/** Font-size theme (reconfigured dynamically via Compartment) */
export function buildFontSizeTheme(fontSize: number) {
  return EditorView.theme({ "&": { fontSize: `${fontSize}px` } });
}

/** Build the base set of extensions for a markdown editor */
export function baseMarkdownExtensions(opts: {
  fontSizeCompartment: Compartment;
  initialFontSize: number;
  placeholderText?: string;
}): Extension[] {
  return [
    cmTheme,
    opts.fontSizeCompartment.of(buildFontSizeTheme(opts.initialFontSize)),
    markdown({ base: markdownLanguage, codeLanguages: languages }),
    syntaxHighlighting(mdHighlight),
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    placeholder(opts.placeholderText ?? ""),
    keymap.of([...defaultKeymap, indentWithTab]),
    EditorView.lineWrapping,
  ];
}
```

- [ ] **Step 2: Refactor NoteEditor to use shared setup**

Update `src/components/NotePanel/NoteEditor.tsx` to import from the shared module. Replace the inline definitions:

Remove the following from NoteEditor.tsx (lines 2-11, 17-46, 49-98):
- All CodeMirror imports except `EditorState`, `Compartment`, `EditorView`
- `mdHighlight` constant
- `buildFontSizeTheme` function
- `cmTheme` constant

Replace with imports from codemirrorSetup:

```typescript
import { useEffect, useRef } from "react";
import { EditorState, Compartment } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { baseMarkdownExtensions, buildFontSizeTheme } from "../../lib/codemirrorSetup";
import { useNoteStore } from "../../store/noteStore";
import { useTerminalConfigStore } from "../../store/terminalConfigStore";
```

Update the `EditorState.create` call to use `baseMarkdownExtensions`:

```typescript
const state = EditorState.create({
  doc: content,
  extensions: [
    ...baseMarkdownExtensions({
      fontSizeCompartment: fontSizeCompartment.current,
      initialFontSize,
      placeholderText: "Type your note here...",
    }),
    updateListener,
  ],
});
```

- [ ] **Step 3: Verify the note editor still works**

Run the app and verify notes panel works exactly as before — creating notes, editing, markdown highlighting.

- [ ] **Step 4: Commit**

```bash
git add src/lib/codemirrorSetup.ts src/components/NotePanel/NoteEditor.tsx
git commit -m "refactor: extract shared CodeMirror setup for reuse by ClaudeMdEditor"
```

---

## Task 9: Frontend — ClaudeCodePanel Components

**Files:**
- Create: `src/components/ClaudeCodePanel/ClaudeCodePanel.tsx`
- Create: `src/components/ClaudeCodePanel/ContextIndicator.tsx`
- Create: `src/components/ClaudeCodePanel/ClaudeMdTab.tsx`
- Create: `src/components/ClaudeCodePanel/ClaudeMdEditor.tsx`
- Create: `src/components/ClaudeCodePanel/ClaudeCodePanel.css`

- [ ] **Step 1: Create ClaudeCodePanel.css**

Create `src/components/ClaudeCodePanel/ClaudeCodePanel.css`:

```css
/* ── Claude Code Panel — Left sidebar ─────────────────────────── */
.claude-panel {
  width: 300px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--separator);
  background: var(--bg-secondary);
  overflow: hidden;
}

.claude-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 6px;
  height: 36px;
  border-bottom: 1px solid var(--separator);
  flex-shrink: 0;
}

.claude-panel-tabs {
  display: flex;
  flex: 1;
  gap: 1px;
  min-width: 0;
}

.claude-panel-tab {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  height: 26px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--label-tertiary);
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: color 0.15s, background 0.15s;
  user-select: none;
}

.claude-panel-tab:hover {
  color: var(--label-secondary);
  background: rgba(255, 255, 255, 0.04);
}

.claude-panel-tab--active {
  color: var(--label-primary);
  background: var(--bg-tertiary);
}

.claude-panel-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: none;
  background: none;
  cursor: pointer;
  border-radius: var(--radius-xs);
  color: var(--label-tertiary);
  padding: 0;
  transition: color 0.12s, background 0.12s;
  flex-shrink: 0;
}

.claude-panel-close:hover {
  color: var(--label-primary);
  background: var(--bg-tertiary);
}

.claude-panel-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  padding: 6px;
  gap: 6px;
}

/* ── Context Indicator ────────────────────────────────────────── */
.claude-context {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background: var(--bg-terminal);
  border: 1px solid var(--bg-panel-border);
  border-radius: var(--radius-sm);
  font-size: 11px;
  font-family: "JetBrains Mono", "JetBrainsMonoNerdFont", monospace;
  color: var(--label-secondary);
  overflow: hidden;
}

.claude-context-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--system-green);
  flex-shrink: 0;
}

.claude-context-info {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.claude-context-label {
  font-weight: 600;
  color: var(--label-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.claude-context-cwd {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  opacity: 0.7;
}

/* ── CLAUDE.md file list ──────────────────────────────────────── */
.claude-md-list {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-height: 0;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--bg-tertiary) transparent;
}

.claude-md-list::-webkit-scrollbar { width: 4px; }
.claude-md-list::-webkit-scrollbar-track { background: transparent; }
.claude-md-list::-webkit-scrollbar-thumb {
  background: var(--bg-tertiary);
  border-radius: 2px;
}

.claude-md-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  gap: 8px;
  color: var(--label-tertiary);
  font-size: 12px;
  font-family: "Pretendard", sans-serif;
  text-align: center;
  padding: 20px;
}

.claude-md-empty-btn {
  padding: 4px 12px;
  border: 1px solid var(--separator);
  border-radius: var(--radius-sm);
  background: var(--bg-tertiary);
  color: var(--label-secondary);
  font-size: 11px;
  cursor: pointer;
  transition: background 0.12s;
}

.claude-md-empty-btn:hover {
  background: var(--bg-secondary);
  color: var(--label-primary);
}

/* ── CLAUDE.md editor section ─────────────────────────────────── */
.claude-md-section {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: var(--bg-terminal);
  border: 1px solid var(--bg-panel-border);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.claude-md-section--expanded .claude-md-editor-wrap {
  display: flex;
}

.claude-md-section-header {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 12px;
  border: none;
  background: none;
  cursor: pointer;
  user-select: none;
  flex-shrink: 0;
  width: 100%;
  text-align: left;
}

.claude-md-section-header:hover {
  background: var(--bg-tertiary);
}

.claude-md-level-badge {
  font-size: 9px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 1px 5px;
  border-radius: 3px;
  background: var(--bg-tertiary);
  color: var(--label-tertiary);
  flex-shrink: 0;
}

.claude-md-path {
  font-size: 11px;
  font-family: "JetBrains Mono", "JetBrainsMonoNerdFont", monospace;
  color: var(--label-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.claude-md-editor-wrap {
  display: none;
  flex-direction: column;
  border-top: 1px solid var(--bg-panel-border);
  min-height: 120px;
  max-height: 400px;
}
```

- [ ] **Step 2: Create ContextIndicator.tsx**

Create `src/components/ClaudeCodePanel/ContextIndicator.tsx`:

```tsx
import type { PanelConnection } from "../../types/terminal";

interface ContextIndicatorProps {
  connection: PanelConnection | undefined;
  cwd: string | null;
}

export function ContextIndicator({ connection, cwd }: ContextIndicatorProps) {
  const label = connection
    ? connection.type === "ssh"
      ? `SSH ${connection.label ?? ""}`
      : connection.type === "wsl"
        ? `WSL ${connection.shellArgs?.[1] ?? ""}`
        : "Local"
    : "No session";

  return (
    <div className="claude-context">
      <span className="claude-context-dot" />
      <div className="claude-context-info">
        <span className="claude-context-label">{label}</span>
        {cwd && <span className="claude-context-cwd">{cwd}</span>}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create ClaudeMdEditor.tsx**

Create `src/components/ClaudeCodePanel/ClaudeMdEditor.tsx`:

```tsx
import { useEffect, useRef, useCallback } from "react";
import { EditorState, Compartment } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { baseMarkdownExtensions, buildFontSizeTheme } from "../../lib/codemirrorSetup";
import { useTerminalConfigStore } from "../../store/terminalConfigStore";
import { useClaudeCodeStore } from "../../store/claudeCodeStore";

interface ClaudeMdEditorProps {
  path: string;
  content: string;
  readonly: boolean;
}

export function ClaudeMdEditor({ path, content, readonly }: ClaudeMdEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const fontSizeCompartment = useRef(new Compartment());
  const readonlyCompartment = useRef(new Compartment());
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentRef = useRef(content);

  const saveFile = useClaudeCodeStore((s) => s.saveFile);
  const terminalFontSize = useTerminalConfigStore((s) => s.fontSize);

  const debouncedSave = useCallback(
    (newContent: string) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        saveFile(path, newContent).catch(() => {});
      }, 500);
    },
    [path, saveFile]
  );

  useEffect(() => {
    if (!containerRef.current) return;

    const initialFontSize = useTerminalConfigStore.getState().fontSize;
    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        const doc = update.state.doc.toString();
        contentRef.current = doc;
        debouncedSave(doc);
      }
    });

    const state = EditorState.create({
      doc: content,
      extensions: [
        ...baseMarkdownExtensions({
          fontSizeCompartment: fontSizeCompartment.current,
          initialFontSize,
          placeholderText: "CLAUDE.md content...",
        }),
        readonlyCompartment.current.of(EditorView.editable.of(!readonly)),
        updateListener,
      ],
    });

    const view = new EditorView({ state, parent: containerRef.current });
    viewRef.current = view;

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: fontSizeCompartment.current.reconfigure(buildFontSizeTheme(terminalFontSize)),
    });
  }, [terminalFontSize]);

  // Sync external content changes
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    if (content !== contentRef.current) {
      contentRef.current = content;
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: content },
      });
    }
  }, [content]);

  return <div ref={containerRef} className="claude-md-cm-container" />;
}
```

- [ ] **Step 4: Create ClaudeMdTab.tsx**

Create `src/components/ClaudeCodePanel/ClaudeMdTab.tsx`:

```tsx
import { useState } from "react";
import { useClaudeCodeStore } from "../../store/claudeCodeStore";
import { ClaudeMdEditor } from "./ClaudeMdEditor";

export function ClaudeMdTab() {
  const { files, loading, error } = useClaudeCodeStore();
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());

  const toggleExpanded = (path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="claude-md-empty">
        <span>Loading...</span>
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="claude-md-empty">
        <span>No CLAUDE.md found</span>
      </div>
    );
  }

  return (
    <div className="claude-md-list">
      {error && (
        <div style={{ color: "var(--system-red)", fontSize: 11, padding: "4px 8px" }}>
          {error}
        </div>
      )}
      {files.map((file) => {
        const isExpanded = expandedPaths.has(file.path);
        return (
          <div
            key={file.path}
            className={`claude-md-section${isExpanded ? " claude-md-section--expanded" : ""}`}
          >
            <button
              className="claude-md-section-header"
              onClick={() => toggleExpanded(file.path)}
            >
              <svg
                width="8"
                height="8"
                viewBox="0 0 8 8"
                className={`collapsible-chevron${isExpanded ? " collapsible-chevron--open" : ""}`}
              >
                <path d="M2 1l4 3-4 3" fill="currentColor" />
              </svg>
              <span className="claude-md-level-badge">{file.level}</span>
              <span className="claude-md-path">{file.path}</span>
            </button>
            {isExpanded && (
              <div className="claude-md-editor-wrap" style={{ display: "flex" }}>
                <ClaudeMdEditor
                  path={file.path}
                  content={file.content}
                  readonly={file.readonly}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 5: Create ClaudeCodePanel.tsx**

Create `src/components/ClaudeCodePanel/ClaudeCodePanel.tsx`:

```tsx
import { useEffect, useMemo } from "react";
import { useClaudeCodeStore } from "../../store/claudeCodeStore";
import { useTabStore } from "../../store/tabStore";
import { ipc } from "../../lib/tauriIpc";
import { ContextIndicator } from "./ContextIndicator";
import { ClaudeMdTab } from "./ClaudeMdTab";
import "./ClaudeCodePanel.css";

export type ClaudeCodeTab = "claude-md";

interface ClaudeCodePanelProps {
  activeTab: ClaudeCodeTab;
  onTabChange: (tab: ClaudeCodeTab) => void;
  onClose: () => void;
  focusedPanelId: string | null;
  focusedSessionId: string | null;
}

export function ClaudeCodePanel({
  activeTab,
  onTabChange,
  onClose,
  focusedPanelId,
  focusedSessionId,
}: ClaudeCodePanelProps) {
  const { setTrackedSession, setCwd, trackedCwd } = useClaudeCodeStore();
  const tabs = useTabStore((s) => s.tabs);
  const activeTabId = useTabStore((s) => s.activeTabId);

  // Find the focused panel's connection info
  const focusedPanel = useMemo(() => {
    const tab = tabs.find((t) => t.id === activeTabId);
    if (!tab || !focusedPanelId) return null;
    return tab.panels.find((p) => p.id === focusedPanelId) ?? null;
  }, [tabs, activeTabId, focusedPanelId]);

  // Track session changes
  useEffect(() => {
    setTrackedSession(focusedSessionId);
    if (!focusedSessionId) return;

    // Request CWD
    ipc.getSessionCwd(focusedSessionId).then((result) => {
      if ("value" in result) {
        setCwd(result.value);
      }
      // If "pending", CWD will arrive via session-cwd event
    }).catch(() => {});

    // Listen for async CWD updates (WSL/SSH)
    let cleanup: (() => void) | null = null;
    ipc.onSessionCwd(focusedSessionId, (cwd) => {
      setCwd(cwd);
    }).then((unsub) => { cleanup = unsub; });

    return () => { cleanup?.(); };
  }, [focusedSessionId, setTrackedSession, setCwd]);

  // Listen for file changes
  useEffect(() => {
    let cleanup: (() => void) | null = null;
    const { refreshFiles } = useClaudeCodeStore.getState();
    ipc.onClaudeMdChanged(() => {
      refreshFiles();
    }).then((unsub) => { cleanup = unsub; });
    return () => { cleanup?.(); };
  }, []);

  return (
    <div className="claude-panel">
      <div className="claude-panel-header">
        <div className="claude-panel-tabs">
          <button
            className={`claude-panel-tab${activeTab === "claude-md" ? " claude-panel-tab--active" : ""}`}
            onClick={() => onTabChange("claude-md")}
            title="CLAUDE.md"
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <path d="M3 2h9a1 1 0 011 1v9a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.2" />
              <path d="M5 5.5h5M5 7.5h5M5 9.5h3" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <button
          className="claude-panel-close"
          onClick={onClose}
          aria-label="Close panel"
          title="Close panel"
        >
          <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
            <path
              d="M1.5 1.5l6 6M7.5 1.5l-6 6"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      <div className="claude-panel-body">
        <ContextIndicator
          connection={focusedPanel?.connection}
          cwd={trackedCwd}
        />
        {activeTab === "claude-md" && <ClaudeMdTab />}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Verify TypeScript compilation**

```bash
npx tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
git add src/components/ClaudeCodePanel/
git commit -m "feat: add ClaudeCodePanel UI components with CLAUDE.md accordion editor"
```

---

## Task 10: Frontend — App.tsx Integration

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.css`

- [ ] **Step 1: Add imports and state to App.tsx**

Add imports at top of `src/App.tsx`:

```typescript
import { ClaudeCodePanel } from "./components/ClaudeCodePanel/ClaudeCodePanel";
import type { ClaudeCodeTab } from "./components/ClaudeCodePanel/ClaudeCodePanel";
```

Add state variables in the `App` component (after the existing `sidebarTab` state):

```typescript
const [claudePanelOpen, setClaudePanelOpen] = useState(() => {
  return localStorage.getItem("v-terminal:claude-panel-open") === "true";
});
const [claudePanelTab, setClaudePanelTab] = useState<ClaudeCodeTab>("claude-md");
```

Add ref for tracking:
```typescript
const claudePanelOpenRef = useRef(claudePanelOpen);
useEffect(() => { claudePanelOpenRef.current = claudePanelOpen; }, [claudePanelOpen]);
```

Add handlers:
```typescript
const handleToggleClaudePanel = useCallback(() => {
  const next = !claudePanelOpen;
  setClaudePanelOpen(next);
  localStorage.setItem("v-terminal:claude-panel-open", String(next));
}, [claudePanelOpen]);

const handleCloseClaudePanel = useCallback(() => {
  setClaudePanelOpen(false);
  localStorage.setItem("v-terminal:claude-panel-open", "false");
}, []);

const handleClaudePanelTabChange = useCallback((tab: ClaudeCodeTab) => {
  setClaudePanelTab(tab);
  localStorage.setItem("v-terminal:claude-panel-tab", tab);
}, []);
```

- [ ] **Step 2: Add keyboard shortcut**

In the `onKeyDown` handler (inside the `useEffect` at ~line 110), add after the `Ctrl+Shift+N` block:

```typescript
if (e.ctrlKey && e.shiftKey && e.key === "L") {
  e.preventDefault();
  e.stopPropagation();
  const next = !claudePanelOpenRef.current;
  setClaudePanelOpen(next);
  localStorage.setItem("v-terminal:claude-panel-open", String(next));
}
```

- [ ] **Step 3: Add command palette entry**

In the `tabPaletteSection` useMemo (after the existing `view:toolkit` entry), add:

```typescript
{
  id: "view:claude-panel",
  label: claudePanelOpen ? "Hide Claude Code Panel" : "Show Claude Code Panel",
  description: "Toggle the Claude Code panel with CLAUDE.md editor",
  meta: "Ctrl+Shift+L",
  icon: (
    <span className="cp-cmd-icon">
      <svg width="14" height="14" viewBox="0 0 15 15" fill="none">
        <path d="M3 2h9a1 1 0 011 1v9a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.2" />
        <path d="M5 5.5h5M5 7.5h5M5 9.5h3" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round" />
      </svg>
    </span>
  ),
  isActive: claudePanelOpen,
  action: handleToggleClaudePanel,
},
```

Add `handleToggleClaudePanel` and `claudePanelOpen` to the useMemo deps array.

- [ ] **Step 4: Update layout in JSX**

In the `app-content` div, add the ClaudeCodePanel before `app-terminal-area`:

```tsx
<div className="app-content">
  {claudePanelOpen && (
    <ClaudeCodePanel
      activeTab={claudePanelTab}
      onTabChange={handleClaudePanelTabChange}
      onClose={handleCloseClaudePanel}
      focusedPanelId={activePanelId}
      focusedSessionId={activePanelSessionIdRef.current}
    />
  )}
  <div className="app-terminal-area">
    {/* existing content unchanged */}
  </div>
  {sidebarOpen && (
    <SidePanel ... />
  )}
</div>
```

- [ ] **Step 5: Update App.css for layout**

No CSS changes needed — the existing `app-content` is `display: flex` and `app-terminal-area` is `flex: 1`, so the left panel will naturally take its 300px width and the terminal area will fill the rest.

- [ ] **Step 6: Visual verification**

Run the app. Press `Ctrl+Shift+L` to toggle the Claude Code panel. Verify:
- Panel appears on the left with correct styling
- Context indicator shows the focused panel's session info
- Terminal area resizes correctly
- Panel can be opened/closed independently from the right toolkit

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx src/App.css
git commit -m "feat: integrate ClaudeCodePanel into app layout with keyboard shortcut and command palette"
```

---

## Task 11: Backend — Usage Data Module

**Files:**
- Create/Replace: `src-tauri/src/claude/usage.rs`
- Modify: `src-tauri/src/commands/claude_commands.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Implement usage.rs**

Replace `src-tauri/src/claude/usage.rs`:

```rust
use super::UsageData;

/// Read Claude Code usage data from the local filesystem.
/// Claude Code stores usage info under ~/.claude/
/// The exact format needs investigation — this is a best-effort parser.
pub fn read_local_usage() -> Result<UsageData, String> {
    let home = dirs::home_dir().ok_or("cannot determine home directory")?;
    let claude_dir = home.join(".claude");

    if !claude_dir.exists() {
        return Err("Claude Code not installed (~/.claude/ not found)".to_string());
    }

    // TODO: Investigate actual usage data format at implementation time.
    // Claude Code may store usage in:
    //   ~/.claude/usage.json
    //   ~/.claude/statsig/ or similar
    //   Or query via `claude usage` CLI command
    //
    // For now, return a placeholder that indicates data is unavailable.
    Err("usage data format investigation required".to_string())
}

/// Read Claude Code usage data from a remote host via SFTP.
pub async fn read_sftp_usage(
    sftp: &russh_sftp::client::SftpSession,
    home_dir: &str,
) -> Result<UsageData, String> {
    let usage_dir = format!("{home_dir}/.claude");

    // Check if .claude directory exists
    if sftp.metadata(&usage_dir).await.is_err() {
        return Err("Claude Code not installed on remote (~/.claude/ not found)".to_string());
    }

    // TODO: Same investigation needed for remote usage data format.
    Err("usage data format investigation required".to_string())
}
```

- [ ] **Step 2: Add get_usage Tauri command**

In `src-tauri/src/commands/claude_commands.rs`, add:

```rust
use crate::claude::usage;
use crate::claude::UsageData;

#[tauri::command]
pub async fn get_usage(
    state: tauri::State<'_, SessionManager>,
    session_id: String,
) -> Result<UsageData, String> {
    let (session_type, connection_id) = state.get_session_info(&session_id).await?;

    match session_type {
        SessionType::Local | SessionType::Wsl => {
            usage::read_local_usage()
        }
        SessionType::Ssh => {
            let conn_id = connection_id.ok_or("no connection_id for SSH session")?;
            let sftp = state.open_sftp(&conn_id).await?;
            let home = sftp.canonicalize(".")
                .await
                .unwrap_or_else(|_| "/root".to_string());
            usage::read_sftp_usage(&sftp, &home).await
        }
    }
}
```

- [ ] **Step 3: Register command in lib.rs**

Add `commands::claude_commands::get_usage` to the `invoke_handler` array.

- [ ] **Step 4: Verify compilation**

```bash
cd src-tauri && cargo check
```

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/claude/usage.rs src-tauri/src/commands/claude_commands.rs src-tauri/src/lib.rs
git commit -m "feat: add usage data module skeleton (format TBD)"
```

---

## Task 12: Frontend — Usage Bar

**Files:**
- Create: `src/store/usageStore.ts`
- Create: `src/components/UsageBar/UsageBar.tsx`
- Create: `src/components/UsageBar/UsageGauge.tsx`
- Create: `src/components/UsageBar/UsageBar.css`
- Modify: `src/lib/tauriIpc.ts`
- Modify: `src/App.tsx`
- Modify: `src/App.css`

- [ ] **Step 1: Add usage IPC method to tauriIpc.ts**

Add to the `ipc` object in `src/lib/tauriIpc.ts`:

```typescript
async getUsage(sessionId: string): Promise<{ plan: string; usedPercent: number; resetAt: number | null }> {
  return invoke("get_usage", { sessionId });
},
```

- [ ] **Step 2: Create usageStore.ts**

Create `src/store/usageStore.ts`:

```typescript
import { create } from "zustand";
import { ipc } from "../lib/tauriIpc";

export interface UsageEntry {
  sessionId: string;
  environment: string;
  plan: string;
  usedPercent: number;
  resetAt: number | null;
  error?: string;
}

interface UsageState {
  entries: UsageEntry[];
  refreshForSession: (sessionId: string, environment: string) => Promise<void>;
  removeSession: (sessionId: string) => void;
  clearAll: () => void;
}

export const useUsageStore = create<UsageState>((set, get) => ({
  entries: [],

  refreshForSession: async (sessionId, environment) => {
    try {
      const data = await ipc.getUsage(sessionId);
      set((state) => {
        const filtered = state.entries.filter((e) => e.sessionId !== sessionId);
        return {
          entries: [
            ...filtered,
            {
              sessionId,
              environment,
              plan: data.plan,
              usedPercent: data.usedPercent,
              resetAt: data.resetAt,
            },
          ],
        };
      });
    } catch (e) {
      // Usage unavailable — remove entry or mark as error
      set((state) => ({
        entries: state.entries.filter((e) => e.sessionId !== sessionId),
      }));
    }
  },

  removeSession: (sessionId) => {
    set((state) => ({
      entries: state.entries.filter((e) => e.sessionId !== sessionId),
    }));
  },

  clearAll: () => set({ entries: [] }),
}));
```

- [ ] **Step 3: Create UsageGauge.tsx**

Create `src/components/UsageBar/UsageGauge.tsx`:

```tsx
import type { UsageEntry } from "../../store/usageStore";

function formatCountdown(resetAt: number | null): string {
  if (!resetAt) return "";
  const remaining = resetAt * 1000 - Date.now();
  if (remaining <= 0) return "resetting...";
  const hours = Math.floor(remaining / 3600000);
  const minutes = Math.floor((remaining % 3600000) / 60000);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function gaugeColor(percent: number): string {
  if (percent >= 85) return "var(--system-red)";
  if (percent >= 60) return "var(--system-yellow)";
  return "var(--system-green)";
}

export function UsageGauge({ entry }: { entry: UsageEntry }) {
  const color = gaugeColor(entry.usedPercent);
  const countdown = formatCountdown(entry.resetAt);

  return (
    <div className="usage-gauge">
      <span className="usage-gauge-plan">{entry.plan}</span>
      <div className="usage-gauge-bar">
        <div
          className="usage-gauge-fill"
          style={{ width: `${Math.min(entry.usedPercent, 100)}%`, backgroundColor: color }}
        />
      </div>
      <span className="usage-gauge-pct">{Math.round(entry.usedPercent)}%</span>
      {countdown && <span className="usage-gauge-timer">{countdown}</span>}
      <span className="usage-gauge-env">{entry.environment}</span>
    </div>
  );
}
```

- [ ] **Step 4: Create UsageBar.tsx**

Create `src/components/UsageBar/UsageBar.tsx`:

```tsx
import { useUsageStore } from "../../store/usageStore";
import { UsageGauge } from "./UsageGauge";
import "./UsageBar.css";

interface UsageBarProps {
  claudePanelOpen: boolean;
}

export function UsageBar({ claudePanelOpen }: UsageBarProps) {
  const entries = useUsageStore((s) => s.entries);

  // Visible when panel is open OR any entry exceeds 60%
  const hasWarning = entries.some((e) => e.usedPercent >= 60);
  if (!claudePanelOpen && !hasWarning) return null;
  if (entries.length === 0) return null;

  return (
    <div className="usage-bar">
      {entries.map((entry) => (
        <UsageGauge key={entry.sessionId} entry={entry} />
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Create UsageBar.css**

Create `src/components/UsageBar/UsageBar.css`:

```css
/* ── Usage Bar — bottom status bar ────────────────────────────── */
.usage-bar {
  display: flex;
  align-items: center;
  gap: 16px;
  height: 24px;
  padding: 0 12px;
  background: var(--bg-secondary);
  border-top: 1px solid var(--separator);
  flex-shrink: 0;
  overflow: hidden;
}

.usage-gauge {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
  font-family: "JetBrains Mono", "JetBrainsMonoNerdFont", monospace;
  color: var(--label-secondary);
  white-space: nowrap;
}

.usage-gauge-plan {
  font-weight: 600;
  text-transform: capitalize;
  color: var(--label-primary);
}

.usage-gauge-bar {
  width: 60px;
  height: 4px;
  background: var(--bg-tertiary);
  border-radius: 2px;
  overflow: hidden;
}

.usage-gauge-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.3s ease;
}

.usage-gauge-pct {
  min-width: 28px;
}

.usage-gauge-timer {
  opacity: 0.6;
}

.usage-gauge-env {
  opacity: 0.5;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
}
```

- [ ] **Step 6: Add UsageBar to App.tsx**

Add import:
```typescript
import { UsageBar } from "./components/UsageBar/UsageBar";
```

Add `<UsageBar>` after the `app-content` div, before the closing `</div>` of the `.app` container:

```tsx
<div className="app">
  <TitleBar />
  <div className="topbar">...</div>
  <div className="app-content">
    {/* existing content */}
  </div>
  <UsageBar claudePanelOpen={claudePanelOpen} />
  {/* modals... */}
</div>
```

- [ ] **Step 7: Verify visual**

Run the app. The usage bar won't show data yet (backend returns errors), but verify:
- No layout breakage
- The bar area is reserved when conditions are met
- CSS styling looks correct in dev tools

- [ ] **Step 8: Commit**

```bash
git add src/store/usageStore.ts src/components/UsageBar/ src/lib/tauriIpc.ts src/App.tsx
git commit -m "feat: add UsageBar component with gauge display (data source TBD)"
```

---

## Task 13: End-to-End Integration Verification

- [ ] **Step 1: Full build check**

```bash
cd src-tauri && cargo check
npx tsc --noEmit
```

Both must pass with zero errors.

- [ ] **Step 2: Run the application**

```bash
npm run tauri dev
```

Verify:
1. Cheatsheet icon shows `</>` in the right sidebar
2. `Ctrl+Shift+L` toggles the left Claude Code panel
3. Command palette shows "Show/Hide Claude Code Panel"
4. Context indicator shows session type when a panel is focused
5. CLAUDE.md files are discovered and displayed in accordion sections (for local sessions)
6. Editors open with markdown highlighting and allow editing
7. Both sidebars can be open simultaneously without layout issues
8. The app doesn't crash on SSH sessions (SFTP operations may fail gracefully)

- [ ] **Step 3: Final commit with any fixes**

```bash
git add -A
git commit -m "fix: address integration issues from end-to-end verification"
```

---

## Notes for Implementation

1. **russh-sftp API:** The SFTP API calls in `claude_md.rs` are based on expected patterns. The implementer MUST consult `russh-sftp 2.0` crate docs/source and adjust method names/signatures. Key areas: `open_with_flags`, `read`, `write`, `close`, `metadata`, `canonicalize`. **Start Task 4 by reading the docs first, then adjust the code.**

2. **Windows CWD detection:** Task 3 includes a skeleton for Windows CWD via `NtQueryInformationProcess`. The actual implementation requires unsafe Windows API calls and is deferred. PTY injection (OSC 7337, Task 3b) works as a cross-platform fallback.

3. **OSC 7337 parsing:** Implemented in Task 3b. The parser runs in the Rust reader tasks (backend), NOT the frontend. This means the OSC sequence is stripped before data reaches xterm.js — no frontend changes needed for parsing.

4. **Usage data format:** The `usage.rs` module is a skeleton. Investigate Claude Code's actual data format under `~/.claude/` before implementing the parser. Consider running `claude usage` CLI and parsing its output as an alternative approach.

5. **No test infrastructure:** The codebase has no existing tests. Where possible, pure functions (path walking, mtime comparison, OSC parsing) should have unit tests added. The `extract_osc_cwd` function in particular is a good candidate for unit testing.

6. **ClaudeMdEditor save frequency:** The current implementation saves on every document change (debounced 500ms). For SSH sessions over slow connections, consider increasing the debounce to 2-3 seconds. Monitor real-world performance.

7. **watch_claude_md / unwatch_claude_md commands:** The `ClaudeMdWatcher` in Task 5 is not yet exposed as Tauri managed state with commands. The file watcher integration is simplified: the frontend triggers `refreshFiles()` on `claude-md-changed` events. For full watch/unwatch lifecycle, the `ClaudeMdWatcher` should be added as a `tauri::Builder::manage()` state and exposed through Tauri commands in a follow-up iteration.
