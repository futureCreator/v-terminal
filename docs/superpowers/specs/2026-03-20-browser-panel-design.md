# Browser Panel Design Spec

**Date**: 2026-03-20
**Status**: Draft

## Overview

Add a built-in browser panel to v-terminal, enabling users to browse the web without leaving the terminal. Uses Tauri 2 Multiwebview to embed a native WebView2 instance within the panel grid — full website compatibility, no iframe limitations.

## Requirements

- General-purpose web browser as a panel type (alongside Local, SSH, WSL, Note)
- Navigation toolbar: URL bar + Back / Forward / Reload buttons
- No DevTools needed
- Workspace restore: last visited URL is saved and restored on app restart
- Configurable home page in Settings (default: blank page)
- Accessible from: SessionPicker, PanelContextMenu, CommandPalette (`#browser`)

## Architecture

### Rendering Model

```
┌─────────────────────────────────────┐
│ ◀ ▶ ↻   [ https://example.com    ] │  ← React toolbar (~32px)
├─────────────────────────────────────┤
│                                     │
│     Native WebView2 (overlay)       │  ← Tauri child webview
│                                     │
│                                     │
└─────────────────────────────────────┘
```

React renders the toolbar (URL bar + nav buttons) — consistent theming with the rest of the app. Below the toolbar, a placeholder `<div>` is measured and its bounds are sent to Rust via IPC. Rust creates a native WebView2 child webview at those exact coordinates, overlaying on top of the main webview.

**Why Rust IPC over JS Webview API**: All webview operations go through custom Rust IPC commands (not `@tauri-apps/api/webview` directly). This gives us full control over the webview lifecycle, navigation event handling, and initialization scripts. The JS `Webview` class is not used directly by frontend code.

### Coordinate System

`getBoundingClientRect()` returns CSS pixels (logical pixels). These are passed to Rust as `LogicalPosition` / `LogicalSize`. Tauri handles DPI scaling internally. Since v-terminal uses a frameless window with a custom title bar rendered inside the webview, there is no non-client area offset — CSS pixel coordinates map directly to window client area coordinates.

### Data Flow

1. User selects `Browser` as panel type (SessionPicker / ContextMenu / CommandPalette)
2. `PanelGrid` renders `BrowserPanel` component
3. `BrowserPanel` mounts → measures placeholder div → calls `browser_create` IPC
4. `ResizeObserver` tracks placeholder size → calls `browser_resize` IPC (throttled 50ms)
5. URL sync via initialization script (see URL Sync section) → React updates URL bar + persists to workspace
6. `BrowserPanel` unmounts → calls `browser_destroy` IPC

### Webview Label Convention

`browser-{panelId}` — unique per panel, used as the Tauri webview label.

## Type Changes

### `src/types/terminal.ts`

```typescript
export interface PanelConnection {
  type: 'local' | 'ssh' | 'wsl' | 'note' | 'browser';
  sshProfileId?: string;
  shellProgram?: string;
  shellArgs?: string[];
  wslDistro?: string;
  label?: string;
  browserUrl?: string;   // NEW: persisted URL for workspace restore
}
```

## New Files

### `src/components/BrowserPanel/BrowserPanel.tsx`

Browser panel component with:
- **Toolbar**: Back, Forward, Reload buttons + URL input field
- **Placeholder div**: measured for webview positioning
- **Lifecycle hooks**:
  - `useEffect` (mount): measure bounds → `browser_create` IPC
  - `ResizeObserver`: track size changes → `browser_resize` IPC (throttled 50ms)
  - `useEffect` (unmount): `browser_destroy` IPC
  - `listen('browser-url-changed')`: update URL bar + persist `browserUrl` (filter by label in callback — Tauri global events have no built-in label filter)
- **Hidden handling**: when panel is hidden (tab switch, zoom), send `browser_resize` with 0,0 size
- **Focus**: `onFocus` prop triggered from placeholder area
- **Error state**: if `browser_create` fails, show error message in placeholder div with retry button
- **connKey note**: `browserUrl` must NOT be included in PanelGrid's `connKey` computation — URL changes should not cause React remounts (which would destroy/recreate the webview)

### `src/components/BrowserPanel/BrowserPanel.css`

Toolbar styling consistent with existing panel headers (frosted glass, theme-adaptive).

### `src/store/browserConfigStore.ts`

```typescript
localStorage key: "v-terminal:browser-config"

interface BrowserConfig {
  homePage: string;  // default: "" (empty = about:blank)
}

// Actions
setHomePage(url: string): void
getStartUrl(): string  // returns homePage or "about:blank"
```

### `src-tauri/src/commands/browser_commands.rs`

Seven IPC commands:

**`browser_create(app, label, url, x, y, width, height)`**
- Gets main window via `app.get_webview_window("main")`
- Creates child webview with `WebviewBuilder::new(&label, WebviewUrl::External(url))`
- Sets `.position(x, y).size(width, height)`
- Uses `on_navigation` callback to capture pre-navigation URLs (best-effort, does not capture redirects/SPA)
- Injects initialization script via `.initialization_script()` for reliable URL sync (see URL Sync section)
- All coordinates are `LogicalPosition` / `LogicalSize` (CSS pixels from frontend)

**`browser_navigate(app, label, url)`**
- Gets webview via `app.get_webview(&label)`
- Auto-prepends `https://` if no scheme present
- Calls `webview.navigate(url.parse())`

**`browser_go_back(app, label)`**
- `webview.eval("window.history.back()")`
- Known limitation: some SPAs may override history behavior

**`browser_go_forward(app, label)`**
- `webview.eval("window.history.forward()")`

**`browser_reload(app, label)`**
- `webview.eval("window.location.reload()")`

**`browser_resize(app, label, x, y, width, height)`**
- `webview.set_position(LogicalPosition)` + `webview.set_size(LogicalSize)`
- Size 0,0 effectively hides the webview

**`browser_destroy(app, label)`**
- `webview.close()` to remove child webview

**Event payload**:
```rust
#[derive(Clone, Serialize)]
struct BrowserUrlPayload {
    label: String,
    url: String,
}
```

## URL Sync Mechanism

**Problem**: Tauri's `on_navigation` is a pre-navigation gate (allow/deny), not a URL-changed observer. It does not fire after redirects, client-side `pushState`, or `hashchange` events. We need a reliable way to know the current URL.

**Solution: Initialization Script + Polling Hybrid**

1. **Initialization script** (injected via `WebviewBuilder::initialization_script()`):
   - Listens for `popstate`, `hashchange` events
   - Overrides `history.pushState` and `history.replaceState` to intercept SPA navigation
   - On URL change, calls `window.__TAURI__.invoke('__browser_url_report', { label, url })` or uses `postMessage` to notify the host
   - This covers ~90% of navigation cases (link clicks, SPA routing, hash changes)

2. **`on_navigation` callback** (best-effort):
   - Captures standard navigation (link clicks, form submits) before they happen
   - Always returns `true` (allow all navigation)
   - Emits `browser-url-changed` event with the target URL

3. **Fallback polling** (catch-all):
   - `BrowserPanel` runs a `setInterval` every 1000ms calling `browser_get_current_url` IPC
   - This IPC runs `webview.eval("window.location.href")` and returns the result
   - Only updates URL bar if the URL has actually changed (avoids unnecessary re-renders)
   - Catches any edge cases missed by the initialization script

**Combined flow**:
1. User clicks a link → `on_navigation` fires → emits `browser-url-changed` (immediate)
2. Page does `pushState` → initialization script intercepts → reports URL change
3. Fallback poll at 1s interval catches anything missed
4. `BrowserPanel` deduplicates all URL updates (only acts on actual changes)

### Adding `browser_get_current_url` IPC

**`browser_get_current_url(app, label) -> Result<String, String>`**
- Calls `webview.eval("window.location.href")` and returns the URL
- Used by the fallback polling mechanism

Total: **8 IPC commands** (7 original + `browser_get_current_url`).

## Modified Files

### `src/components/PanelGrid/PanelGrid.tsx`

- Import `BrowserPanel`
- Add rendering branch:
  - `connection.type === "note"` → `NotePanel`
  - `connection.type === "browser"` → `BrowserPanel`
  - else → `TerminalPane`
- In `handleSwitchConnection`: if previous panel was `browser`, call `browser_destroy` IPC (similar to note cleanup pattern)

### `src/components/SessionPicker/SessionPicker.tsx`

- Add `'browser'` to `ConnectionOption.type`
- Add browser option to `connectionOptions` array (after Note):
  - `{ id: "browser", type: "browser", name: "Browser", subtitle: "Web browser" }`
- Add `optionToConnection` branch: `return { type: "browser" }`
- Add globe icon `IconBrowser`
- Add `.sp-dot--browser` color class

### `src/components/PanelContextMenu/PanelContextMenu.tsx`

- Add Browser item after Note section (with divider)
- Globe icon, label "Browser", meta "Web"
- `handleClick({ type: "browser" })`

### `src/App.tsx`

**connectionSection (CommandPalette)**:
- Add `conn:browser` command after Note, before WSL/SSH:
  - Label: "Browser"
  - Description: "Open a web browser in this panel"
  - Meta: "Web"
  - Globe icon
  - Active check: `connType === "browser"`
  - On switch: if previous was `note`, call `removeNote`; if previous was `browser`, call `browser_destroy`

**handleLayoutChange**:
- When layout shrinks and panels are removed, destroy browser webviews for removed panels:
  ```typescript
  const removedBrowserPanelIds = removed
    .filter((p) => p.connection?.type === "browser")
    .map((p) => p.id);
  for (const id of removedBrowserPanelIds) {
    ipc.browserDestroy(`browser-${id}`).catch(() => {});
  }
  ```

**handleTabClose / handleTabKill**:
- Add browser panel cleanup alongside existing note panel cleanup:
  ```typescript
  const browserPanelIds = tab.panels
    .filter((p) => p.connection?.type === "browser")
    .map((p) => p.id);
  for (const id of browserPanelIds) {
    ipc.browserDestroy(`browser-${id}`).catch(() => {});
  }
  ```

### `src/components/SettingsModal/SettingsModal.tsx`

- Add `"browser"` to `Tab` type: `type Tab = "appearance" | "terminal" | "browser"`
- Add "Browser" nav item with globe icon
- New `BrowserTab` component:
  - "Home Page" section
  - URL text input field
  - Sublabel: "Leave empty for blank page"
  - Reads/writes via `browserConfigStore`

### `src/store/tabStore.ts`

- Update `baseConnection` skip to include browser:
  ```typescript
  const baseConnection = (firstConn?.type === "note" || firstConn?.type === "browser")
    ? undefined : firstConn;
  ```
  New panels should NOT inherit browser type when layout expands (same pattern as note).

### `src/lib/tauriIpc.ts`

- Add 8 new IPC wrapper functions:
  - `browserCreate(label, url, x, y, width, height)`
  - `browserNavigate(label, url)`
  - `browserGoBack(label)`
  - `browserGoForward(label)`
  - `browserReload(label)`
  - `browserResize(label, x, y, width, height)`
  - `browserDestroy(label)`
  - `browserGetCurrentUrl(label)`

### `src-tauri/src/lib.rs`

- Register all 8 commands in `invoke_handler`

### `src-tauri/src/commands/mod.rs`

- Add `pub mod browser_commands;`

## Workspace Restore Flow

1. App starts → `loadWorkspace()` restores tabs with `PanelConnection` data
2. Panel with `connection.type === "browser"` renders `BrowserPanel`
3. `BrowserPanel` reads `connection.browserUrl`
4. If `browserUrl` exists → use it as start URL
5. If `browserUrl` is empty → use `browserConfigStore.getStartUrl()` (home page or about:blank)

## Browser Icon (Shared)

Globe icon used consistently across SessionPicker, ContextMenu, CommandPalette, and Settings:

```svg
<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
  <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.25" />
  <ellipse cx="8" cy="8" rx="3" ry="6" stroke="currentColor" strokeWidth="1.1" />
  <line x1="2" y1="8" x2="14" y2="8" stroke="currentColor" strokeWidth="1.1" />
</svg>
```

## Edge Cases

- **URL without scheme**: Auto-prepend `https://` (e.g., "google.com" → "https://google.com")
- **Invalid URL**: Show error toast, don't navigate
- **Panel hidden (tab switch)**: Resize webview to 0,0 — avoid rendering offscreen content
- **Panel zoom**: Resize webview to full panel area
- **Layout change (panels removed)**: Explicitly destroy webview via IPC in `handleLayoutChange`
- **Tab close/kill**: Explicitly destroy all browser webviews in the tab
- **Multiple browser panels**: Each has unique label (`browser-{panelId}`), independent state
- **New panels inherit connection**: When layout expands, new panels do NOT inherit browser type — `baseConnection` skips `browser` (same as note)
- **browser_create failure**: Show error message in placeholder div with retry button
- **`connKey` stability**: `browserUrl` is NOT part of `connKey` — URL changes must not trigger React remount
- **Switch away from browser**: All code paths (ContextMenu, CommandPalette, direct switchPanelConnection) must call `browser_destroy` before switching

## Dependencies

- Tauri 2 `unstable` feature — already enabled in `Cargo.toml`
- `@tauri-apps/api` — for `listen()` event subscription (webview class NOT used directly)
- No new Rust crate dependencies needed
