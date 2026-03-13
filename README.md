# v-terminal

A fast, native terminal emulator built with Tauri + React + xterm.js. Designed for Windows with persistent sessions, multi-panel layouts, and a polished Apple HIG-compliant UI.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite 5 |
| Terminal | xterm.js 5 (FitAddon, WebLinksAddon, Unicode11) |
| State | Zustand 4 |
| Backend | Tauri 2, Rust |
| PTY | portable-pty (out-of-process daemon) |
| Fonts | Pretendard (UI), JetBrains Mono Nerd Font (terminal) |

## Features

### Sessions & Daemon
- **Persistent sessions** via an out-of-process daemon (`v-terminal-daemon`) — closing a tab detaches instead of killing the shell
- **4MB scrollback buffer** per session, streamed on re-attach
- **Session restoration** — tabs auto-saved to localStorage on app close and restored on next launch
- **Session picker** — choose to start fresh or re-attach to a running daemon session
- **Auto-reconnect** — exponential backoff reconnection with live status indicator in the title bar

### Layouts & Tabs
- **Multi-panel grids** — 1, 2, 3, 4, 6, 9 panels per tab
- **Panel zoom** — toggle any panel to full-screen within the tab
- **Broadcast mode** — send keystrokes to all panels simultaneously
- **Tab context menu** — send to background vs. kill process
- **Tab activity badges** — unread output indicator with pulse animation

### Shell Support
- **Windows**: auto-detects PowerShell 7 → Windows PowerShell 5.1 → cmd.exe via PATH search
- **WSL**: drop-down distro selector (cached on startup for instant response)
- **Custom shells**: configure arbitrary shell program and arguments

### SSH
- **SSH profile manager** — save, edit, and delete connection profiles
- **Connect modes**: new tab, current panel, or all panels at once
- **Custom port and identity file** support

### Command Palette (`Ctrl+K`)
- Tab operations (new, close, rename, broadcast toggle)
- Panel navigation (next, prev, zoom)
- Layout switching
- Quick tab switching
- SSH quick-connect

### UI & Theming
- **System-adaptive light/dark theme** — follows OS preference automatically
- **Popular themes** — Dracula, Gruvbox, Nord, Solarized, and more
- **Frosted glass** title bar and tab bar (backdrop-filter)
- **macOS-style traffic lights** — close, minimize, zoom with HIG-correct order and hover icons
- **URL click support** — clickable links in terminal output

## Project Structure

```
v-terminal/
├── src/                        # React frontend
│   ├── components/
│   │   ├── TitleBar/           # Window controls + daemon status
│   │   ├── TabBar/             # Tab list + SSH manager button
│   │   ├── PanelGrid/          # Grid layout engine
│   │   ├── TerminalPane/       # xterm.js instance + PTY bridge
│   │   ├── SessionPicker/      # New session / restore UI
│   │   ├── SplitToolbar/       # Layout + broadcast controls
│   │   ├── SshManager/         # SSH profile modal
│   │   ├── ThemePicker/        # Theme selector (rendered via Portal)
│   │   ├── CommandPalette/     # Ctrl+K command menu
│   │   └── DaemonStatusBanner/ # Daemon connectivity indicator
│   ├── store/
│   │   ├── tabStore.ts         # Tabs, panels, sessions
│   │   ├── sshStore.ts         # SSH profiles (localStorage)
│   │   └── themeStore.ts       # Theme + system preference
│   ├── lib/
│   │   ├── tauriIpc.ts         # Tauri command wrappers
│   │   ├── layoutMath.ts       # Grid layout calculations
│   │   └── xtermTheme.ts       # xterm.js theme utilities
│   └── themes/definitions.ts   # Theme color definitions
├── src-tauri/
│   ├── src/
│   │   ├── lib.rs              # Tauri app setup + daemon watchdog
│   │   ├── commands/           # Tauri IPC command handlers
│   │   ├── daemon/             # TCP client to daemon process
│   │   ├── state/              # AppState, WSL cache, persistence
│   │   └── bin/daemon.rs       # v-terminal-daemon binary
│   └── tauri.conf.json         # App config + version
└── public/fonts/               # JetBrains Mono Nerd Font TTFs
```

## Getting Started

### Prerequisites

- Rust + Cargo (`rustup`)
- Microsoft C++ Build Tools
- Node.js + pnpm
- WebView2 Runtime (built-in on Windows 11)

### Development

```bash
pnpm install
pnpm tauri dev       # Hot-reload dev mode
```

### Production Build

```bash
pnpm tauri build     # Output: src-tauri/target/release/bundle/
```

### Daemon (manual)

```bash
pnpm daemon:start    # Start daemon for debugging
pnpm daemon:stop     # Stop daemon
```

## Version Management

When bumping the version, **both files must be updated together**:

1. `package.json` — `version` field
2. `src-tauri/tauri.conf.json` — `version` field

Tauri reads the installer version exclusively from `tauri.conf.json`. Missing this update causes the installer to report the previous version.

## Changelog

### v0.1.14 — 2026-03-13
- WSL distro list now cached in `OnceLock` on startup — subsequent new tabs return the result instantly instead of re-running the slow `wsl --list` query

### v0.1.13 — 2026-03-13
- Fixed Windows uninstaller failing when app or daemon is running — NSIS pre-uninstall hook now force-kills processes before file deletion

### v0.1.12 — 2026-03-13
- Fixed Windows installer failing when app or daemon is already running — NSIS preinstall hook force-kills `v-terminal.exe` and `v-terminal-daemon.exe` before extraction

### v0.1.11 — 2026-03-13
- Fixed double paste on Windows — Ctrl+V was triggering both the custom key handler and the native paste event; now only blocks xterm's keydown processing and lets the native paste event handle it

### v0.1.10 — 2026-03-13
- Fixed theme picker appearing behind terminal panels — rendered via React Portal to escape topbar `backdrop-filter` stacking context
- Fixed Apple theme group order: Light now appears above Dark

### v0.1.9 — 2026-03-13
- Fixed PowerShell detection on Windows — replaced process-spawn probing with PATH directory search, resolving silent fallback to cmd.exe in headless daemon environments
- Default shell priority: PowerShell 7 → Windows PowerShell 5.1 → cmd.exe
- Added "Open in All Panels" button to SSH connection modal
- Added persistent daemon status indicator to TitleBar with auto-reconnect on disconnect
- Fixed race conditions in daemon status indicator showing stale state on startup
- Fixed fallback to new session when a restored tab's daemon session no longer exists

### v0.1.8 — 2026-03-12
- Fixed window close button not closing the app — added missing `core:window:allow-destroy` capability
- Fixed maximize button not working — added missing `core:window:allow-toggle-maximize` capability
- Redesigned SessionPicker to follow Apple HIG
- Removed tab drag-and-drop; added terminal loading spinner while PTY initializes
- Added tab context menu distinguishing "send to background" vs "kill process"
- Fixed orphaned session section flickering during initial load
- Persist tab state to localStorage; auto-save all open tabs to background on app close

### v0.1.7 — 2026-03-11
- Replaced in-process PTY manager with out-of-process daemon for persistent sessions
- Added SessionPicker UI on new tab: start new session or attach to existing
- Added tab activity indicator with pulse animation for unread background output
- Replaced HTML5 drag-and-drop with pointer-event tab reordering
- Changed 3-panel layout to "large left + two stacked right" grid
- Added Ctrl+Tab / Ctrl+Shift+Tab to cycle through tabs
- Added custom shell support (`shellProgram`, `shellArgs`) and WSL distro selector

### v0.1.6 — 2026-03-11
- Added Pretendard variable font as primary UI font
- Applied frosted-glass effect to TitleBar and TabBar
- Fixed traffic light button order to macOS HIG standard
- Added empty state UI in SSH Manager
- Improved SSH profile list with rounded items and accent-colored active state
- Updated app icons across all platforms

### v0.1.5 — 2026-03-11
- Fixed paste in TerminalPane — switched to capture-phase `paste` event listener, supporting Ctrl+V and Ctrl+Shift+V without sending raw `\x16` to the PTY

### v0.1.4 — 2026-03-10
- Fixed invalid Tauri capability permissions — removed non-existent clipboard IPC permissions (clipboard now uses Web API `navigator.clipboard`)

### v0.1.3 — 2026-03-10
- Added clipboard support: Ctrl+C copies selection, Ctrl+V pastes
- Added "Connect in Panel" option in SSH Manager
- Fixed TitleBar traffic light button order

### v0.1.2 — 2026-03-10
- Simplified TitleBar — removed title/cwd display for a cleaner minimal bar

### v0.1.1 — 2026-03-10
- Enhanced TitleBar with macOS-style controls
- Added SSH manager component and store
- Added NanumGothicCoding fonts for Korean support

### v0.1.0 — 2026-03-10
- Initial release
