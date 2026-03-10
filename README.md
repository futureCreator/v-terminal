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
