# v-terminal

A fast, beautiful terminal emulator built with Tauri + React + xterm.js.

## Features

- Native performance via Tauri (Rust backend)
- Full xterm.js terminal emulation with PTY support
- Multi-tab interface with split pane support
- SSH connection manager
- System-adaptive light/dark theme
- NanumGothicCoding font support
- macOS-native title bar and tray icon

## Changelog

### v0.1.7 - 2026-03-11

- Replaced in-process PTY manager with an out-of-process daemon (`v-terminal-daemon`) for persistent sessions — closing a tab detaches instead of killing the shell
- Added SessionPicker UI on new tab: choose to start a new session or attach to an existing daemon session
- Added tab activity indicator: background tabs show a dot badge when unread output arrives, with a pulse animation while data is streaming
- Replaced HTML5 drag-and-drop with pointer-event-based tab reordering for smoother, ghost-free dragging
- Changed 3-panel layout from three equal columns to a "large left + two stacked right" grid
- Added Ctrl+Tab / Ctrl+Shift+Tab keyboard shortcuts to cycle through tabs
- Replaced "press any key to close" exit overlay with a clickable "New Session" button to restart the shell
- Added custom shell support (`shellProgram`, `shellArgs`) for WSL distros and other shells; added `get_wsl_distros` command on Windows

### v0.1.6 - 2026-03-11

- Added Pretendard variable font as the primary UI font with `prefers-reduced-motion` support
- Applied frosted-glass (backdrop-filter) effect to TitleBar and TabBar for a native macOS look
- Fixed traffic light button order to macOS HIG standard (close, minimize, zoom) with hover SVG icons
- Added empty state UI in SSH Manager when no profiles are saved
- Improved SSH profile list: rounded items, accent-colored active state with blue highlight
- Added focus ring (box-shadow) to SSH input fields and tab rename input
- Bumped SplitToolbar button size from 22px to 28px with improved border radius
- Updated app icons across all platforms

### v0.1.5 - 2026-03-11

- Fixed paste handling in TerminalPane: switched from `readText()` on Ctrl+V to a capture-phase `paste` event listener on the terminal textarea, supporting both Ctrl+V and Ctrl+Shift+V without sending raw `\x16` to the PTY
- Fixed TitleBar button alignment: added `margin-left: auto` to right-side controls container

### v0.1.4 - 2026-03-10

- Fixed invalid Tauri capability permissions: removed `core:clipboard:allow-read-text` and `core:clipboard:allow-write-text` which do not exist in Tauri v2 (clipboard access uses the Web API `navigator.clipboard` instead)

### v0.1.3 - 2026-03-10

- Added clipboard support: Ctrl+C copies selected text, Ctrl+V pastes from clipboard in the terminal
- Added "Connect in Panel" option in SSH Manager — connect SSH into the currently active terminal pane without opening a new tab
- Fixed TitleBar traffic light button order (minimize, zoom, close) and improved spacer layout

### v0.1.2 - 2026-03-10

- Simplified TitleBar component — removed title/cwd display props for a cleaner, minimal title bar
- Removed built-in keyboard shortcuts from TerminalPane (copy/paste, tab navigation, layout switching) to reduce conflicts and prepare for a unified keybinding system

### v0.1.1 - 2026-03-10

- Enhanced TitleBar with macOS-style controls and improved styling
- Improved TabBar with better tab management and visual polish
- Extended TerminalPane with SSH integration and connection handling
- Expanded terminal types and state management in tabStore
- Added SSH manager component and store (SshManager, sshStore)
- Refined PanelGrid layout and SplitToolbar styling
- Added NanumGothicCoding fonts (Regular & Bold) for Korean support
- Global CSS improvements and font loader refinements

### v0.1.0 - 2026-03-10

- Initial release: v-terminal — Tauri + React terminal app
- Added app icons for all platforms (macOS, Windows, Android, iOS)
