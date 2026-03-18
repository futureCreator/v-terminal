# Claude Code Panel & Usage Bar Design

**Date:** 2026-03-18
**Status:** Draft

## Overview

Add two new UI elements to v-terminal:

1. **Claude Code Panel (left sidebar)** — Auto-discovers and edits CLAUDE.md files based on the active terminal session's working directory. Supports local, WSL, and SSH (via SFTP) environments.
2. **Usage Bar (bottom bar)** — Displays Claude Code usage limits per account with visual gauges (24px). Visible when Claude Code panel is open or usage exceeds 60%.

Additionally: change the Cheatsheet tab icon from document+lines to `</>` code bracket to resolve the visual conflict with the Notes icon.

## Architecture

```
┌── Claude Code (Left) ──┐┌─────────────────────────┐┌── Toolkit (Right) ───┐
│  [CLAUDE.md]            ││       Terminal Area      ││ [Notes][Timers][</>] │
│                         ││                          ││                     │
│  Context indicator:     ││                          ││                     │
│  SSH user1@host         ││                          ││                     │
│  /home/user1/project    ││                          ││                     │
│                         ││                          ││                     │
│  ▼ ~/.claude/CLAUDE.md  ││                          ││                     │
│    (editable content)   ││                          ││                     │
│  ▼ /project/CLAUDE.md   ││                          ││                     │
│    (editable content)   ││                          ││                     │
└─────────────────────────┘├──────────────────────────┤└─────────────────────┘
                           │ Pro ████████░░ 72% 2h34m │
                           └──────────────────────────┘
```

- Left: Claude Code panel (toggles independently)
- Center: Terminal area (unchanged)
- Right: Toolkit panel (existing, unchanged except cheatsheet icon)
- Bottom: Usage bar (visible when Claude Code panel is open or usage > 60%)

## 1. Claude Code Panel (Left Sidebar)

### 1.1 Panel Structure

The panel mirrors the Toolkit panel's tab-switching pattern with icon buttons at the top, but currently has only one tab: CLAUDE.md. The tab bar is included from the start so additional tabs can be added later without structural changes.

**Type definition:**
```typescript
export type ClaudeCodeTab = "claude-md";
```

**State in App.tsx:**
```typescript
const [claudePanelOpen, setClaudePanelOpen] = useState(() => {
  return localStorage.getItem("v-terminal:claude-panel-open") === "true";
});
const [claudePanelTab, setClaudePanelTab] = useState<ClaudeCodeTab>("claude-md");
```

**Toggle:** Command palette ("Show/Hide Claude Code Panel") + keyboard shortcut (`Ctrl+Shift+L`).

### 1.2 CLAUDE.md Auto-Discovery

When the focused panel changes, the Claude Code panel:

1. Queries the backend for the focused session's CWD
2. Discovers all CLAUDE.md files in the Claude Code loading order
3. Displays them as an accordion list

**Discovery order (matching Claude Code's loading):**
1. `~/.claude/CLAUDE.md` (user-level — always present if exists)
2. Starting from CWD, walk up to filesystem root, collecting any `CLAUDE.md` found
3. `<project-root>/.claude/CLAUDE.md` (directory-level — if exists)

**Project root detection:** The first ancestor directory containing `.git/` is considered the project root. If no `.git/` is found before reaching the filesystem root, the CWD itself is treated as the project root.

Each discovered file is shown as a collapsible section with:
- Level label (user / project / directory)
- File path
- Editable content area (reusing NoteEditor component)

### 1.3 Context Indicator

At the top of the panel body (below tab bar), a context indicator shows which session is being tracked:

```
┌──────────────────────────┐
│ 🟢 SSH user1@server1     │
│ /home/user1/project      │
└──────────────────────────┘
```

- Connection type icon + label (Local / WSL distro / SSH user@host)
- Current working directory path
- Updates when panel focus changes

### 1.4 Editor

`ClaudeMdEditor` follows the same CodeMirror 6 editing approach as `NoteEditor`, but with its own data flow. It does NOT import or wrap `NoteEditor` directly because `NoteEditor` is tightly coupled to `noteStore` (per-tab note persistence). Instead, `ClaudeMdEditor` is a standalone component that:

- Uses CodeMirror 6 with the same extensions (markdown syntax highlighting, theme) as NoteEditor for visual consistency. The CodeMirror setup (theme, markdown extension, base keybindings) should be extracted into a shared utility `src/lib/codemirrorSetup.ts` that both `NoteEditor` and `ClaudeMdEditor` import.
- Reads content from the backend via `read_claude_md` and writes via `write_claude_md`
- Each CLAUDE.md section has its own editor instance
- Auto-save on blur or panel switch (debounced 500ms)
- Read-only mode when file permissions deny write access (textarea `readOnly` prop)
- On save, passes `expected_mtime` for optimistic concurrency — if the file was modified externally since last read, returns a conflict error and shows "File changed externally. Reload?" notification

### 1.5 Panel Focus Behavior

- Tracks `focusedPanelId` from `tabStore` / `PanelGrid`
- When focused panel changes: fetch CWD → discover files → update display
- Switching tabs (not panels) also triggers an update since each tab may have different focused panels
- If no session is active in the focused panel: show "No active session" message

## 2. Usage Bar (Bottom)

### 2.1 Layout

A thin horizontal bar (24px height) at the bottom of the app. Visible when the Claude Code panel is open OR when usage exceeds 60% (as a warning). Displays usage gauges for each unique Claude account detected across active sessions in the current tab.

```
┌────────────────────────────────────────────────────────────────┐
│ Pro ████████░░ 72% · 2h 34m  │  Pro ████░░░░░░ 25% · 4h 12m  │
│ Local (dongho)               │  SSH user1@server1             │
└────────────────────────────────────────────────────────────────┘
```

### 2.2 Data Source

Claude Code stores usage data under `~/.claude/`. The exact format needs investigation at implementation time. Data is read via:

- **Local/WSL:** Direct filesystem read
- **SSH:** SFTP channel on the existing SSH connection

### 2.3 Display Elements

Per account gauge:
- Plan type badge (Free / Pro / Max 5x / Max 20x)
- Visual progress bar with percentage
- Reset countdown timer (e.g., "2h 34m")
- Environment label (Local / WSL / SSH user@host)
- Color coding: green (< 60%) → yellow (60-85%) → red (> 85%)

### 2.4 Behavior

- Polls usage data every 60 seconds
- On app start, fetches usage for all active sessions
- Deduplicates same accounts: for local/WSL, dedup by resolved absolute path of `~/.claude/` (if local and WSL share the same filesystem path, show one gauge). For SSH, dedup by `host:port:username` tuple.
- Click on a gauge opens a detail popover with:
  - Model-level breakdown (if available)
  - Recent session count
  - Plan details
- If Claude Code is not installed in an environment, that environment's gauge is hidden
- If usage data is unreadable, show "–" instead of gauge

### 2.5 Reset Timer

- Counts down to the next usage reset
- Updates every 60 seconds (aligned with data poll)
- On reset, automatically refreshes usage data

## 3. Backend (Rust)

### 3.1 New Module: `src-tauri/src/claude/`

```
claude/
├── mod.rs              // Module definition
├── cwd_resolver.rs     // Per-session CWD detection
├── claude_md.rs        // CLAUDE.md discovery, read, write
├── file_watcher.rs     // File change detection
└── usage.rs            // Usage data reading
```

### 3.2 CWD Resolution (`cwd_resolver.rs`)

Each session type requires a different CWD detection strategy:

**Local (Windows):**
- `LocalSession` stores the child process via `portable_pty::Child`, which exposes `process_id()`.
- Use `windows-sys` crate to call `NtQueryInformationProcess` with `ProcessBasicInformation` to read the PEB and extract the current directory from `RTL_USER_PROCESS_PARAMETERS`.
- Fallback: if the API call fails, send `cd` via the PTY and parse output (fragile, last resort only).

**WSL:**
- WSL processes run inside a Linux kernel; Windows process APIs cannot query their CWD.
- Strategy: Execute `wslpath -w $(pwd)` (or `pwd`) through the PTY channel and parse the output.
- This is done by writing a special escape-sequence-wrapped command to the PTY input and parsing the response from the PTY output. Use a unique marker (e.g., `\x1b]7337;cwd;...BEL`) to distinguish the response from normal terminal output.
- Alternative: read `/proc/<pid>/cwd` from the Windows side via `\\wsl$\<distro>\proc\<pid>\cwd` if the WSL PID is known.

**SSH:**
- SFTP's `realpath(".")` returns the SFTP session's default directory (typically home), NOT the shell's CWD. Therefore SFTP cannot be used for CWD detection.
- Strategy: Same PTY-injection approach as WSL — send a marker-wrapped `pwd` command through the SSH shell channel and parse the response.
- Implementation: Write `echo -e "\x1b]7337;cwd;$(pwd)\x07"` to the session's channel input. The terminal data reader parses this OSC sequence and emits a `session-cwd` Tauri event with `{ session_id, cwd }`.
- This custom OSC sequence (7337) is intercepted before reaching xterm.js, so it is invisible to the user.
- CWD is re-queried when the panel focus changes (on-demand), not polling.

**PTY injection safety measures:**
- Prefix the command with a space (` echo ...`) so that shells with `HISTCONTROL=ignorespace` or `setopt HIST_IGNORE_SPACE` (zsh) do not record it in history.
- Before injecting, check if the session's PTY has recent output activity (within last 200ms) — if so, delay injection to avoid interfering with a running command.
- Wrap the command with `\r` carriage return sequences to overwrite the prompt line, minimizing visual disruption.
- If the shell is busy (no prompt detected within 2 seconds after injection), skip CWD detection for this cycle and use the last known CWD.

**Shared CWD event:** All three strategies emit a `session-cwd` event. The frontend `claudeCodeStore` listens for this event to trigger CLAUDE.md discovery.

### 3.3 Session-to-Connection Mapping

The new Tauri commands need to perform SFTP operations on SSH sessions, which requires the `connection_id`. However, the `Session` trait does not expose `connection_id`.

**Solution:** Add two methods to the `Session` trait:
```rust
// In session/mod.rs
pub enum SessionType { Local, Wsl, Ssh }

pub trait Session: Send + Sync {
    // ...existing methods...
    fn session_type(&self) -> SessionType;
    fn connection_id(&self) -> Option<String> { None } // default: None for local/WSL
}
```
- `LocalSession` returns `SessionType::Local` or `SessionType::Wsl` (based on the connection type stored at creation) and `None` for connection_id
- `SshSession` returns `SessionType::Ssh` and `Some(self.connection_id.clone())`

`session_type()` is needed because the CWD resolution strategy differs between Local (Windows API) and WSL (PTY injection or `/proc` path), and both return `None` for `connection_id()`.

This allows `SessionManager` to route CWD detection to the correct strategy and look up the SSH connection pool entry for SFTP operations.

### 3.4 CLAUDE.md Operations (`claude_md.rs`)

**Discovery:**
- Takes a session ID, resolves CWD, then walks the directory tree
- Returns `Vec<ClaudeMdFile>` where:
```rust
struct ClaudeMdFile {
    path: String,
    level: ClaudeMdLevel, // User, Project, Directory, Parent
    content: String,
    last_modified: u64,   // Unix timestamp
    readonly: bool,
}
```

**Read/Write:**
- **Local/WSL:** `std::fs::read_to_string` / `std::fs::write`
- **SSH:** SFTP `open` → `read` / `write` via the session's connection pool entry

### 3.5 File Watching (`file_watcher.rs`)

- **Local/WSL:** Uses `notify` crate to watch discovered CLAUDE.md paths. On change, emits `claude-md-changed` Tauri event with `{ session_id, path }`.
- **SSH:** Spawns a background task that polls SFTP `stat` every 30 seconds for each watched path. Compares `mtime`. Emits the same event on change. Polling only runs for the currently tracked session (not all SSH sessions).
- Watch/unwatch lifecycle tied to Claude Code panel open state AND tracked session. When the panel closes or the tracked session changes, watchers for the previous session are cleaned up.
- When a session exits (`session-exit` event), any active watchers for that session are automatically removed.

### 3.6 Usage Data (`usage.rs`)

- Reads Claude Code's usage data from `~/.claude/` (exact path/format TBD at implementation)
- **Local/WSL:** Direct filesystem read
- **SSH:** SFTP read
- Returns parsed usage struct:
```rust
struct UsageData {
    plan: String,           // "pro", "max_5x", etc.
    used_percent: f64,
    reset_at: Option<u64>,  // Unix timestamp
}
```

### 3.7 New Tauri Commands

```rust
// CWD
#[tauri::command]
fn get_session_cwd(session_id: String) -> Result<String, String>;

// CLAUDE.md
#[tauri::command]
fn discover_claude_md(session_id: String) -> Result<Vec<ClaudeMdFile>, String>;

#[tauri::command]
fn read_claude_md(session_id: String, path: String) -> Result<String, String>;

#[tauri::command]
fn write_claude_md(session_id: String, path: String, content: String, expected_mtime: Option<u64>) -> Result<(), String>;

#[tauri::command]
fn watch_claude_md(session_id: String) -> Result<(), String>;

#[tauri::command]
fn unwatch_claude_md(session_id: String) -> Result<(), String>;

// Usage
#[tauri::command]
fn get_usage(session_id: String) -> Result<UsageData, String>;
```

## 4. Frontend Components

### 4.1 New Components

```
src/components/
├── ClaudeCodePanel/
│   ├── ClaudeCodePanel.tsx      // Left sidebar container with tab bar
│   ├── ClaudeMdTab.tsx          // CLAUDE.md discovery + accordion list
│   ├── ClaudeMdEditor.tsx       // Single file editor (wraps NoteEditor pattern)
│   ├── ContextIndicator.tsx     // Session context display
│   └── ClaudeCodePanel.css
├── UsageBar/
│   ├── UsageBar.tsx             // Bottom bar container
│   ├── UsageGauge.tsx           // Single account gauge
│   ├── UsageDetailPopover.tsx   // Click-to-expand details
│   └── UsageBar.css
```

### 4.2 New Stores

```
src/store/
├── claudeCodeStore.ts    // CLAUDE.md state: files list, loading, errors
├── usageStore.ts         // Per-session usage data, polling interval
```

**claudeCodeStore:**
```typescript
interface ClaudeCodeState {
  trackedSessionId: string | null;
  files: ClaudeMdFile[];
  loading: boolean;
  error: string | null;
  setTrackedSession: (sessionId: string | null) => void;
  refreshFiles: () => Promise<void>;
  saveFile: (path: string, content: string) => Promise<void>;
}
```

**usageStore:**
```typescript
interface UsageEntry {
  sessionId: string;
  environment: string; // "Local" | "WSL Ubuntu" | "SSH user@host"
  plan: string;
  usedPercent: number;
  resetAt: number | null;
}

interface UsageState {
  entries: UsageEntry[];
  refreshAll: () => Promise<void>;
}
```

### 4.3 App.tsx Layout Change

```tsx
<div className="app">
  <TitleBar />
  <div className="topbar">...</div>
  <div className="app-content">
    {claudePanelOpen && (
      <ClaudeCodePanel
        activeTab={claudePanelTab}
        onTabChange={setClaudePanelTab}
        onClose={handleCloseClaudePanel}
        focusedPanelId={activePanelId}
        focusedSessionId={activePanelSessionIdRef.current}
      />
    )}
    <div className="app-terminal-area">
      {/* existing tab viewports */}
    </div>
    {sidebarOpen && <SidePanel ... />}
  </div>
  <UsageBar activeTabId={activeTabId} />
</div>
```

### 4.4 Command Palette Integration

Add to `tabPaletteSection`:
```typescript
{
  id: "view:claude-panel",
  label: claudePanelOpen ? "Hide Claude Code Panel" : "Show Claude Code Panel",
  description: "Toggle the Claude Code panel with CLAUDE.md editor",
  meta: "Ctrl+Shift+L",
  action: handleToggleClaudePanel,
}
```

## 5. Cheatsheet Icon Change

Replace the current document+lines SVG in `SidePanel.tsx` (line 59-62) with a `</>` code bracket icon:

```tsx
<svg width="15" height="15" viewBox="0 0 15 15" fill="none">
  <path d="M5.5 3.5L2.5 7.5l3 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
  <path d="M9.5 3.5l3 4-3 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
</svg>
```

Also update the cheatsheet icon in `cheatsheetPaletteSection` in App.tsx to match.

## 6. Edge Cases

### CLAUDE.md
- **CWD detection failure:** Display "Unable to detect working directory" + manual path input fallback
- **No CLAUDE.md found:** Show "No CLAUDE.md found" + "Create" button for new file creation
- **SSH disconnected during edit:** Temporarily save content locally, sync via SFTP on reconnection
- **External file change during edit:** Show "File changed externally. Reload?" notification bar at top of editor
- **Permission denied:** Display file in read-only mode with explanation

### Usage Bar
- **Usage data unreadable:** Show "–" instead of gauge
- **Claude Code not installed:** Hide gauge for that environment
- **Same account across environments:** Deduplicate, show single gauge
- **Reset timer:** Auto-refresh data when countdown reaches zero

## 7. Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+Shift+L` | Toggle Claude Code panel (left) |
| `Ctrl+Shift+N` | Toggle Toolkit panel (right, existing) |

## 8. localStorage Keys

| Key | Purpose |
|---|---|
| `v-terminal:claude-panel-open` | Claude Code panel open state |
| `v-terminal:claude-panel-tab` | Active tab in Claude Code panel |

## 9. Dependencies

### Rust (Cargo.toml)
- `notify` — filesystem watcher (for local/WSL file change detection)
- Existing: `russh`, `russh-sftp` — already available for SSH/SFTP

### Frontend
- No new dependencies — reuses existing NoteEditor pattern and Zustand stores
