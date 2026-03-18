# Git Diff Viewer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a read-only Git diff viewer to the left sidebar, supporting Local, WSL, and SSH sessions.

**Architecture:** A `GitExecutor` trait abstracts git command execution across three environments (Local/WSL/SSH). The sidebar gains a "Git" tab showing unstaged/staged file lists, and clicking a file opens a unified diff overlay in the main area. Auto-refresh via `.git/index` + `.git/HEAD` file watching for local/WSL.

**Tech Stack:** Rust (Tauri commands, `std::process::Command`, russh exec channel, `notify` crate), TypeScript/React (Zustand store, CodeMirror 6), IPC via Tauri invoke/events.

**Spec:** `docs/superpowers/specs/2026-03-18-git-diff-viewer-design.md`

---

## File Structure

**Rust backend (new files):**
- `src-tauri/src/git/mod.rs` — Types (`GitFileEntry`, `GitStatusResult`, `FileStatus`), `GitExecutor` trait, session routing
- `src-tauri/src/git/parser.rs` — Parse `git status --porcelain` and unified diff output
- `src-tauri/src/git/local.rs` — `LocalGitExecutor` using `std::process::Command`
- `src-tauri/src/git/wsl.rs` — `WslGitExecutor` using `wsl -e git ...`
- `src-tauri/src/git/ssh.rs` — `SshGitExecutor` using russh exec channel
- `src-tauri/src/git/watcher.rs` — `GitWatcher` for `.git/index` + `.git/HEAD`
- `src-tauri/src/commands/git_commands.rs` — Tauri commands `git_status`, `git_diff`

**Rust backend (modify):**
- `src-tauri/src/lib.rs` — Register git commands + git module
- `src-tauri/src/session/ssh_pool.rs` — Add `exec_command` method
- `src-tauri/src/session/manager.rs` — Expose `exec_command` through SessionManager
- `src-tauri/src/commands/mod.rs` — Add `pub mod git_commands`

**Frontend (new files):**
- `src/store/gitStore.ts` — Zustand store for git state
- `src/hooks/useSessionCwd.ts` — Shared CWD tracking hook
- `src/components/GitPanel/GitPanel.tsx` — Main container
- `src/components/GitPanel/GitPanel.css` — Styles
- `src/components/GitPanel/GitFileList.tsx` — Unstaged/Staged accordion
- `src/components/GitPanel/GitFileEntry.tsx` — Single file row
- `src/components/GitPanel/DiffViewer.tsx` — Main area overlay
- `src/components/GitPanel/DiffViewer.css` — Diff color styles

**Frontend (modify):**
- `src/lib/tauriIpc.ts` — Add git types, IPC methods, event listener
- `src/components/ClaudeCodePanel/ClaudeCodePanel.tsx` — Expand `ClaudeCodeTab` type, use shared CWD hook
- `src/App.tsx` — Add `Ctrl+Shift+G` shortcut, render Git tab, add command palette entry

**Tests (new files):**
- `src-tauri/src/git/parser_test.rs` — Unit tests for git output parsing

---

## Task 1: Rust Types & Git Module Skeleton

**Files:**
- Create: `src-tauri/src/git/mod.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Create git module with type definitions**

Create `src-tauri/src/git/mod.rs`:

```rust
pub mod parser;
pub mod local;
pub mod wsl;
pub mod ssh;
pub mod watcher;

use serde::Serialize;

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum FileStatus {
    Modified,
    Added,
    Deleted,
    Renamed,
    Untracked,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitFileEntry {
    pub path: String,
    pub status: FileStatus,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitStatusResult {
    pub unstaged: Vec<GitFileEntry>,
    pub staged: Vec<GitFileEntry>,
    pub is_git_repo: bool,
}
```

- [ ] **Step 2: Register git module in lib.rs**

In `src-tauri/src/lib.rs`, add `mod git;` alongside the existing `mod claude;`.

- [ ] **Step 3: Create empty submodule files**

Create placeholder files so the module compiles:
- `src-tauri/src/git/parser.rs` — empty
- `src-tauri/src/git/local.rs` — empty
- `src-tauri/src/git/wsl.rs` — empty
- `src-tauri/src/git/ssh.rs` — empty
- `src-tauri/src/git/watcher.rs` — empty

- [ ] **Step 4: Verify it compiles**

Run: `cd src-tauri && cargo check`
Expected: Compiles with no errors (may have unused warnings, that's fine).

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/git/ src-tauri/src/lib.rs
git commit -m "feat(git): add git module skeleton with type definitions"
```

---

## Task 2: Git Output Parser

**Files:**
- Create: `src-tauri/src/git/parser.rs`

The parser converts raw `git status --porcelain` output into structured `GitStatusResult` and detects binary files in diff output. This is the most testable backend component.

- [ ] **Step 1: Write tests for `parse_status`**

Add `#[cfg(test)] mod tests` at the bottom of `parser.rs`:

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use crate::git::{FileStatus, GitFileEntry};

    #[test]
    fn test_parse_status_modified_staged() {
        let output = "M  src/main.rs\n";
        let result = parse_status(output);
        assert!(result.is_git_repo);
        assert_eq!(result.staged.len(), 1);
        assert_eq!(result.staged[0].path, "src/main.rs");
        assert_eq!(result.staged[0].status, FileStatus::Modified);
        assert!(result.unstaged.is_empty());
    }

    #[test]
    fn test_parse_status_modified_unstaged() {
        let output = " M src/main.rs\n";
        let result = parse_status(output);
        assert!(result.is_git_repo);
        assert!(result.staged.is_empty());
        assert_eq!(result.unstaged.len(), 1);
        assert_eq!(result.unstaged[0].path, "src/main.rs");
        assert_eq!(result.unstaged[0].status, FileStatus::Modified);
    }

    #[test]
    fn test_parse_status_both_staged_and_unstaged() {
        let output = "MM src/lib.rs\n";
        let result = parse_status(output);
        assert_eq!(result.staged.len(), 1);
        assert_eq!(result.unstaged.len(), 1);
    }

    #[test]
    fn test_parse_status_added() {
        let output = "A  new_file.rs\n";
        let result = parse_status(output);
        assert_eq!(result.staged[0].status, FileStatus::Added);
    }

    #[test]
    fn test_parse_status_deleted() {
        let output = " D old_file.rs\n";
        let result = parse_status(output);
        assert_eq!(result.unstaged[0].status, FileStatus::Deleted);
    }

    #[test]
    fn test_parse_status_renamed() {
        let output = "R  old.rs -> new.rs\n";
        let result = parse_status(output);
        assert_eq!(result.staged[0].status, FileStatus::Renamed);
        assert_eq!(result.staged[0].path, "new.rs");
    }

    #[test]
    fn test_parse_status_untracked() {
        let output = "?? untracked.txt\n";
        let result = parse_status(output);
        assert_eq!(result.unstaged.len(), 1);
        assert_eq!(result.unstaged[0].status, FileStatus::Untracked);
    }

    #[test]
    fn test_parse_status_empty() {
        let result = parse_status("");
        assert!(result.is_git_repo);
        assert!(result.staged.is_empty());
        assert!(result.unstaged.is_empty());
    }

    #[test]
    fn test_parse_status_multiple_files() {
        let output = "M  staged.rs\n M unstaged.rs\nA  added.rs\n?? untracked.rs\n";
        let result = parse_status(output);
        assert_eq!(result.staged.len(), 2); // M staged.rs + A added.rs
        assert_eq!(result.unstaged.len(), 2); // M unstaged.rs + ?? untracked.rs
    }

    #[test]
    fn test_is_binary_diff() {
        assert!(is_binary_diff("Binary files /dev/null and b/image.png differ\n"));
        assert!(is_binary_diff("Binary files a/old.bin and b/new.bin differ\n"));
        assert!(!is_binary_diff("--- a/file.rs\n+++ b/file.rs\n"));
    }
}
```

- [ ] **Step 2: Run tests — they should fail**

Run: `cd src-tauri && cargo test git::parser`
Expected: FAIL — functions not defined.

- [ ] **Step 3: Implement `parse_status` and `is_binary_diff`**

```rust
use crate::git::{FileStatus, GitFileEntry, GitStatusResult};

/// Parse output of `git status --porcelain`
pub fn parse_status(output: &str) -> GitStatusResult {
    let mut staged = Vec::new();
    let mut unstaged = Vec::new();

    for line in output.lines() {
        if line.len() < 4 {
            continue;
        }

        let index_status = line.as_bytes()[0];
        let worktree_status = line.as_bytes()[1];
        let path_part = &line[3..];

        // Handle rename: "old -> new"
        let path = if let Some(arrow_pos) = path_part.find(" -> ") {
            path_part[arrow_pos + 4..].to_string()
        } else {
            path_part.to_string()
        };

        // Untracked files: "??"
        if index_status == b'?' && worktree_status == b'?' {
            unstaged.push(GitFileEntry {
                path,
                status: FileStatus::Untracked,
            });
            continue;
        }

        // Staged changes (index column)
        if index_status != b' ' && index_status != b'?' {
            staged.push(GitFileEntry {
                path: path.clone(),
                status: char_to_status(index_status),
            });
        }

        // Unstaged changes (worktree column)
        if worktree_status != b' ' && worktree_status != b'?' {
            unstaged.push(GitFileEntry {
                path,
                status: char_to_status(worktree_status),
            });
        }
    }

    GitStatusResult {
        staged,
        unstaged,
        is_git_repo: true,
    }
}

fn char_to_status(c: u8) -> FileStatus {
    match c {
        b'M' => FileStatus::Modified,
        b'A' => FileStatus::Added,
        b'D' => FileStatus::Deleted,
        b'R' => FileStatus::Renamed,
        _ => FileStatus::Modified, // fallback
    }
}

/// Check if a diff output indicates a binary file
pub fn is_binary_diff(diff_output: &str) -> bool {
    diff_output.contains("Binary files") && diff_output.contains("differ")
}
```

- [ ] **Step 4: Run tests — they should pass**

Run: `cd src-tauri && cargo test git::parser`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/git/parser.rs
git commit -m "feat(git): implement git status/diff output parser with tests"
```

---

## Task 3: Local Git Executor

**Files:**
- Create: `src-tauri/src/git/local.rs`

Runs git commands using `std::process::Command` for local Windows sessions.

- [ ] **Step 1: Implement LocalGitExecutor**

```rust
use std::process::Command;
use crate::git::GitStatusResult;
use crate::git::parser;

pub fn status(cwd: &str) -> Result<GitStatusResult, String> {
    let output = Command::new("git")
        .args(["status", "--porcelain"])
        .current_dir(cwd)
        .output()
        .map_err(|e| format!("Failed to run git: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        if stderr.contains("not a git repository") {
            return Ok(GitStatusResult {
                staged: vec![],
                unstaged: vec![],
                is_git_repo: false,
            });
        }
        return Err(format!("git status failed: {stderr}"));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    Ok(parser::parse_status(&stdout))
}

pub fn diff(cwd: &str, file: &str, staged: bool) -> Result<String, String> {
    let mut args = vec!["diff"];
    if staged {
        args.push("--cached");
    }
    args.push("--");
    args.push(file);

    let output = Command::new("git")
        .args(&args)
        .current_dir(cwd)
        .output()
        .map_err(|e| format!("Failed to run git diff: {e}"))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();

    // For untracked files, git diff returns empty. Read file and format as all-added.
    if stdout.is_empty() && !staged {
        let file_path = std::path::Path::new(cwd).join(file);
        if let Ok(content) = std::fs::read_to_string(&file_path) {
            let mut result = format!("--- /dev/null\n+++ b/{}\n", file);
            let lines: Vec<&str> = content.lines().collect();
            result.push_str(&format!("@@ -0,0 +1,{} @@\n", lines.len()));
            for line in &lines {
                result.push('+');
                result.push_str(line);
                result.push('\n');
            }
            return Ok(result);
        }
    }

    // Truncate large diffs (>10,000 lines)
    let line_count = stdout.lines().count();
    if line_count > 10_000 {
        let truncated: String = stdout.lines().take(10_000).collect::<Vec<_>>().join("\n");
        return Ok(format!("{}\n\n--- Diff too large to display ({} lines, showing first 10,000) ---", truncated, line_count));
    }

    Ok(stdout)
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd src-tauri && cargo check`
Expected: Compiles.

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/git/local.rs
git commit -m "feat(git): implement local git executor"
```

---

## Task 4: WSL Git Executor

**Files:**
- Create: `src-tauri/src/git/wsl.rs`

Runs git commands via `wsl -e git -C <cwd> ...`. WSL CWD is a Linux path passed directly.

- [ ] **Step 1: Implement WslGitExecutor**

```rust
use std::process::Command;
use crate::git::GitStatusResult;
use crate::git::parser;

pub fn status(cwd: &str) -> Result<GitStatusResult, String> {
    let output = Command::new("wsl")
        .args(["-e", "git", "-C", cwd, "status", "--porcelain"])
        .output()
        .map_err(|e| format!("Failed to run wsl git: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        if stderr.contains("not a git repository") {
            return Ok(GitStatusResult {
                staged: vec![],
                unstaged: vec![],
                is_git_repo: false,
            });
        }
        return Err(format!("wsl git status failed: {stderr}"));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    Ok(parser::parse_status(&stdout))
}

pub fn diff(cwd: &str, file: &str, staged: bool) -> Result<String, String> {
    let mut args = vec!["-e", "git", "-C", cwd, "diff"];
    if staged {
        args.push("--cached");
    }
    args.push("--");
    args.push(file);

    let output = Command::new("wsl")
        .args(&args)
        .output()
        .map_err(|e| format!("Failed to run wsl git diff: {e}"))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();

    // For untracked files, use /dev/null (available in WSL Linux environment)
    if stdout.is_empty() && !staged {
        let output = Command::new("wsl")
            .args(["-e", "git", "-C", cwd, "diff", "--no-index", "/dev/null", file])
            .output()
            .map_err(|e| format!("Failed to run wsl git diff --no-index: {e}"))?;
        return Ok(String::from_utf8_lossy(&output.stdout).to_string());
    }

    // Truncate large diffs (>10,000 lines)
    let line_count = stdout.lines().count();
    if line_count > 10_000 {
        let truncated: String = stdout.lines().take(10_000).collect::<Vec<_>>().join("\n");
        return Ok(format!("{}\n\n--- Diff too large to display ({} lines, showing first 10,000) ---", truncated, line_count));
    }

    Ok(stdout)
}
```

> **Note:** WSL auto-refresh via `\\wsl$\<distro>\...` UNC path watching is deferred to a follow-up task. For now, WSL sessions use manual refresh + panel switch refresh only (same as SSH). The UNC path approach requires resolving the WSL distro name from session metadata and verifying `notify` crate reliability on UNC paths.

- [ ] **Step 2: Verify it compiles**

Run: `cd src-tauri && cargo check`
Expected: Compiles.

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/git/wsl.rs
git commit -m "feat(git): implement WSL git executor"
```

---

## Task 5: SSH Exec Channel

**Files:**
- Modify: `src-tauri/src/session/ssh_pool.rs`
- Modify: `src-tauri/src/session/manager.rs`

Add `exec_command` method following the same pattern as `open_sftp`.

- [ ] **Step 1: Add `exec_command` to SshConnectionPool**

In `ssh_pool.rs`, add alongside the existing `open_sftp` method:

```rust
pub async fn exec_command(
    &mut self,
    connection_id: &str,
    command: &str,
) -> Result<(String, String, u32), String> {
    let conn = self.connections.get_mut(connection_id)
        .ok_or_else(|| format!("connection not found: {connection_id}"))?;

    let channel = conn.handle.channel_open_session().await
        .map_err(|e| format!("Failed to open exec channel: {e}"))?;

    channel.exec(true, command.as_bytes()).await
        .map_err(|e| format!("Failed to exec command: {e}"))?;

    let mut stdout = Vec::new();
    let mut stderr = Vec::new();
    let mut exit_code: u32 = 0;

    loop {
        match channel.wait().await {
            Some(russh::ChannelMsg::Data { data }) => {
                stdout.extend_from_slice(&data);
            }
            Some(russh::ChannelMsg::ExtendedData { data, ext }) => {
                if ext == 1 { // stderr
                    stderr.extend_from_slice(&data);
                }
            }
            Some(russh::ChannelMsg::ExitStatus { exit_status }) => {
                exit_code = exit_status;
            }
            Some(russh::ChannelMsg::Eof) => {
                // Continue reading; ExitStatus may arrive after EOF
            }
            None => break,
            _ => {}
        }
    }

    let stdout_str = String::from_utf8_lossy(&stdout).to_string();
    let stderr_str = String::from_utf8_lossy(&stderr).to_string();
    Ok((stdout_str, stderr_str, exit_code))
}
```

- [ ] **Step 2: Expose through SessionManager**

In `manager.rs`, add:

```rust
pub async fn exec_command(
    &self,
    connection_id: &str,
    command: &str,
) -> Result<(String, String, u32), String> {
    let mut pool = self.ssh_pool.lock().await;
    pool.exec_command(connection_id, command).await
}
```

- [ ] **Step 3: Verify it compiles**

Run: `cd src-tauri && cargo check`
Expected: Compiles (may have unused warnings).

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/session/ssh_pool.rs src-tauri/src/session/manager.rs
git commit -m "feat(ssh): add exec_command method for running commands via SSH exec channel"
```

---

## Task 6: SSH Git Executor

**Files:**
- Create: `src-tauri/src/git/ssh.rs`

Uses the new `exec_command` to run git commands on remote.

- [ ] **Step 1: Implement SSH executor**

```rust
use crate::git::GitStatusResult;
use crate::git::parser;
use crate::session::manager::SessionManager;

pub async fn status(
    state: &SessionManager,
    connection_id: &str,
    cwd: &str,
) -> Result<GitStatusResult, String> {
    let command = format!("cd {} && git status --porcelain", shell_escape(cwd));
    let (stdout, stderr, exit_code) = state.exec_command(connection_id, &command).await?;

    if exit_code != 0 {
        if stderr.contains("not a git repository") {
            return Ok(GitStatusResult {
                staged: vec![],
                unstaged: vec![],
                is_git_repo: false,
            });
        }
        return Err(format!("git status failed: {stderr}"));
    }

    Ok(parser::parse_status(&stdout))
}

pub async fn diff(
    state: &SessionManager,
    connection_id: &str,
    cwd: &str,
    file: &str,
    staged: bool,
) -> Result<String, String> {
    let staged_flag = if staged { " --cached" } else { "" };
    let command = format!(
        "cd {} && git diff{} -- {}",
        shell_escape(cwd),
        staged_flag,
        shell_escape(file)
    );
    let (stdout, stderr, exit_code) = state.exec_command(connection_id, &command).await?;

    if exit_code != 0 && !stderr.is_empty() {
        return Err(format!("git diff failed: {stderr}"));
    }

    // For untracked files
    if stdout.is_empty() && !staged {
        let command = format!(
            "cd {} && git diff --no-index /dev/null {}",
            shell_escape(cwd),
            shell_escape(file)
        );
        let (stdout, _, _) = state.exec_command(connection_id, &command).await?;
        return Ok(stdout);
    }

    // Truncate large diffs (>10,000 lines)
    let line_count = stdout.lines().count();
    if line_count > 10_000 {
        let truncated: String = stdout.lines().take(10_000).collect::<Vec<_>>().join("\n");
        return Ok(format!("{}\n\n--- Diff too large to display ({} lines, showing first 10,000) ---", truncated, line_count));
    }

    Ok(stdout)
}

fn shell_escape(s: &str) -> String {
    format!("'{}'", s.replace('\'', "'\\''"))
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd src-tauri && cargo check`
Expected: Compiles.

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/git/ssh.rs
git commit -m "feat(git): implement SSH git executor via exec channel"
```

---

## Task 7: Tauri Commands with Session Routing

**Files:**
- Create: `src-tauri/src/commands/git_commands.rs`
- Modify: `src-tauri/src/commands/mod.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Create git commands with session type routing**

Create `src-tauri/src/commands/git_commands.rs`:

```rust
use crate::git::{self, GitStatusResult};
use crate::session::manager::SessionManager;
use crate::session::SessionType;

#[tauri::command]
pub async fn git_status(
    state: tauri::State<'_, SessionManager>,
    session_id: String,
    cwd: String,
) -> Result<GitStatusResult, String> {
    let (session_type, connection_id) = state.get_session_info(&session_id).await?;

    match session_type {
        SessionType::Local => git::local::status(&cwd),
        SessionType::Wsl => git::wsl::status(&cwd),
        SessionType::Ssh => {
            let conn_id = connection_id.ok_or("no connection_id for SSH session")?;
            git::ssh::status(&state, &conn_id, &cwd).await
        }
    }
}

#[tauri::command]
pub async fn git_diff(
    state: tauri::State<'_, SessionManager>,
    session_id: String,
    cwd: String,
    file: String,
    staged: bool,
) -> Result<String, String> {
    let (session_type, connection_id) = state.get_session_info(&session_id).await?;

    match session_type {
        SessionType::Local => git::local::diff(&cwd, &file, staged),
        SessionType::Wsl => git::wsl::diff(&cwd, &file, staged),
        SessionType::Ssh => {
            let conn_id = connection_id.ok_or("no connection_id for SSH session")?;
            git::ssh::diff(&state, &conn_id, &cwd, &file, staged).await
        }
    }
}
```

- [ ] **Step 2: Register module in commands/mod.rs**

Add `pub mod git_commands;` to `src-tauri/src/commands/mod.rs`.

- [ ] **Step 3: Register commands in lib.rs**

Add to the `tauri::generate_handler!` invocation in `src-tauri/src/lib.rs`:
```rust
commands::git_commands::git_status,
commands::git_commands::git_diff,
```

- [ ] **Step 4: Verify it compiles**

Run: `cd src-tauri && cargo check`
Expected: Compiles.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/commands/git_commands.rs src-tauri/src/commands/mod.rs src-tauri/src/lib.rs
git commit -m "feat(git): add Tauri commands for git_status and git_diff with session routing"
```

---

## Task 8: Git File Watcher

**Files:**
- Create: `src-tauri/src/git/watcher.rs`

Watches `.git/index` and `.git/HEAD` with 500ms debounce. Follows `ClaudeMdWatcher` pattern from `src-tauri/src/claude/file_watcher.rs`.

- [ ] **Step 1: Implement GitWatcher**

```rust
use notify::{Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};

pub struct GitWatcher {
    watcher: Option<RecommendedWatcher>,
    watched_git_dir: Option<PathBuf>,
}

impl GitWatcher {
    pub fn new() -> Self {
        Self {
            watcher: None,
            watched_git_dir: None,
        }
    }

    pub fn watch(&mut self, git_dir: PathBuf, app: AppHandle) {
        // Stop previous watcher
        self.stop();

        let cwd = git_dir.parent()
            .unwrap_or(&git_dir)
            .to_string_lossy()
            .to_string();

        let last_emit = Arc::new(Mutex::new(Instant::now() - Duration::from_secs(1)));
        let last_emit_clone = Arc::clone(&last_emit);
        let app_clone = app.clone();
        let cwd_clone = cwd.clone();

        let mut watcher = match notify::recommended_watcher(move |res: Result<Event, _>| {
            if let Ok(event) = res {
                match event.kind {
                    EventKind::Modify(_) | EventKind::Create(_) | EventKind::Remove(_) => {
                        let mut last = last_emit_clone.lock().unwrap();
                        if last.elapsed() >= Duration::from_millis(500) {
                            *last = Instant::now();
                            let _ = app_clone.emit(
                                "git-status-changed",
                                serde_json::json!({ "cwd": cwd_clone }),
                            );
                        }
                    }
                    _ => {}
                }
            }
        }) {
            Ok(w) => w,
            Err(e) => {
                eprintln!("Failed to create git watcher: {e}");
                return;
            }
        };

        let index_path = git_dir.join("index");
        let head_path = git_dir.join("HEAD");

        // Watch .git/index and .git/HEAD (non-recursive)
        let _ = watcher.watch(&index_path, RecursiveMode::NonRecursive);
        let _ = watcher.watch(&head_path, RecursiveMode::NonRecursive);

        self.watcher = Some(watcher);
        self.watched_git_dir = Some(git_dir);
    }

    pub fn stop(&mut self) {
        self.watcher = None;
        self.watched_git_dir = None;
    }
}
```

- [ ] **Step 2: Wire GitWatcher into Tauri state and git_commands**

In `src-tauri/src/lib.rs`, add `GitWatcher` as managed state wrapped in a `Mutex`:

```rust
use std::sync::Mutex;
use git::watcher::GitWatcher;

// In the Tauri builder, alongside other managed state:
.manage(Mutex::new(GitWatcher::new()))
```

In `src-tauri/src/commands/git_commands.rs`, update `git_status` to start the watcher for local sessions:

```rust
use crate::git::watcher::GitWatcher;
use std::sync::Mutex;

#[tauri::command]
pub async fn git_status(
    state: tauri::State<'_, SessionManager>,
    watcher: tauri::State<'_, Mutex<GitWatcher>>,
    app: tauri::AppHandle,
    session_id: String,
    cwd: String,
) -> Result<GitStatusResult, String> {
    let (session_type, connection_id) = state.get_session_info(&session_id).await?;

    let result = match session_type {
        SessionType::Local => git::local::status(&cwd),
        SessionType::Wsl => git::wsl::status(&cwd),
        SessionType::Ssh => {
            let conn_id = connection_id.ok_or("no connection_id for SSH session")?;
            git::ssh::status(&state, &conn_id, &cwd).await
        }
    }?;

    // Start file watcher for local sessions if this is a git repo
    if result.is_git_repo && matches!(session_type, SessionType::Local) {
        let git_dir = std::path::PathBuf::from(&cwd).join(".git");
        if git_dir.exists() {
            if let Ok(mut w) = watcher.lock() {
                w.watch(git_dir, app);
            }
        }
    }

    Ok(result)
}
```

- [ ] **Step 3: Verify it compiles**

Run: `cd src-tauri && cargo check`
Expected: Compiles.

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/git/watcher.rs src-tauri/src/commands/git_commands.rs src-tauri/src/lib.rs
git commit -m "feat(git): implement GitWatcher for .git/index and .git/HEAD with Tauri state wiring"
```

---

## Task 9: Frontend IPC Interface

**Files:**
- Modify: `src/lib/tauriIpc.ts`

Add Git types, IPC methods, and event listener following existing patterns.

- [ ] **Step 1: Add TypeScript types**

Add to `tauriIpc.ts` near the existing type definitions:

```typescript
// ── Git types ──

export type GitFileStatus = "modified" | "added" | "deleted" | "renamed" | "untracked";

export interface GitFileEntry {
  path: string;
  status: GitFileStatus;
}

export interface GitStatusResult {
  unstaged: GitFileEntry[];
  staged: GitFileEntry[];
  isGitRepo: boolean;
}
```

- [ ] **Step 2: Add IPC command methods**

Add to the `ipc` object:

```typescript
async getGitStatus(sessionId: string, cwd: string): Promise<GitStatusResult> {
  return invoke<GitStatusResult>("git_status", { sessionId, cwd });
},

async getGitDiff(sessionId: string, cwd: string, file: string, staged: boolean): Promise<string> {
  return invoke<string>("git_diff", { sessionId, cwd, file, staged });
},
```

- [ ] **Step 3: Add event listener with singleton pattern**

Add the `onGitStatusChanged` listener following the `onClaudeMdChanged` pattern:

```typescript
type GitStatusChangedHandler = (payload: { cwd: string }) => void;
const gitStatusChangedHandlers: Set<GitStatusChangedHandler> = new Set();
let gitStatusChangedUnlisten: UnlistenFn | null = null;
let gitStatusChangedListenerPromise: Promise<void> | null = null;

async function ensureGitStatusChangedListener(): Promise<void> {
  if (gitStatusChangedUnlisten) return;
  if (!gitStatusChangedListenerPromise) {
    gitStatusChangedListenerPromise = listen<{ cwd: string }>(
      "git-status-changed",
      (event) => {
        for (const handler of gitStatusChangedHandlers) {
          handler(event.payload);
        }
      }
    ).then((unlisten) => {
      gitStatusChangedUnlisten = unlisten;
    });
  }
  return gitStatusChangedListenerPromise;
}
```

Add to the `ipc` object:

```typescript
async onGitStatusChanged(handler: GitStatusChangedHandler): Promise<() => void> {
  await ensureGitStatusChangedListener();
  gitStatusChangedHandlers.add(handler);
  return () => {
    gitStatusChangedHandlers.delete(handler);
  };
},
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npm run check` or `npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/tauriIpc.ts
git commit -m "feat(git): add git IPC types, commands, and event listener"
```

---

## Task 10: Zustand Git Store

**Files:**
- Create: `src/store/gitStore.ts`

Follows the exact pattern of `claudeCodeStore.ts`.

- [ ] **Step 1: Create the store**

```typescript
import { create } from "zustand";
import { ipc, GitFileEntry, GitStatusResult } from "../lib/tauriIpc";

interface GitState {
  trackedSessionId: string | null;
  trackedCwd: string | null;
  isGitRepo: boolean;

  unstagedFiles: GitFileEntry[];
  stagedFiles: GitFileEntry[];

  selectedFile: { path: string; staged: boolean } | null;
  diffContent: string | null;

  loading: boolean;
  error: string | null;

  setTrackedSession: (sessionId: string | null) => void;
  setCwd: (cwd: string | null) => void;
  refreshStatus: () => Promise<void>;
  selectFile: (path: string, staged: boolean) => Promise<void>;
  clearSelection: () => void;
  clear: () => void;
}

export const useGitStore = create<GitState>((set, get) => ({
  trackedSessionId: null,
  trackedCwd: null,
  isGitRepo: false,
  unstagedFiles: [],
  stagedFiles: [],
  selectedFile: null,
  diffContent: null,
  loading: false,
  error: null,

  setTrackedSession: (sessionId) => {
    set({
      trackedSessionId: sessionId,
      trackedCwd: null,
      isGitRepo: false,
      unstagedFiles: [],
      stagedFiles: [],
      selectedFile: null,
      diffContent: null,
      error: null,
    });
  },

  setCwd: (cwd) => {
    const state = get();
    if (state.trackedCwd === cwd) return;
    set({ trackedCwd: cwd, selectedFile: null, diffContent: null });
    if (cwd) {
      get().refreshStatus();
    } else {
      set({ unstagedFiles: [], stagedFiles: [], isGitRepo: false });
    }
  },

  refreshStatus: async () => {
    const { trackedSessionId, trackedCwd } = get();
    if (!trackedSessionId || !trackedCwd) {
      set({ unstagedFiles: [], stagedFiles: [], isGitRepo: false, loading: false });
      return;
    }
    set({ loading: true, error: null });
    try {
      const result = await ipc.getGitStatus(trackedSessionId, trackedCwd);
      set({
        unstagedFiles: result.unstaged,
        stagedFiles: result.staged,
        isGitRepo: result.isGitRepo,
        loading: false,
      });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  selectFile: async (path, staged) => {
    const { trackedSessionId, trackedCwd } = get();
    if (!trackedSessionId || !trackedCwd) return;

    set({ selectedFile: { path, staged }, diffContent: null });
    try {
      const diff = await ipc.getGitDiff(trackedSessionId, trackedCwd, path, staged);
      set({ diffContent: diff });
    } catch (e) {
      set({ diffContent: `Error loading diff: ${e}` });
    }
  },

  clearSelection: () => {
    set({ selectedFile: null, diffContent: null });
  },

  clear: () => {
    set({
      trackedCwd: null,
      isGitRepo: false,
      unstagedFiles: [],
      stagedFiles: [],
      selectedFile: null,
      diffContent: null,
      loading: false,
      error: null,
    });
  },
}));
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add src/store/gitStore.ts
git commit -m "feat(git): add Zustand git store"
```

---

## Task 11: useSessionCwd Shared Hook

**Files:**
- Create: `src/hooks/useSessionCwd.ts`
- Modify: `src/components/ClaudeCodePanel/ClaudeCodePanel.tsx`

Extract CWD tracking logic into a reusable hook.

- [ ] **Step 1: Create the shared hook**

```typescript
import { useEffect, useRef, useState } from "react";
import { ipc } from "../lib/tauriIpc";

/**
 * Shared hook for tracking a session's current working directory.
 * Fetches CWD on mount and subscribes to CWD change events.
 */
export function useSessionCwd(sessionId: string | null): string | null {
  const [cwd, setCwd] = useState<string | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    // Clean up previous subscription
    unsubRef.current?.();
    unsubRef.current = null;
    setCwd(null);

    if (!sessionId) return;

    // Fetch initial CWD
    ipc.getSessionCwd(sessionId).then((result) => {
      if ("value" in result) {
        setCwd(result.value);
      }
    });

    // Subscribe to CWD changes
    ipc.onSessionCwd(sessionId, (newCwd) => {
      setCwd(newCwd);
    }).then((unsub) => {
      unsubRef.current = unsub;
    });

    return () => {
      unsubRef.current?.();
      unsubRef.current = null;
    };
  }, [sessionId]);

  return cwd;
}
```

- [ ] **Step 2: Refactor ClaudeCodePanel to use the shared hook**

In `ClaudeCodePanel.tsx`, replace the inline CWD tracking logic with `useSessionCwd`. The `useEffect` that calls `ipc.getSessionCwd` and `ipc.onSessionCwd` should be replaced with:

```typescript
import { useSessionCwd } from "../../hooks/useSessionCwd";

// Inside component:
const cwd = useSessionCwd(focusedSessionId ?? null);

useEffect(() => {
  if (focusedSessionId) {
    setTrackedSession(focusedSessionId);
  }
}, [focusedSessionId, setTrackedSession]);

useEffect(() => {
  if (cwd) {
    setCwd(cwd);
  }
}, [cwd, setCwd]);
```

Remove the old `useEffect` blocks that handled `getSessionCwd` and `onSessionCwd` directly.

- [ ] **Step 3: Verify it compiles and existing behavior is unchanged**

Run: `npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useSessionCwd.ts src/components/ClaudeCodePanel/ClaudeCodePanel.tsx
git commit -m "refactor: extract useSessionCwd shared hook from ClaudeCodePanel"
```

---

## Task 12: GitPanel Component (Sidebar)

**Files:**
- Create: `src/components/GitPanel/GitPanel.tsx`
- Create: `src/components/GitPanel/GitPanel.css`
- Create: `src/components/GitPanel/GitFileList.tsx`
- Create: `src/components/GitPanel/GitFileEntry.tsx`

- [ ] **Step 1: Create GitFileEntry component**

```tsx
import React from "react";
import { GitFileEntry as GitFileEntryType } from "../../lib/tauriIpc";

interface Props {
  entry: GitFileEntryType;
  selected: boolean;
  onClick: () => void;
}

const STATUS_COLORS: Record<string, string> = {
  modified: "var(--git-modified, #e2b714)",
  added: "var(--git-added, #2ea043)",
  deleted: "var(--git-deleted, #f85149)",
  renamed: "var(--git-renamed, #58a6ff)",
  untracked: "var(--git-untracked, #8b949e)",
};

const STATUS_LABELS: Record<string, string> = {
  modified: "M",
  added: "A",
  deleted: "D",
  renamed: "R",
  untracked: "?",
};

export const GitFileEntryRow: React.FC<Props> = ({ entry, selected, onClick }) => {
  const color = STATUS_COLORS[entry.status] || "#8b949e";
  const label = STATUS_LABELS[entry.status] || "?";

  return (
    <div
      className={`git-file-entry ${selected ? "git-file-entry--selected" : ""}`}
      onClick={onClick}
      title={entry.path}
    >
      <span className="git-file-status" style={{ color }}>{label}</span>
      <span className="git-file-path">{entry.path}</span>
    </div>
  );
};
```

- [ ] **Step 2: Create GitFileList component**

```tsx
import React, { useState } from "react";
import { GitFileEntry } from "../../lib/tauriIpc";
import { GitFileEntryRow } from "./GitFileEntry";

interface Props {
  title: string;
  files: GitFileEntry[];
  selectedPath: string | null;
  selectedStaged: boolean;
  isStaged: boolean;
  onFileClick: (path: string, staged: boolean) => void;
}

export const GitFileList: React.FC<Props> = ({
  title,
  files,
  selectedPath,
  selectedStaged,
  isStaged,
  onFileClick,
}) => {
  const [expanded, setExpanded] = useState(true);

  if (files.length === 0) return null;

  return (
    <div className="git-file-list">
      <div
        className="git-file-list__header"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="git-file-list__arrow">{expanded ? "▼" : "▶"}</span>
        <span className="git-file-list__title">{title}</span>
        <span className="git-file-list__count">{files.length}</span>
      </div>
      {expanded && (
        <div className="git-file-list__items">
          {files.map((file) => (
            <GitFileEntryRow
              key={`${isStaged ? "s" : "u"}-${file.path}`}
              entry={file}
              selected={selectedPath === file.path && selectedStaged === isStaged}
              onClick={() => onFileClick(file.path, isStaged)}
            />
          ))}
        </div>
      )}
    </div>
  );
};
```

- [ ] **Step 3: Create GitPanel component**

```tsx
import React, { useEffect } from "react";
import { useGitStore } from "../../store/gitStore";
import { useSessionCwd } from "../../hooks/useSessionCwd";
import { ipc } from "../../lib/tauriIpc";
import { GitFileList } from "./GitFileList";
import "./GitPanel.css";

interface Props {
  focusedSessionId?: string;
}

export const GitPanel: React.FC<Props> = ({ focusedSessionId }) => {
  const store = useGitStore();
  const cwd = useSessionCwd(focusedSessionId ?? null);

  // Track session
  useEffect(() => {
    store.setTrackedSession(focusedSessionId ?? null);
  }, [focusedSessionId]);

  // Track CWD
  useEffect(() => {
    store.setCwd(cwd);
  }, [cwd]);

  // Subscribe to git status changes (file watcher)
  useEffect(() => {
    let unsub: (() => void) | null = null;
    ipc.onGitStatusChanged((payload) => {
      const currentCwd = useGitStore.getState().trackedCwd;
      if (payload.cwd === currentCwd) {
        useGitStore.getState().refreshStatus();
      }
    }).then((u) => { unsub = u; });
    return () => { unsub?.(); };
  }, []);

  const handleFileClick = (path: string, staged: boolean) => {
    store.selectFile(path, staged);
  };

  const handleRefresh = () => {
    store.refreshStatus();
  };

  if (!focusedSessionId) {
    return <div className="git-panel__empty">No active session</div>;
  }

  if (store.loading) {
    return <div className="git-panel__loading">Loading...</div>;
  }

  if (store.error) {
    return <div className="git-panel__error">{store.error}</div>;
  }

  if (!store.isGitRepo) {
    return <div className="git-panel__empty">Not a git repository</div>;
  }

  const hasChanges = store.unstagedFiles.length > 0 || store.stagedFiles.length > 0;

  return (
    <div className="git-panel">
      <div className="git-panel__header">
        <span className="git-panel__title">Changes</span>
        <button className="git-panel__refresh" onClick={handleRefresh} title="Refresh">
          ↻
        </button>
      </div>
      {!hasChanges ? (
        <div className="git-panel__empty">No changes</div>
      ) : (
        <div className="git-panel__content">
          <GitFileList
            title="Unstaged Changes"
            files={store.unstagedFiles}
            selectedPath={store.selectedFile?.path ?? null}
            selectedStaged={store.selectedFile?.staged ?? false}
            isStaged={false}
            onFileClick={handleFileClick}
          />
          <GitFileList
            title="Staged Changes"
            files={store.stagedFiles}
            selectedPath={store.selectedFile?.path ?? null}
            selectedStaged={store.selectedFile?.staged ?? false}
            isStaged={true}
            onFileClick={handleFileClick}
          />
        </div>
      )}
    </div>
  );
};
```

- [ ] **Step 4: Create GitPanel.css**

```css
.git-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow-y: auto;
}

.git-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-color, #333);
}

.git-panel__title {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-secondary, #999);
}

.git-panel__refresh {
  background: none;
  border: none;
  color: var(--text-secondary, #999);
  cursor: pointer;
  font-size: 14px;
  padding: 2px 6px;
  border-radius: 4px;
}

.git-panel__refresh:hover {
  background: var(--hover-bg, #ffffff10);
  color: var(--text-primary, #fff);
}

.git-panel__content {
  flex: 1;
  overflow-y: auto;
}

.git-panel__empty,
.git-panel__loading,
.git-panel__error {
  padding: 16px 12px;
  color: var(--text-secondary, #999);
  font-size: 13px;
  text-align: center;
}

.git-panel__error {
  color: var(--git-deleted, #f85149);
}

/* File list */
.git-file-list__header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  cursor: pointer;
  user-select: none;
  font-size: 12px;
  color: var(--text-secondary, #999);
}

.git-file-list__header:hover {
  background: var(--hover-bg, #ffffff08);
}

.git-file-list__arrow {
  font-size: 10px;
  width: 12px;
}

.git-file-list__title {
  flex: 1;
  font-weight: 500;
}

.git-file-list__count {
  background: var(--badge-bg, #ffffff15);
  padding: 1px 6px;
  border-radius: 8px;
  font-size: 11px;
}

/* File entry */
.git-file-entry {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 12px 4px 30px;
  cursor: pointer;
  font-size: 13px;
  font-family: "JetBrains Mono", monospace;
}

.git-file-entry:hover {
  background: var(--hover-bg, #ffffff08);
}

.git-file-entry--selected {
  background: var(--selected-bg, #ffffff15);
}

.git-file-status {
  font-weight: 600;
  width: 14px;
  text-align: center;
}

.git-file-path {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-primary, #e0e0e0);
}
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/GitPanel/
git commit -m "feat(git): add GitPanel sidebar components"
```

---

## Task 13: DiffViewer Component (Main Area Overlay)

**Files:**
- Create: `src/components/GitPanel/DiffViewer.tsx`
- Create: `src/components/GitPanel/DiffViewer.css`

- [ ] **Step 1: Create DiffViewer component**

```tsx
import React, { useEffect, useMemo, useRef } from "react";
import { EditorView } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import {
  Decoration,
  DecorationSet,
  ViewPlugin,
  ViewUpdate,
} from "@codemirror/view";
import { cmTheme } from "../../lib/codemirrorSetup";
import { useGitStore } from "../../store/gitStore";
import "./DiffViewer.css";

// Build diff line decorations
function buildDiffDecorations(doc: string): DecorationSet {
  const builder: Array<{ from: number; to: number; deco: Decoration }> = [];
  let pos = 0;

  for (const line of doc.split("\n")) {
    const lineEnd = pos + line.length;

    if (line.startsWith("+") && !line.startsWith("+++")) {
      builder.push({
        from: pos,
        to: lineEnd,
        deco: Decoration.line({ class: "diff-line-added" }),
      });
    } else if (line.startsWith("-") && !line.startsWith("---")) {
      builder.push({
        from: pos,
        to: lineEnd,
        deco: Decoration.line({ class: "diff-line-deleted" }),
      });
    } else if (line.startsWith("@@")) {
      builder.push({
        from: pos,
        to: lineEnd,
        deco: Decoration.line({ class: "diff-line-hunk" }),
      });
    }

    pos = lineEnd + 1; // +1 for newline
  }

  return Decoration.set(
    builder.map((b) => b.deco.range(b.from)),
    true
  );
}

const diffDecoPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = buildDiffDecorations(view.state.doc.toString());
    }
    update(update: ViewUpdate) {
      if (update.docChanged) {
        this.decorations = buildDiffDecorations(update.state.doc.toString());
      }
    }
  },
  { decorations: (v) => v.decorations }
);

export const DiffViewer: React.FC = () => {
  const { selectedFile, diffContent, clearSelection } = useGitStore();
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  // Handle ESC key
  useEffect(() => {
    if (!selectedFile) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        clearSelection();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [selectedFile, clearSelection]);

  // Create/update CodeMirror editor
  useEffect(() => {
    if (!editorRef.current || !diffContent) {
      viewRef.current?.destroy();
      viewRef.current = null;
      return;
    }

    const isBinary =
      diffContent.includes("Binary files") && diffContent.includes("differ");

    if (isBinary) {
      // Don't create editor for binary files
      return;
    }

    const state = EditorState.create({
      doc: diffContent,
      extensions: [
        EditorView.editable.of(false),
        EditorState.readOnly.of(true),
        cmTheme,
        diffDecoPlugin,
        EditorView.lineWrapping,
      ],
    });

    viewRef.current?.destroy();
    viewRef.current = new EditorView({
      state,
      parent: editorRef.current,
    });

    return () => {
      viewRef.current?.destroy();
      viewRef.current = null;
    };
  }, [diffContent]);

  if (!selectedFile) return null;

  const isBinary =
    diffContent?.includes("Binary files") && diffContent?.includes("differ");
  const isEmpty = diffContent !== null && diffContent.trim() === "";
  const stageLabel = selectedFile.staged ? "staged" : "unstaged";

  return (
    <div className="diff-overlay" onClick={(e) => {
      if (e.target === e.currentTarget) clearSelection();
    }}>
      <div className="diff-viewer">
        <div className="diff-viewer__header">
          <span className="diff-viewer__filename">
            {selectedFile.path}
            <span className="diff-viewer__stage-label">{stageLabel}</span>
          </span>
          <button className="diff-viewer__close" onClick={clearSelection}>
            ✕
          </button>
        </div>
        <div className="diff-viewer__content">
          {diffContent === null && (
            <div className="diff-viewer__loading">Loading diff...</div>
          )}
          {isBinary && (
            <div className="diff-viewer__message">
              Binary file — diff not available
            </div>
          )}
          {isEmpty && (
            <div className="diff-viewer__message">No changes</div>
          )}
          {!isBinary && !isEmpty && <div ref={editorRef} className="diff-viewer__editor" />}
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Create DiffViewer.css**

```css
.diff-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
}

.diff-viewer {
  background: var(--panel-bg, #1e1e1e);
  border: 1px solid var(--border-color, #333);
  border-radius: 8px;
  width: 80vw;
  max-width: 1000px;
  height: 80vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.diff-viewer__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  border-bottom: 1px solid var(--border-color, #333);
  background: var(--header-bg, #252525);
}

.diff-viewer__filename {
  font-family: "JetBrains Mono", monospace;
  font-size: 13px;
  color: var(--text-primary, #e0e0e0);
  display: flex;
  align-items: center;
  gap: 8px;
}

.diff-viewer__stage-label {
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--badge-bg, #ffffff15);
  color: var(--text-secondary, #999);
}

.diff-viewer__close {
  background: none;
  border: none;
  color: var(--text-secondary, #999);
  cursor: pointer;
  font-size: 16px;
  padding: 4px 8px;
  border-radius: 4px;
}

.diff-viewer__close:hover {
  background: var(--hover-bg, #ffffff10);
  color: var(--text-primary, #fff);
}

.diff-viewer__content {
  flex: 1;
  overflow: auto;
}

.diff-viewer__editor {
  height: 100%;
}

.diff-viewer__editor .cm-editor {
  height: 100%;
}

.diff-viewer__loading,
.diff-viewer__message {
  padding: 24px;
  text-align: center;
  color: var(--text-secondary, #999);
  font-size: 13px;
}

/* Diff line decorations */
.diff-line-added {
  background-color: rgba(46, 160, 67, 0.15);
}

.diff-line-deleted {
  background-color: rgba(248, 81, 73, 0.15);
}

.diff-line-hunk {
  background-color: rgba(88, 166, 255, 0.1);
  color: var(--git-renamed, #58a6ff);
}
```

> **Note:** Dual-gutter line numbers (old/new side-by-side line numbers as specified in the design spec) are deferred to a follow-up task. This requires a custom CodeMirror gutter extension that parses hunk headers to track old/new line numbers separately. The current implementation shows standard single-column line numbers.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/GitPanel/DiffViewer.tsx src/components/GitPanel/DiffViewer.css
git commit -m "feat(git): add DiffViewer overlay component with CodeMirror"
```

---

## Task 14: App.tsx Integration

**Files:**
- Modify: `src/components/ClaudeCodePanel/ClaudeCodePanel.tsx`
- Modify: `src/App.tsx`

Wire everything together: expand tab type, add keyboard shortcut, render Git tab and DiffViewer.

- [ ] **Step 1: Expand ClaudeCodeTab type**

In `ClaudeCodePanel.tsx`, change:
```typescript
export type ClaudeCodeTab = "claude-md";
```
to:
```typescript
export type ClaudeCodeTab = "claude-md" | "git";
```

- [ ] **Step 2: Add Git tab rendering in ClaudeCodePanel**

In `ClaudeCodePanel.tsx`, add the Git tab button to the tab strip and conditionally render `GitPanel` when `activeTab === "git"`:

```tsx
import { GitPanel } from "../GitPanel/GitPanel";

// In the tab strip JSX:
<button
  className={`claude-panel-tab${activeTab === "git" ? " claude-panel-tab--active" : ""}`}
  onClick={() => onTabChange("git")}
>
  Git
</button>

// In the content area:
{activeTab === "git" && (
  <GitPanel focusedSessionId={focusedSessionId} />
)}
```

- [ ] **Step 3: Add Ctrl+Shift+G shortcut in App.tsx**

In `App.tsx`, add alongside the existing `Ctrl+Shift+L` handler:

```typescript
// In the keyboard shortcut handler:
if (e.ctrlKey && e.shiftKey && e.key === "G") {
  e.preventDefault();
  // Open Claude panel and switch to Git tab
  if (!claudePanelOpen) {
    setClaudePanelOpen(true);
    localStorage.setItem("v-terminal:claude-panel-open", "true");
  }
  setClaudePanelTab("git");
  return;
}
```

- [ ] **Step 4: Render DiffViewer at the App level**

In `App.tsx`, add the DiffViewer component outside of the panel layout so it renders as a full overlay:

```tsx
import { DiffViewer } from "./components/GitPanel/DiffViewer";

// At the end of the App component return, before closing fragment:
<DiffViewer />
```

- [ ] **Step 5: Add command palette entry**

Add a "Show Git Panel" entry to the command palette alongside "Show/Hide Claude Code Panel":

```typescript
{
  id: "view:git-panel",
  label: "Show Git Panel",
  description: "Toggle the Git diff viewer panel",
  meta: "Ctrl+Shift+G",
  action: () => {
    if (!claudePanelOpen) {
      setClaudePanelOpen(true);
      localStorage.setItem("v-terminal:claude-panel-open", "true");
    }
    setClaudePanelTab("git");
  },
},
```

- [ ] **Step 6: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/ClaudeCodePanel/ClaudeCodePanel.tsx src/App.tsx
git commit -m "feat(git): integrate Git panel into App with Ctrl+Shift+G shortcut"
```

---

## Task 15: Manual Integration Test

End-to-end verification across all environments.

- [ ] **Step 1: Build and verify**

Run: `npm run tauri dev`
Expected: App launches without errors.

- [ ] **Step 2: Test local session**

1. Open a local terminal session
2. Navigate to a git repository
3. Press `Ctrl+Shift+G` → Git panel opens in left sidebar
4. Verify unstaged/staged files are listed
5. Click a file → diff overlay opens with colored lines
6. Press ESC → overlay closes
7. Click refresh (↻) → list updates

- [ ] **Step 3: Test WSL session**

1. Open a WSL terminal session
2. Navigate to a git repo inside WSL
3. Open Git panel → files should list correctly
4. Click a file → diff should display

- [ ] **Step 4: Test SSH session**

1. Connect to an SSH session
2. Navigate to a remote git repo
3. Open Git panel → files should list (may take slightly longer)
4. Click a file → diff should display
5. Verify no interference with the PTY session

- [ ] **Step 5: Test edge cases**

1. Navigate to a non-git directory → "Not a git repository" shown
2. Navigate back to a git repo → file list auto-refreshes
3. Open Git panel with no active session → "No active session" shown
4. Modify a file in a local session → file list auto-updates (watcher)

- [ ] **Step 6: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix(git): integration test fixes"
```
