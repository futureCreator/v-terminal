# Git Diff Viewer — Design Spec

## Overview

A read-only Git diff viewer integrated into the left sidebar of v-terminal. Displays changed file lists (unstaged/staged) and renders unified diffs in the main area. Works across local, WSL, and SSH sessions.

## Goals

- View Git changes without leaving the terminal
- Support all three session types: Local (Windows), WSL, SSH
- Read-only — no staging, committing, or branch operations
- Minimal impact on existing terminal workflow

## Non-Goals

- Git staging, committing, or push operations
- Branch management, log viewer, merge UI
- Side-by-side diff view (future consideration)

---

## Architecture

### UI Layout

The Git tab is added **inside the existing ClaudeCodePanel's tab strip**. The `ClaudeCodeTab` type expands to `"claude-md" | "git"`. The panel remains on the left side of the terminal area at 300px width.

- **Sidebar (Git tab):** File list grouped into Unstaged / Staged accordion sections
- **Main area overlay:** Unified diff viewer, opened by clicking a file in the sidebar

```
+---------------+--------------------------------+
| [Claude][Git] |         Terminal                |
|               |                                |
| > Unstaged (3)|                                |
|   M file.rs   |                                |
|   M app.tsx    |                                |
|   D old.ts     |                                |
|               |                                |
| > Staged (1)  |                                |
|   A helper.rs  |                                |
+---------------+--------------------------------+
```

When a file is clicked:

```
+---------------+--------------------------------+
| [Claude][Git] |  x  src/lib.rs (unstaged)      |
|               |                                |
| > Unstaged (3)|  @@ -10,6 +10,8 @@             |
|   M file.rs   |   fn existing() {}             |
|  >M lib.rs    |  +fn new_func() {              |
|   D old.ts    |  +    todo!()                  |
|               |  +}                             |
| > Staged (1)  |  -fn old_func() {}             |
|   A helper.rs |                                |
+---------------+--------------------------------+
```

---

### Git Command Execution Layer

A `GitExecutor` trait abstracts git command execution across environments. Path parameters use `&str` (not `&Path`) because SSH paths are always strings and need to work uniformly across all three environments.

```rust
trait GitExecutor {
    async fn status(&self, cwd: &str) -> Result<GitStatus>;
    async fn diff_unstaged(&self, cwd: &str, file: &str) -> Result<String>;
    async fn diff_staged(&self, cwd: &str, file: &str) -> Result<String>;
}
```

**Three implementations:**

**Local (Windows):**
- `std::process::Command` — run `git` directly with CWD set to the tracked directory.

**WSL:**
- `wsl -e git -C <cwd> ...` — invoke git inside WSL from the Windows host.
- CWD from WSL sessions is reported as Linux-style paths (e.g., `/home/user/project`). These are passed directly to `wsl -e git -C <path>` without translation — WSL handles this natively.
- Detection: When `SessionType::Wsl`, always use the WSL executor. Do NOT merge with the Local branch as the CLAUDE.md commands do, because git requires execution inside the WSL filesystem.

**SSH:**
- Open a **separate exec channel** on the existing russh connection (via `connection_id`).
- Requires a new method on `SshConnectionPool` / `SessionManager`:
  ```rust
  async fn exec_command(connection_id: &str, command: &str) -> Result<String>
  ```
  This opens a russh `Channel`, calls `channel.exec(true, command)`, reads stdout to completion, and returns the output. The channel is opened and closed per command — no persistent state.
- The existing PTY session is not affected.

Session type routing follows the same pattern as existing CLAUDE.md local/SFTP branching in `claude_commands.rs`, except WSL gets its own branch instead of merging with Local.

---

### CWD Tracking

The Git panel needs to know the current working directory of the focused session. This reuses the existing CWD infrastructure:

- **On panel mount / session focus change:** Call `ipc.getSessionCwd(sessionId)` to get the current CWD.
- **Subscribe to CWD changes:** Listen to `"session-cwd"` events via `ipc.onSessionCwd(handler)`.
- **On CWD change:** Re-fetch git status for the new CWD. If the new CWD is not inside a git repo, clear the file list and show "Not a git repository."

To avoid duplicating CWD tracking logic already in `ClaudeCodePanel.tsx`, extract a shared hook `useSessionCwd(sessionId)` that both the Claude panel and Git panel can use. This hook encapsulates `getSessionCwd` + `onSessionCwd` event subscription.

---

### File List (Sidebar)

**Data model:**

```typescript
interface GitFileEntry {
  path: string;          // relative file path
  status: "M" | "A" | "D" | "R" | "?";  // modified, added, deleted, renamed, untracked
}

interface GitStatus {
  unstaged: GitFileEntry[];
  staged: GitFileEntry[];
  isGitRepo: boolean;     // false when CWD is not inside a git repository
}
```

**Status indicators with color:**

- `M` Modified — yellow
- `A` Added — green
- `D` Deleted — red
- `R` Renamed — blue
- `?` Untracked — gray

**Sections:**

- Unstaged Changes — collapsible accordion with count badge
- Staged Changes — collapsible accordion with count badge

**Interaction:**

- Click file → open diff in main area
- Selected file highlighted
- Click another file → diff switches immediately

**Special file handling:**

- **Untracked files (`?`):** Show full file content as all-added lines (equivalent to `git diff --no-index /dev/null <file>`).
- **Binary files:** Detect via `git diff` output ("Binary files differ"). Show "Binary file — diff not available" message instead of attempting to render.
- **Deleted files (staged `D`):** Show full content as all-removed lines.

---

### Refresh Strategy

**Local auto-refresh:**
- Watch specific files under `.git/` using the `notify` crate: `.git/index` (staging changes) and `.git/HEAD` (branch/commit changes). Non-recursive mode — do NOT watch the entire `.git/` tree.
- Debounce: 500ms to coalesce rapid changes (e.g., `git add` modifying `.git/index` multiple times).
- On debounced change → emit `"git-status-changed"` Tauri event.
- Create a dedicated `GitWatcher` struct (similar to `ClaudeMdWatcher`) — do not reuse `ClaudeMdWatcher`.

**WSL auto-refresh:**
- Same `.git/index` and `.git/HEAD` watching approach, but watch paths need to be translated. WSL filesystem is accessible from Windows via `\\wsl$\<distro>\...` UNC paths. Watch these UNC paths with the `notify` crate.
- If UNC path watching is unreliable, fall back to polling (10-second interval) or manual-only refresh.

**SSH:**
- No auto-refresh. Manual refresh + panel switch refresh only.

**Panel focus switch:**
- Uses existing `focusedPanelId` / `focusedSessionId` tracking.
- When focused session changes → fetch git status for new session's CWD.
- Clears previous file list and diff selection before fetching.

**CWD change within same session:**
- When CWD changes (detected via `onSessionCwd` event) → re-fetch git status.
- If new CWD is not a git repo → clear state, show "Not a git repository."
- If new CWD is a git repo → update file watcher to watch new `.git/` directory.

**Manual refresh:**
- Refresh button (↻) in the sidebar header.
- Available for all environments, essential for SSH.

---

### Diff Viewer (Main Area Overlay)

**Rendering:**

- CodeMirror 6 in read-only mode (reuse existing `codemirrorSetup.ts`)
- Syntax highlighting based on file extension
- Custom decorations for diff lines:
  - Added lines: green background
  - Deleted lines: red background
  - Hunk headers (`@@`): blue color, separator styling
  - Context lines: default background
- Line numbers: before/after line numbers displayed on both gutters

**Overlay behavior:**

- Renders on top of the terminal area with z-index. **The overlay captures all mouse/keyboard events** — the terminal is not interactive while the diff viewer is open. The terminal PTY continues running underneath (output is not paused), but the user must close the diff viewer to interact with the terminal.
- Close via: ESC key, X button in header
- Header shows: file path + status label (unstaged/staged) + close button

**Diff source:**

- Unstaged file: `git diff -- <file>`
- Staged file: `git diff --cached -- <file>`
- Untracked file: `git diff --no-index /dev/null -- <file>` (or read file content and format as all-added)

---

### State Management

**Zustand store: `gitStore.ts`**

```typescript
interface GitStore {
  // Tracking
  trackedSessionId: string | null;
  trackedCwd: string | null;
  isGitRepo: boolean;

  // File list
  unstagedFiles: GitFileEntry[];
  stagedFiles: GitFileEntry[];

  // Diff viewer
  selectedFile: { path: string; staged: boolean } | null;
  diffContent: string | null;

  // Status
  loading: boolean;
  error: string | null;

  // Actions
  setTrackedSession(sessionId: string): void;
  setCwd(cwd: string): void;
  refreshStatus(): Promise<void>;
  selectFile(path: string, staged: boolean): Promise<void>;
  clearSelection(): void;
  clear(): void;  // reset all state (used on session/CWD change)
}
```

---

### IPC Interface

**Tauri commands:**

- `git_status(session_id: String, cwd: String)` → `GitStatus`
- `git_diff(session_id: String, cwd: String, file: String, staged: bool)` → `String`

**Tauri events:**

- `"git-status-changed"` — emitted by file watcher (local/WSL only), payload: `{ cwd: String }`

**TypeScript IPC methods in `tauriIpc.ts`:**

```typescript
function getGitStatus(sessionId: string, cwd: string): Promise<GitStatus>;
function getGitDiff(sessionId: string, cwd: string, file: string, staged: boolean): Promise<string>;
function onGitStatusChanged(handler: (payload: { cwd: string }) => void): UnlistenFn;
```

The `onGitStatusChanged` listener follows the existing singleton pattern used by `onClaudeMdChanged`: a lazy-initialized listener with a handler set, to avoid multiple Tauri event subscriptions.

---

### Backend Module Structure

```
src-tauri/src/git/
  mod.rs          — GitExecutor trait, GitStatus/GitFileEntry types, session routing
  local.rs        — LocalGitExecutor (std::process::Command)
  wsl.rs          — WslGitExecutor (wsl -e git ...)
  ssh.rs          — SshGitExecutor (russh exec channel via new exec_command method)
  parser.rs       — Parse git status --porcelain / diff output into structured data
  watcher.rs      — GitWatcher: .git/index + .git/HEAD watcher (notify crate, 500ms debounce)
```

**New method on SessionManager / SshConnectionPool:**

```
src-tauri/src/session/ssh_connection_pool.rs (or equivalent)
  + async fn exec_command(connection_id: &str, command: &str) -> Result<String>
```

**Tauri command file:**

```
src-tauri/src/commands/git_commands.rs
```

---

### Frontend Component Structure

```
src/components/GitPanel/
  GitPanel.tsx         — Main container, tab content (subscribes to session focus + CWD)
  GitFileList.tsx      — Unstaged/Staged accordion file list
  GitFileEntry.tsx     — Single file row with status icon
  DiffViewer.tsx       — Main area overlay with CodeMirror diff rendering
  DiffViewer.css       — Diff color styles

src/hooks/
  useSessionCwd.ts     — Shared hook for CWD tracking (extracted from ClaudeCodePanel)
```

**Store:**

```
src/store/gitStore.ts
```

---

## Error Handling

- **Not a git repo:** Show "Not a git repository" message in sidebar. Auto-detect on CWD change.
- **Git not installed:** Show "Git not found" message.
- **SSH exec failure:** Show error with manual refresh suggestion.
- **Empty diff:** Show "No changes" message in diff viewer.
- **Binary file:** Show "Binary file — diff not available" message.
- **Large diff:** Truncate with "Diff too large to display" warning (threshold: ~10,000 lines).
- **CWD transitions:** When navigating from a git repo to a non-git directory, clear file list and diff state. When navigating back into a git repo, auto-refresh.

---

## Keyboard Shortcuts

- Toggle Git panel: `Ctrl+Shift+G` (dedicated shortcut, alongside `Ctrl+Shift+L` for Claude panel)
- ESC: Close diff viewer overlay
- Arrow keys: Navigate file list (future enhancement)
