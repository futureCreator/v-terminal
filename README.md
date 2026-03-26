# v-terminal

A fast, native terminal emulator built with Tauri + React + xterm.js. Designed for Windows with persistent sessions, multi-panel layouts, and a polished Apple HIG-compliant UI.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite 5 |
| Terminal | xterm.js 5 (FitAddon, WebLinksAddon, Unicode11) |
| State | Zustand 4 |
| Backend | Tauri 2, Rust |
| PTY | portable-pty (local), russh (SSH) |
| Fonts | Pretendard (UI), JetBrains Mono (terminal), Symbols Nerd Font Mono (icons) |

## Features

### Sessions & Daemon
- **Persistent sessions** via an out-of-process daemon (`v-terminal-daemon`) — closing a tab detaches instead of killing the shell
- **4MB scrollback buffer** per session, streamed on re-attach
- **Session restoration** — tabs auto-saved to localStorage on app close and restored on next launch
- **Session picker** — choose to start fresh or re-attach to a running daemon session
- **Auto-reconnect** — exponential backoff reconnection with live status indicator in the title bar

### Layouts & Tabs
- **Multi-panel grids** — 1, 2, 3, 4, 5, 6 panels per tab
- **Panel zoom** — toggle any panel to full-screen within the tab
- **Broadcast mode** — send keystrokes to all panels simultaneously
- **Tab context menu** — send to background vs. kill process
- **Tab activity badges** — unread output indicator with pulse animation

### Shell Support
- **Windows**: auto-detects PowerShell 7 → Windows PowerShell 5.1 → cmd.exe via PATH search
- **WSL**: drop-down distro selector (cached on startup for instant response)
- **Custom shells**: configure arbitrary shell program and arguments

### SSH
- **Rust-native SSH** — built-in `russh` client, no external `ssh` command needed
- **SSH profile manager** — save, edit, and delete connection profiles
- **Connect modes**: new tab, current panel, or all panels at once
- **Key file and password authentication** with interactive password dialog
- **Connection pooling** — reuses connections per host, multi-channel support
- **Connection state detection** — "Connection lost" overlay with reconnect

### Command Palette (`Ctrl+K`)

![](img/command.png)

- Tab operations (new, close, rename, broadcast toggle)
- Panel navigation (next, prev, zoom)
- Layout switching
- Quick tab switching
- SSH quick-connect

### UI & Theming

![](img/theme.png)

- **System-adaptive light/dark theme** — follows OS preference automatically
- **Popular themes** — Dracula, Gruvbox, Nord, Solarized, and more
- **Frosted glass** title bar and tab bar (backdrop-filter)
- **macOS-style traffic lights** — close, minimize, zoom with HIG-correct order and hover icons
- **URL click support** — clickable links in terminal output

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

## Changelog

### v0.20.8 - 2026-03-27

- **fix**: Note panel copy/paste not working — added explicit `user-select: text` to CodeMirror container and todo text to override global `user-select: none` on body

### v0.20.4 - 2026-03-22

- **fix**: Terminal content overflowing below visible area on restored sessions at app startup — deferred `fitAddon.fit()` to next animation frame so CSS grid/flex layout is fully resolved before calculating terminal dimensions

### v0.20.3 - 2026-03-22

- **fix**: Terminal content disappearing after window focus loss — added Tauri `onFocusChanged` handler to complement `visibilitychange` event, and improved WebGL context loss recovery with immediate Canvas fallback re-render

### v0.20.2 - 2026-03-22

- **refactor**: Command palette prefixes reassigned — `!` tabs, `@` connection, `#` layout, `$` clipboard; removed unused `background` mode
- **style**: Browser panel mobile-width sizing — changed from fixed 40% to `width: 22%; min-width: 375px` for mobile-like viewport

### v0.20.1 - 2026-03-22

- **feat**: Command palette panel management — added "Add Panel" and "Close Panel" commands to the command palette for quick panel add/remove without context menu
- **docs**: Added v-terminal native rewrite design spec and implementation plan

### v0.20.0 - 2026-03-21

- **fix**: Idle unresponsiveness — terminal no longer freezes or goes blank after prolonged idle or system sleep
- **fix**: Zombie process prevention — `kill_process_tree` now waits for `taskkill`/`kill` to complete instead of fire-and-forget; `child.wait()` added to reap terminated processes
- **fix**: Reader thread leak — `Drop` impl added to `LocalSession` to abort the PTY reader task and kill the process when sessions are dropped; `kill()` also aborts the reader task
- **fix**: Event flooding on resume — terminal data is buffered (up to 1MB) while the page is hidden and flushed in a single batch when visible, preventing UI freeze from thousands of queued events
- **fix**: WebGL context recovery — WebGL renderer is now re-created on visibility change if it was lost during idle; previous behavior only cleared the texture atlas which didn't help when the GPU context was fully evicted

### v0.19.4 - 2026-03-20

- **chore**: Removed `docs/superpowers/`, `CLAUDE.md`, `SPEC.md` from git tracking — files kept locally but excluded via `.gitignore`

### v0.19.3 - 2026-03-20

- **fix**: Todo panel scroll bug — root cause was `.todo-empty` (`height: 100%`) plus always-rendered ghost input row exceeding container; also fixed `flex-shrink: 0` completed section competing for space
- **refactor**: Todo panel minimal redesign — removed counter bar, empty state icon, entry/checkmark-draw animations; single scroll container replaces split layout; checkbox 22→16px, row height 44→34px; completed section uses conditional render instead of max-height accordion; fixed button-in-button semantic error

### v0.19.2 - 2026-03-20

- **fix**: Todo panel unnecessary scrollbar — `.todo-section` used `height: 100%` inside a flex container with padding, causing overflow; changed to `flex: 1` + `min-height: 0` for correct sizing

### v0.19.1 - 2026-03-20

- **fix**: PanelGrid crash when `tab.layout` is invalid (e.g., stale localStorage data) — `getGridConfig` now falls back to single-panel grid config instead of returning `undefined`

### v0.19.0 - 2026-03-20

- **feat**: TodoSection Apple HIG polish — item height 32→44px, checkbox 18→22px, text 13→14px, counter bar semibold, row hover with 8px radius, delete button circular hover, checkmark draw-in animation, new item fade-in/slide, delete slide-out, completed section accordion transition
- **feat**: Inline todo input — bottom "New Todo" button replaced with inline ghost row at end of list ("New task..." placeholder), click to activate, Enter for rapid chaining, Escape to cancel
- **feat**: 5-panel layout — left panel full height + right 2×2 grid; replaces "2 Rows" and "3 Columns" alternate layouts
- **feat**: Simplified layout system — `Layout` type changed from `1|2|"2r"|3|4|"3c"|6` to `1|2|3|4|5|6` (linear 1–6 panel progression)
- **feat**: Panel context menu — "Add Panel" (when < 6) and "Close Panel" actions; closing last panel closes the tab
- **feat**: Completed section pill badge showing count, accordion animation for expand/collapse
- **i18n**: Added `panels5`, `panel.closePanel`, `panel.addPanel`, `todo.newTaskPlaceholder`; changed `todo.clearAll` to "Clear"/"지우기"; removed `rows2`, `columns3`

### v0.18.2 - 2026-03-20

- **fix**: Todo input layout jump — counter bar and todo list container now always rendered (opacity fade instead of conditional mount/unmount) to prevent vertical layout shift when adding the first todo item

### v0.18.1 - 2026-03-20

- **refactor**: Layout options reorganized — removed 4-column (`"4c"`) and 3×3 (`9`) layouts; added 2-row (`"2r"`, top/bottom split) and 3-column (`"3c"`) layouts
- **refactor**: Layout order updated to: 1 Panel → 2 Panels → 2 Rows → 3 Panels → 4 Panels → 3 Columns → 6 Panels
- **i18n**: Added `rows2` and `columns3` translation keys (en + ko); removed `columns4` and `panels9`

### v0.18.0 - 2026-03-20

- **feat**: Todo tab redesigned to macOS Reminders style — collapsible header removed, circular checkboxes, progressive disclosure for completed items, bottom-anchored "+ New Todo" button with rapid entry (Enter to chain)
- **feat**: Empty state for Todo tab — checklist icon and "No tasks yet" message when no todos exist
- **feat**: Completed items section — completed todos separated into a collapsible "Completed" section with "Clear All" link, 300ms fade-out animation on check
- **feat**: Counter bar — "N remaining" + "completed/total" fraction replaces the old collapsible header
- **feat**: Notes panel elevated background — `--bg-elevated` (#242426) separates note panels visually from terminal panels
- **feat**: Notes panel padding increased from ~4px to 20px/24px for a more spacious editing experience
- **feat**: Notes background patterns — 4 selectable styles (None, Ruled lines, Grid, Dot grid) with Grid as default
- **feat**: Notes background style selector in Settings → Appearance tab — mini preview buttons with live switching
- **feat**: `noteConfigStore` (Zustand + localStorage) for persisting note background preference
- **i18n**: Added 11 new translation keys for todo redesign and note settings (en + ko)

### v0.17.0 - 2026-03-20

- **feat**: Internationalization (i18n) — full multilanguage support with English and Korean using `react-i18next`
- **feat**: OS language auto-detection — automatically selects Korean for `ko`/`ko-KR` system locales, English for all others
- **feat**: Language selector in Settings → Appearance tab — dropdown to switch between English and 한국어, applies immediately without restart
- **feat**: ~170 translation keys covering all UI text: settings, command palette, welcome page, session picker, SSH manager, terminal dialogs, browser panel, timers, alarms, todos, notes, and context menus
- **feat**: Translation files at `src/locales/en.json` and `src/locales/ko.json` with structured key namespaces
- **refactor**: All 18+ components migrated from hardcoded strings to `t()` translation function calls
- **refactor**: `paletteCommands.tsx` builder functions now accept `TFunction` parameter for translated command labels and descriptions
- **refactor**: `slides.ts` changed from raw strings to translation key identifiers (`headlineKey`/`descriptionKey`)
- **docs**: CLAUDE.md updated — language policy changed from "English only" to i18n guidelines (use `t()`, no hardcoded strings)

### v0.16.3 - 2026-03-20

- **feat**: Welcome slide 4 — "Browse without leaving" slide added to onboarding, showcasing the built-in browser panel with `Ctrl+Shift+B` shortcut and CSS-only illustration (browser toolbar + page content alongside terminal)
- **cleanup**: Removed cheatsheet references from welcome slides — cheatsheet feature was removed in v0.16.2 but slide descriptions still mentioned it

### v0.16.2 - 2026-03-20

- **refactor**: App.tsx decomposed from 977 lines to 387 lines — extracted migrations, keyboard shortcuts, theme application, and palette command builders into dedicated modules
- **refactor**: Extracted `useGlobalKeyboardShortcuts` hook — global keyboard shortcut handling isolated from App component
- **refactor**: Extracted `useThemeApplication` hook — theme CSS variable injection and system color scheme listener
- **refactor**: Extracted `useMigrations` hook — one-time data migration logic (notes→todos, browser panel conversion)
- **refactor**: Extracted `usePasswordDialog` hook — SSH/WSL password dialog state machine extracted from TerminalPane (570 lines, down from 602)
- **refactor**: Extracted `fuzzyMatch` utility — fuzzy matching algorithm moved from CommandPalette to reusable `src/lib/fuzzyMatch.ts`
- **refactor**: Extracted `paletteCommands.tsx` — command palette section builders (tab, layout, clipboard, connection) moved to `src/lib/`
- **refactor**: Extracted `noteCleanup.ts` — consolidated duplicated note panel cleanup logic from 4 locations into shared utility
- **refactor**: Extracted `formatRelativeTime` utility to `src/lib/formatters.ts`
- **cleanup**: Removed Cheatsheet feature — deleted CheatsheetPanel component and all cheatsheet data files (docker, git, kubectl, vim)

### v0.16.1 - 2026-03-20

- **fix**: Browser panel width changed from fixed 600px to 40% of window width — scales properly across different screen sizes

### v0.16.0 - 2026-03-20

- **feat**: Browser Left Panel — browser moved from an embedded PanelConnection type to an independent 600px left-side panel, coexisting with the right-side toolkit panel (280px)
- **feat**: Keep-alive WebView2 — browser webview is created lazily on first open and never destroyed, preserving browsing state (scroll position, form data, JS runtime) across toggles
- **feat**: Home button in browser toolbar — navigates to the configured homepage (Settings → Browser, default: Google)
- **feat**: Browser toggle via `Ctrl+Shift+B` keyboard shortcut and Command Palette ("Show/Hide Browser")
- **feat**: Browser panel header with close button matching Apple HIG SidePanel design (36px)
- **feat**: Toolbar with Back, Forward, Reload, Home buttons and URL input bar with backdrop blur
- **refactor**: Removed `'browser'` from `PanelConnection` type union — browser is no longer a panel grid connection type
- **refactor**: Removed browser option from PanelContextMenu, SessionPicker, and Command Palette connection switching
- **migration**: Existing workspaces with browser panels in localStorage are automatically converted to local terminal sessions

### v0.15.5 - 2026-03-20

- **fix**: Browser webview hidden when overlays are active — context menu no longer covered by native WebView2, command palette blur/dim effect now applies uniformly to browser panels; `overlayActive` prop passed from App.tsx to PanelGrid for browser-specific visibility control

### v0.15.4 - 2026-03-20

- **fix**: Browser panel stays visible when overlays open — removed overlay state (`paletteOpen`, `sshModalOpen`, `settingsModalOpen`, `ctxMenu`) from browser visibility logic; webview now only hides when tab is inactive or panel is zoomed out

### v0.15.3 - 2026-03-20

- **fix**: Browser error/retry UI only shown when webview creation genuinely failed (`error && !created`) — when webview is temporarily hidden by overlays (context menu, command palette), placeholder area is now blank instead of displaying stale error messages

### v0.15.2 - 2026-03-20

- **fix**: `browser_create` now idempotent — returns Ok if webview with same label already exists, preventing false "already exists" errors when overlays (context menu, command palette) toggle browser visibility
- **fix**: `browser_resize` now graceful — returns Ok if webview doesn't exist instead of erroring, handling cases where webview is not yet created or was already destroyed

### v0.15.1 - 2026-03-20

- **fix**: Browser panel toolbar redesigned for Apple HIG — height increased to 40px, larger 28px touch targets, added ⋮ menu button for connection switching
- **fix**: Browser panel activation — toolbar click activates panel, URL input focus activates panel, right-click on toolbar opens context menu
- **fix**: Browser overlay z-order — WebView2 now hidden when context menu, CommandPalette, Settings, or SSH modal is open, preventing native webview from covering React overlays
- **feat**: Set Google as default browser home page instead of blank page
- **fix**: Note panel placeholder changed to "Type your markdown note here..."

### v0.15.0 - 2026-03-20

- **feat**: Browser Panel — native WebView2 browser embedded in the panel grid via Tauri 2 multiwebview; browse the web without leaving the terminal
- **feat**: Browser toolbar with Back, Forward, Reload buttons and URL input bar
- **feat**: Browser panel accessible from SessionPicker, PanelContextMenu, and CommandPalette (`#browser`)
- **feat**: Browser home page configurable in Settings → Browser tab (default: blank page)
- **feat**: Workspace persistence — last visited URL saved and restored on app restart via `browserUrl` field on `PanelConnection`
- **feat**: URL sync via initialization script (intercepts `pushState`/`replaceState`/`popstate`/`hashchange`) + `on_navigation` callback for reliable URL bar updates
- **feat**: 9 Rust IPC commands for webview lifecycle (`browser_create`, `browser_navigate`, `browser_go_back`, `browser_go_forward`, `browser_reload`, `browser_resize`, `browser_destroy`, `browser_get_current_url`, `browser_url_report`)
- **feat**: Webview cleanup in all teardown paths — layout change, tab close, tab kill, and connection switch all properly destroy native WebView2 instances
- **feat**: Browser panel hidden via 0×0 resize when tab is inactive or panel is zoomed out

### v0.14.4 - 2026-03-19

- **feat**: App version displayed in Windows title bar — "v-terminal 0.14.4" shown with version in subdued quaternary label color (11px, weight 400) for quick version identification without visual clutter
- **build**: `__APP_VERSION__` injected at build time via Vite `define` from `package.json` — version updates automatically on next build

### v0.14.3 - 2026-03-19

- **fix**: Note panel now has a visible border matching terminal panels — added `1px solid var(--bg-panel-border)` with `border-radius` to the embedded note panel container
- **fix**: Note panel active state — clicking or focusing a note panel highlights it with the accent color border (`border-color: var(--accent)`), consistent with terminal panel activation behavior
- **fix**: `isActive` and `onFocus` props plumbed from PanelGrid to NotePanel so active panel tracking works across both terminal and note panel types

### v0.14.2 - 2026-03-19

- **fix**: Todo panel font size now syncs with terminal and note editor — todo item text and input field dynamically follow the global font size setting (Settings → Appearance or Ctrl +/-)
- **fix**: Note panel header removed — eliminated the 28px "Note" title bar so editor content starts at the same vertical position as terminal panels, improving visual consistency across panel types (Apple HIG: reduce chrome, maximize content)

### v0.14.1 - 2026-03-19

- **fix**: Local PTY sessions now set `TERM=xterm-256color` and `COLORTERM=truecolor` environment variables — CLI tools (Gemini CLI, neovim, bat, delta, etc.) correctly detect 24-bit true color support instead of showing "True color not detected" warnings

### v0.14.0 - 2026-03-19

- **feat**: Note Panel — notes promoted from a side panel tab to a full panel type; any panel can be switched to a markdown editor via right-click context menu, command palette (`#` prefix), or SessionPicker
- **feat**: Multiple note panels — a single tab can have a mix of terminal and note panels in any layout (e.g., 2-split: terminal left, note right)
- **feat**: Global Todos — todo list extracted from per-tab notes into a single global list, accessible from the dedicated "Todos" tab in the toolkit side panel
- **feat**: Workspace persistence — tab layout, panel types, connection info, and note content are saved to localStorage and fully restored on app restart
- **feat**: Todos tab icon — new checklist-style SVG icon replaces the old notes icon in the toolkit panel
- **refactor**: `noteStore` rewritten to key by panel ID instead of tab ID; todos moved to separate `todoStore`
- **refactor**: Side panel restructured: Notes tab removed, Todos tab added as first tab (global)
- **fix**: Note data properly cleaned up on tab close, layout shrink, and panel connection switch
- **fix**: Layout expansion from a note panel creates local terminal panels (not more note panels)
- **migration**: Existing per-tab todos are merged into the global todo list; per-tab notes are discarded (incompatible with panel-based model)

### v0.13.5 - 2026-03-19

- **perf**: Tab close is now instant — `handleTabKill` no longer `await`s session kills before removing the tab; UI updates immediately with kills running in the background (fire-and-forget)
- **perf**: `kill_process_tree` changed from blocking `.output()` to non-blocking `.spawn()` — `taskkill /F /T` (Windows) and `kill -9` (Unix) no longer block the tokio runtime thread

### v0.13.4 - 2026-03-19

- **fix**: Tab close kills panels sequentially instead of in parallel — `SessionManager::kill()` held the tokio `Mutex` lock across `session.kill().await` due to Rust 2021 `if let` temporary lifetime rules; separated the lock scope so concurrent kills no longer serialize through mutex contention

### v0.13.3 - 2026-03-19

- **fix**: Terminal output overflow in split layouts — moved padding from `.terminal-container` to `.xterm` element so that xterm.js FitAddon correctly accounts for padding when calculating row count; previously `box-sizing: border-box` caused FitAddon to overestimate available height, rendering extra rows that overflowed behind adjacent panels

### v0.13.2 - 2026-03-19

- **fix**: Terminal container bottom padding added — terminal content no longer appears flush against the bottom edge of the panel (matched to top/left padding)

### v0.13.1 - 2026-03-19

- **feat**: Onboarding "Flexible Layout" slide — new welcome page slide showcasing multi-panel layouts (1 to 9 panels) and independent panel connections (Local, SSH, WSL)
- **feat**: CSS-only layout illustration with miniature layout thumbnails (single, split, quad, L-shaped) and a 2-panel split preview showing different connection types with colored badges
- **fix**: Keycap badges conditionally rendered — slides without shortcut keys no longer display an empty shortcut section

### v0.13.0 - 2026-03-19

- **refactor**: Terminal font changed from JetBrains Mono Nerd Font to plain JetBrains Mono — lighter, cleaner default font without bundled Nerd Font glyphs
- **feat**: Symbols Nerd Font Mono added as dedicated icon fallback — only contains Nerd Font glyphs (Powerline, file icons, etc.) with no alphanumeric characters, preventing fallback font pollution
- **cleanup**: Removed 96 unused JetBrains Mono Nerd Font variant files (113MB → 0.8MB for terminal fonts, 92% reduction in font bundle size)
- **refactor**: All CSS `font-family` declarations updated to reference `"JetBrains Mono"` directly instead of `"JetBrainsMonoNerdFont"`
- **refactor**: Terminal font fallback chain changed to `user font → SymbolsNerdFontMono → Nanum Gothic Coding → monospace`

### v0.12.5 - 2026-03-19

- **fix**: WSL connections changed from SSH tunnel to direct PTY — `wsl.exe -d {distro} --cd ~` runs directly as a local session, eliminating sshd setup, password prompts, and connection failures
- **cleanup**: Removed `wsl_ssh_setup.rs` module (sshd provisioning, key generation, port scanning, kill_sshd) — 474 lines deleted
- **cleanup**: Removed `create_wsl_ssh` method, `wsl_ssh_cache` field, and WSL sshd process cleanup from `SessionManager`

### v0.12.4 - 2026-03-19

- **fix**: WSL sshd shell exits immediately — added `UsePAM no` to sshd config to prevent PAM-related session failures in WSL environments where PAM is not properly configured
- **fix**: WSL sshd fails to start without `/run/sshd` — auto-creates the privilege separation directory before launching sshd (tries without sudo first, falls back to sudo if needed)
- **fix**: WSL sshd error diagnostics — sshd now logs to `/tmp/vterminal_sshd_{port}.log` and error messages include log tail on failure

### v0.12.3 - 2026-03-19

- **fix**: WSL sshd race condition — waits up to 3 seconds for sshd to start listening before attempting SSH connection (100ms polling interval)
- **fix**: WSL SSH connection retry simplified — retries SSH connect up to 3 times (1s interval) on connection refused instead of re-running full sshd setup; cache invalidated only after all retries exhausted

### v0.12.2 - 2026-03-19

- **fix**: WSL sshd failed to start — `HostKey %h/...` token is not supported in sshd_config's HostKey directive; now resolves absolute home path via `$HOME` before writing config
- **fix**: Added sudo fallback for sshd start — if non-root sshd is restricted by the distro, automatically retries with sudo

### v0.12.1 - 2026-03-19

- **fix**: WSL sshd now runs as normal user — uses user-owned host keys (`~/.vterminal/ssh_host_*` inside WSL) instead of system `/etc/ssh/` keys, eliminating the need for sudo on every app restart
- **fix**: Sudo password is now only required once for initial `openssh-server` installation; subsequent sshd starts need no password
- **fix**: WSL/SSH password dialog shows connecting spinner after clicking Connect instead of appearing unresponsive
- **fix**: Password dialog now explains why the password is needed (openssh-server installation or SSH key not found)
- **fix**: Added Cancel button to password dialog (previously only Escape key worked)
- **cleanup**: Removed unused `SessionType` enum, `open_sftp`, `exec_command`, and session metadata methods left over from v0.11.0 Claude Code Panel removal

### v0.12.0 - 2026-03-19

- **feat**: WSL SSH-based connection — WSL sessions now connect via SSH to sshd inside the WSL distro instead of ConPTY + wsl.exe, dramatically improving I/O performance
- **feat**: Automatic sshd provisioning — first WSL connection auto-installs openssh-server, generates a dedicated SSH key pair (`~/.vterminal/wsl_id_ed25519`), registers the key, and starts sshd with a localhost-only config
- **feat**: WSL sudo password dialog — if sshd setup requires sudo, an interactive password prompt appears (reuses existing SSH password dialog pattern)
- **feat**: Connection-refused retry — if sshd dies between sessions, v-terminal automatically re-provisions and retries once
- **feat**: Separate WSL known_hosts file (`~/.vterminal/wsl_known_hosts`) to avoid conflicts with user's SSH known_hosts
- **feat**: sshd lifecycle management — sshd processes are cleaned up on app exit; orphaned sshd from crashes are detected and reused on next launch
- **refactor**: `SshSession` parameterized with `SessionType` — WSL SSH sessions report as `SessionType::Wsl` while regular SSH sessions remain `SessionType::Ssh`
- **refactor**: SSH connection pool supports `known_hosts_override` for per-connection known_hosts file selection
- **refactor**: Frontend WSL connections use `wslDistro` field instead of `shellProgram`/`shellArgs`, simplifying the data flow through SessionPicker, PanelContextMenu, PanelGrid, TerminalPane, and App command palette

### v0.11.0 - 2026-03-19

- **breaking**: Removed Claude Code Panel (CLAUDE.md editor, Dashboard, Git diff viewer) — PTY injection for CWD detection interfered with TUI applications (e.g. Claude Code) in WSL/SSH sessions; will be redesigned in a future release
- **removed**: ClaudeCodePanel, GitPanel, UsageBar components and all supporting stores (`claudeCodeStore`, `gitStore`, `dashboardStore`, `usageStore`)
- **removed**: Backend `claude` module (CWD resolver, CLAUDE.md discovery, dashboard stats, file watcher, usage parser) and `git` module (status, diff, parser, watcher)
- **removed**: OSC 7337 CWD sequence injection and parsing from session readers
- **removed**: Keyboard shortcuts `Ctrl+Shift+L` (Claude panel), `Ctrl+Shift+G` (Git panel), `Ctrl+Shift+D` (Dashboard)
- **cleanup**: Simplified session data flow — local and SSH readers now forward PTY output directly without escape sequence filtering

### v0.10.6 - 2026-03-18

- **fix**: SSH session deadlock — replaced `Arc<Mutex<Channel>>` with mpsc command channel pattern to prevent reader task from holding the Mutex across `channel.wait().await`, which blocked all writes/resizes indefinitely

### v0.10.5 - 2026-03-18

- **fix**: SSH profile identity file can now be cleared — clearing the field and saving properly removes the stored key path instead of retaining the old value

### v0.10.4 - 2026-03-18

- **fix**: SSH known_hosts now reads from standard `~/.ssh/known_hosts` instead of custom `~/.vterminal/known_hosts` — shares host keys with OpenSSH, eliminating false "Unknown Server key" warnings

### v0.10.3 - 2026-03-18

- **fix**: SSH default key search uses Windows-native paths (`%USERPROFILE%\.ssh\`) and additionally checks `%ProgramData%\ssh\` for system-wide OpenSSH keys

### v0.10.2 - 2026-03-18

- **fix**: SSH auto-discovers default keys (`~/.ssh/id_ed25519`, `id_rsa`, `id_ecdsa`, `id_dsa`) when no key file is specified in the profile — no longer prompts for password unnecessarily
- **fix**: Suppressed Rust compiler warnings — `#[allow(dead_code)]` for reserved `ConnectionStatus` variants, `mark_disconnected`, `ClaudeMdWatcher`, and `is_binary_diff`; `#[allow(non_snake_case)]` for Windows API function type signature

### v0.10.1 - 2026-03-18

- **fix**: Rust build errors — `HANDLE` null checks changed from `== 0` to `.is_null()` in `cwd_resolver.rs` (Windows API type mismatch)
- **fix**: Removed unused `mut` on `today_output` in `usage.rs` to silence compiler warning

### v0.10.0 - 2026-03-18

- **feat**: Onboarding Welcome Page — full-screen welcome experience for first-time users with 3 slides introducing key features
- **feat**: Slide 1: Command Palette (`Ctrl+K`) — tabs, layouts, clipboard history, cheatsheets
- **feat**: Slide 2: Claude Code Panel (`Ctrl+Shift+L`) — CLAUDE.md editor, Git diffs, token dashboard
- **feat**: Slide 3: Productivity Tools (`Ctrl+Shift+N`) — notes, Pomodoro timers, cheatsheets
- **feat**: CSS-only schematic illustrations for each slide, theme-adaptive (light/dark)
- **feat**: Keycap-style shortcut badges with JetBrains Mono font
- **feat**: Slide navigation — dot indicators, Next/Skip buttons, keyboard arrows, Enter, Escape
- **feat**: `onboardingStore` (Zustand) with localStorage persistence for first-run detection
- **feat**: "Show Welcome Page" button in Settings → Appearance tab with Toast notification
- **feat**: Keyboard guard in App.tsx — global shortcuts disabled while welcome overlay is active
- **feat**: `prefers-reduced-motion` support — all animations disabled for accessibility
- **feat**: 200ms fade-out dismiss animation, 300ms horizontal slide transitions

### v0.9.0 - 2026-03-18

- **feat**: Claude Code Dashboard tab — usage metrics dashboard integrated into the left sidebar as a third tab alongside CLAUDE.md and Git
- **feat**: Today's Summary cards (2x2 grid) showing session count, message count, total tokens, and vs-yesterday percentage change
- **feat**: Model Distribution — horizontal stacked bar with color-coded legend showing per-model token usage (Opus, Sonnet, etc.)
- **feat**: Cache Efficiency — cache hit rate progress bar with percentage display
- **feat**: 7-Day Trend — CSS-only vertical bar chart with daily token usage and average line
- **feat**: Dashboard data parsed from `~/.claude/stats-cache.json` including `dailyActivity`, `dailyModelTokens`, and `modelUsage` fields
- **feat**: SSH/WSL support — dashboard reads remote `stats-cache.json` via SFTP for SSH sessions
- **feat**: Auto-refresh every 60 seconds, paused when browser tab is hidden
- **feat**: `Ctrl+Shift+D` keyboard shortcut to open Dashboard tab
- **feat**: UsageBar click handler opens Dashboard tab in left panel
- **feat**: Empty and loading skeleton states for dashboard

### v0.8.0 - 2026-03-18

- **feat**: Git Diff Viewer — read-only git status and unified diff viewer integrated into the left sidebar
- **feat**: Git file list showing unstaged and staged changes with status indicators (M/A/D/R/?) in collapsible accordion sections
- **feat**: DiffViewer overlay — CodeMirror 6-based unified diff rendering with syntax-highlighted added/deleted/hunk lines
- **feat**: Git command execution across all session types — Local (`std::process::Command`), WSL (`wsl -e git`), and SSH (russh exec channel)
- **feat**: SSH exec channel — new `exec_command` method on `SshConnectionPool` for running arbitrary commands via SSH without PTY interference
- **feat**: `.git/index` and `.git/HEAD` file watching via `notify` crate with 500ms debounce for auto-refresh on local sessions
- **feat**: Git panel accessible via `Ctrl+Shift+G` shortcut and "Show Git Panel" command palette entry
- **feat**: Large diff protection — diffs exceeding 10,000 lines are truncated with a warning
- **feat**: Binary file detection — shows "Binary file — diff not available" message instead of garbled output
- **refactor**: Extracted `useSessionCwd` shared hook from `ClaudeCodePanel` for reuse by both Claude and Git panels
- **deps**: SSH exec channel leverages existing `russh` 0.48 dependency (no new crates)

### v0.7.0 - 2026-03-18

- **feat**: Claude Code Panel (left sidebar) — auto-discovers and edits CLAUDE.md files based on active terminal session's working directory
- **feat**: CLAUDE.md discovery walks from CWD to root, detecting project root via `.git`, with user/project/directory/parent level classification
- **feat**: SFTP CLAUDE.md operations — read, write, and discover CLAUDE.md files on remote SSH hosts via `russh-sftp` high-level API
- **feat**: Windows CWD detection — reads process working directory via `NtQueryInformationProcess` PEB reading with PTY injection fallback
- **feat**: OSC 7337 CWD protocol — PTY-injected `pwd` command with custom escape sequence, intercepted in session readers before reaching xterm.js
- **feat**: Usage Bar (bottom status bar) — displays Claude Code usage stats parsed from `~/.claude/stats-cache.json` (per-model tokens, costs)
- **feat**: CodeMirror 6 markdown editor for CLAUDE.md with syntax highlighting, auto-save (500ms debounce), and read-only mode
- **feat**: Context indicator showing active session type (Local/WSL/SSH) and current working directory
- **feat**: File change detection via `notify` crate for local CLAUDE.md files
- **feat**: Session trait extended with `session_type()`, `connection_id()`, and `process_id()` for CWD resolution routing
- **feat**: Command palette integration — "Show/Hide Claude Code Panel" with `Ctrl+Shift+L` shortcut
- **fix**: Cheatsheet icon changed from document+lines to `</>` code bracket to resolve visual conflict with Notes icon
- **fix**: Path validation on `write_claude_md` prevents arbitrary file writes (security)
- **refactor**: Shared CodeMirror 6 setup extracted to `codemirrorSetup.ts` for reuse across NoteEditor and ClaudeMdEditor
- **deps**: Added `notify` 7, `windows-sys` 0.59 (Windows-only)

### v0.6.0 - 2026-03-18

- **feat**: Rust-native SSH via `russh` — replaces shell-based `ssh` command execution with programmatic SSH connection management
- **feat**: Unified `SessionManager` with `Session` trait abstracting local PTY and SSH shell sessions behind a single IPC API
- **feat**: `SshConnectionPool` — connection reuse per (host, port, username), 10s timeout, TOFU host key verification
- **feat**: Multi-channel SSH — single connection supports multiple shell channels and future SFTP
- **feat**: Key file and password authentication with interactive password dialog
- **feat**: SSH connection state detection with "Connection lost" overlay banner
- **feat**: SFTP foundation code (`open_sftp` method) for future remote file access features
- **refactor**: IPC commands renamed from `pty_*` to `session_*` (`session_create`, `session_write`, `session_resize`, `session_kill`)
- **refactor**: Frontend migrated from `ptyId`/`sshCommand` to `sessionId`/`sshProfileId` model
- **deps**: Added `russh` 0.48, `russh-keys` 0.48, `russh-sftp` 2.0, `async-trait`, `dirs`

### v0.5.0 - 2026-03-18

- **refactor**: Removed out-of-process daemon — PTY sessions now run directly in the Tauri backend via `PtyManager`
- **refactor**: Removed daemon binary, client, state management, build scripts, and splash screen
- **feat**: Direct PTY IPC commands (`pty_commands`, `wsl_commands`) for lower-latency terminal I/O
- **feat**: Restored SessionPicker as the new tab page with layout and connection picker
- **fix**: `pty_create` changed to async for proper tokio runtime context
- **fix**: Window-state plugin VISIBLE flag excluded from restore; close changed to `CloseRequested`
- **style**: New tab page content centered with cleaner layout

### v0.4.0 - 2026-03-17

- **feat**: Clipboard history with command palette integration (`!` prefix) and localStorage persistence
- **feat**: Cheatsheet panel — Vim, Git, Docker, kubectl quick references with copy-to-clipboard
- **feat**: Cheatsheet drill-down navigation in command palette (`?` prefix)
- **feat**: Lightweight toast notification component
- **perf**: Daemon protocol switched to base64 encoding for binary data transfer
- **perf**: TCP write backpressure with bounded channel per connection
- **perf**: Scrollback optimized with bulk drain
- **feat**: Graceful daemon shutdown with signal handling
- **feat**: Session limit (64) and increased broadcast capacity to 4096
- **fix**: KillSession now terminates full child process tree
- **fix**: Broadcast lag recovery with scrollback resync instead of silent drop
- **fix**: Idle freeze prevention (heartbeat + WebGL recovery + listener leak fix)
- **style**: Command palette HIG compliance (44px touch targets, smoother animations)
- **refactor**: Command palette prefixes reassigned (`!` clipboard, `?` cheatsheet, `%` layout)

### v0.3.0 - 2026-03-17

- **feat**: Splash screen with startup progress indicator and 15s daemon timeout
- **feat**: Panel context menu with Switch Connection and full connection list
- **feat**: Command palette `#` prefix for dynamic connection switching per panel
- **feat**: Command palette `!` prefix for layout mode switching
- **feat**: Background tray indicator in tab bar for backgrounded tabs
- **feat**: Tab right-click context menu with background, close, rename actions
- **feat**: 6 new terminal fonts (Commit Mono, Geist Mono, Iosevka, Maple Mono, Victor Mono)
- **perf**: WebGL renderer with Canvas/DOM fallback for improved rendering performance
- **refactor**: Tab close default changed to kill; browser/webview feature fully removed
- **fix**: Apple HIG compliance fixes (6 items), panel context menu emoji replaced with SVG icons
- **fix**: Terminal font hot-reload, font load failure warning in settings
- **fix**: Session restore preserves note/todo data; note panel placeholder switched to English

### v0.2.0 - 2026-03-16

- Minor version bump — consolidates all v0.1.x features into a stable baseline

### v0.1.18 - 2026-03-16

- **feat**: Settings modal with Appearance and Terminal configuration tabs
- **feat**: Bundled terminal font selector (Cascadia Code, Fira Code, Hack, IBM Plex Mono, Inconsolata, Monaspace Neon, Sarasa Mono K, Source Code Pro, Tab0 Mono K)
- **feat**: Terminal font size adjustment support
- **feat**: Alarm system — Pomodoro timer, countdown timer, and recurring alarms with notifications
- **feat**: Toolkit side panel — Notes and Timers merged into unified tabbed panel
- **feat**: Markdown note editor with CodeMirror 6 and per-tab todo lists
- **feat**: Session picker — per-panel layout selection and connection settings
- **feat**: Command palette `@` prefix for direct SSH profile connection
- **feat**: Pomodoro redesign with 4x3 preset grid and stepper controls
- **refactor**: xterm.js upgraded to 6.0.0 with scroll/IME workaround cleanup
- **refactor**: Sidebar consolidated into single Toolkit panel (Ctrl+Shift+N)
- **refactor**: SSH manager refactored to profile-only management with integrated connection workflow
- **refactor**: Command palette UX overhaul with prefix hints and keyboard navigation fixes
- **fix**: Font fallback changed to JetBrainsMonoNerdFont
- **fix**: IME composition output buffering to prevent character drops
- **fix**: IME stuck-state recovery and composition timeout safety net
- **fix**: Alternate buffer scroll restoration skipped correctly during resize and font changes
- **fix**: Terminal scroll jump to top issue resolved
- **fix**: Focus loss causing IME composing flag to stick, blocking Korean input

### v0.1.17 - 2026-03-14

- **feat**: Global note panel with command palette toggle
- **feat**: 4-column layout added
- **feat**: Tab bar overflow — proportional shrink and scroll arrows
- **feat**: Command palette — restore background tabs and tab navigation
- **feat**: SSH Connection modal UX and design improvements
- **feat**: Session picker card grid and empty state improvements
- **refactor**: Appearance theme picker switched to drill-down view
- **refactor**: Tab bar + button inline and toolbar ⋯ overflow menu consolidation
- **refactor**: Close tab button unified to single button; Ctrl+click sends to background
- **refactor**: Design token consistency improvements across all components
- **fix**: Korean IME key leak to PTY during composition
- **fix**: Session picker auto-closes background tab when restoring
- **fix**: Terminal scroll reset after resize
- **fix**: More menu UX and layout improvements

### v0.1.16 - 2026-03-13

- **fix**: Terminal I/O triple-duplication bug resolved
- **refactor**: Tab bar right-side button alignment and design consistency
- **refactor**: Daemon status indicator simplified to a dot next to the title bar
- **refactor**: Tab bar icon design and spacing unified
- **refactor**: Clean code refactoring and performance improvements

### v0.1.15 - 2026-03-13

- **fix**: Toolbar icon alignment — removed gap/separator double-spacing in SplitToolbar
- **fix**: Terminal URL click now opens in the system browser via Tauri shell plugin
- **feat**: Command palette open button added to the toolbar
- **fix**: Panel zoom replaces fullscreen toggle
- **refactor**: UI text fully switched to English; tab list categories separated in command palette
- **fix**: Command palette previous/next tab removed; fullscreen permission added
- **fix**: Command palette fullscreen toggle and focus restoration
- **feat**: Expanded command palette with layout, SSH, tab, and panel commands
- **fix**: Korean IME input reliability improvements in terminal
- **fix**: Preserve terminal scroll position on window resize/maximize

## Version Management

When bumping the version, **both files must be updated together**:

1. `package.json` — `version` field
2. `src-tauri/tauri.conf.json` — `version` field

Tauri reads the installer version exclusively from `tauri.conf.json`. Missing this update causes the installer to report the previous version.

