# Browser Left Panel Design Spec

**Date:** 2026-03-20
**Status:** Approved

## Summary

Move the browser from a PanelConnection type (embedded in PanelGrid) to an independent left-side panel. The browser panel is 600px wide, toggleable via `Ctrl+Shift+B` and command palette, and can coexist with the right-side SidePanel (280px).

## Layout

```
Before:  [terminal-area (flex:1)] + [SidePanel (280px)]
After:   [BrowserPanel (600px)] + [terminal-area (flex:1)] + [SidePanel (280px)]
```

All three regions are independently toggleable. The browser panel sits on the left with `border-right` separator, mirroring the right SidePanel's `border-left` pattern.

## New Component: LeftBrowserPanel

**Path:** `src/components/LeftBrowserPanel/LeftBrowserPanel.tsx` + `.css`

### Structure

```
LeftBrowserPanel (600px, flex-shrink: 0)
├── Header (36px)
│   ├── Title: "Browser"
│   └── Close button (×)
├── Toolbar (40px, blur backdrop)
│   ├── Back button
│   ├── Forward button
│   ├── Reload button
│   ├── Home button (navigates to configured homepage)
│   └── URL input (flex: 1)
└── Content (flex: 1)
    └── WebView2 placeholder div
```

### Key behaviors

- Reuses the existing Tauri WebView2 IPC calls (`browserCreate`, `browserDestroy`, `browserNavigate`, `browserResize`, `browserGoBack`, `browserGoForward`, `browserReload`)
- Uses a single stable webview label: `browser-left-panel`
- Home button navigates to `browserConfigStore.getStartUrl()` (default: `https://www.google.com`)
- URL input submits on Enter, shows current URL
- Listens for `browser-url-changed` events to sync URL display
- ResizeObserver + window resize listener for webview bounds sync
- **Keep-alive strategy:** WebView2 is created on first open and only hidden (resized to 0,0,0,0) when the panel is closed — not destroyed. This preserves browsing state (scroll position, form data, JS runtime) across toggles. Destroy only happens on app window close.
- Hides webview (resize to 0,0,0,0) when panel is closed or overlays are active
- Receives `overlayActive` prop from App.tsx: `paletteOpen || settingsModalOpen || sshModalOpen || showWelcome`

### Styling (Apple HIG)

- Header matches right SidePanel header height (36px) and styling
- Toolbar uses backdrop-filter blur, consistent with existing browser toolbar
- 600px fixed width, `flex-shrink: 0`
- `border-right: 1px solid var(--separator)` for left-side separation
- `background: var(--bg-secondary)` matching SidePanel
- Smooth open/close transitions are not needed (instant show/hide, same as SidePanel)

## State Management

### localStorage keys

- `v-terminal:browser-panel-open` — boolean string, panel visibility
- `v-terminal:browser-panel-url` — last visited URL (persisted on navigation)

### browserConfigStore (existing)

- Already has `homePage` (default: `https://www.google.com`) and `setHomePage()`
- Already has settings UI in SettingsModal → Browser tab
- No changes needed to this store

## Toggle Mechanisms

### Keyboard shortcut: `Ctrl+Shift+B`

Added to the global keyboard handler in `App.tsx`, same pattern as `Ctrl+Shift+N` (sidebar toggle).

### Command palette

New command in the Tab palette section:
- **id:** `"view:browser"`
- **label:** `"Show Browser"` / `"Hide Browser"` (toggles based on state)
- **description:** `"Toggle the browser side panel"`
- **meta:** `"Ctrl+Shift+B"`
- **isActive:** reflects current open state

## Removals

### PanelConnection type changes

**`src/types/terminal.ts`:**
- Remove `'browser'` from `PanelConnection.type` union
- Remove `browserUrl` field from `PanelConnection`

```typescript
// Before
type: 'local' | 'ssh' | 'wsl' | 'note' | 'browser';
browserUrl?: string;

// After
type: 'local' | 'ssh' | 'wsl' | 'note';
```

### PanelGrid changes

**`src/components/PanelGrid/PanelGrid.tsx`:**
- Remove `BrowserPanel` import
- Remove browser rendering branch in panel map
- Remove browser cleanup in `handleSwitchConnection`

### App.tsx changes

- Remove browser-related entries from `switchConnectionPaletteSection`
- Remove browser cleanup in `handleLayoutChange`, `handleTabClose`, `handleTabKill`
- Add `browserPanelOpen` state with localStorage persistence
- Add `Ctrl+Shift+B` keyboard shortcut
- Add browser toggle command to palette
- Render `LeftBrowserPanel` in `.app-content` before `.app-terminal-area`

### PanelContextMenu changes

- Remove browser option from context menu

### SessionPicker changes

**`src/components/SessionPicker/SessionPicker.tsx`:**
- Remove `type: "browser"` from `ConnectionOption` entries
- Remove `optionToConnection` browser branch
- Remove `IconBrowser` component
- Remove browser-related rendering checks

### tabStore changes

**`src/store/tabStore.ts`:**
- Remove `"browser"` from the type guard at line 219: `(firstConn?.type === "note" || firstConn?.type === "browser")` → `(firstConn?.type === "note")`

### BrowserPanel component

**`src/components/BrowserPanel/`** — Delete entirely after logic is migrated to `LeftBrowserPanel`

## File Change Summary

| File | Action |
|------|--------|
| `src/components/LeftBrowserPanel/LeftBrowserPanel.tsx` | **Create** |
| `src/components/LeftBrowserPanel/LeftBrowserPanel.css` | **Create** |
| `src/types/terminal.ts` | **Edit** — remove `'browser'` type and `browserUrl` field |
| `src/App.tsx` | **Edit** — add browser panel state, shortcut, palette command, render |
| `src/App.css` | **Edit** — (if needed for layout adjustments) |
| `src/components/PanelGrid/PanelGrid.tsx` | **Edit** — remove browser rendering |
| `src/components/PanelContextMenu/PanelContextMenu.tsx` | **Edit** — remove browser option |
| `src/components/SessionPicker/SessionPicker.tsx` | **Edit** — remove browser connection option, IconBrowser, optionToConnection browser branch |
| `src/store/tabStore.ts` | **Edit** — remove `"browser"` from type guard |
| `src/components/BrowserPanel/BrowserPanel.tsx` | **Delete** |
| `src/components/BrowserPanel/BrowserPanel.css` | **Delete** |

## Migration

Add an explicit migration step in `App.tsx` (similar to the existing note migration at lines 99-135):

1. Check for a migration key: `v-terminal:migration-browser-panel-done`
2. Scan the workspace in localStorage for any `connection.type === "browser"` panels
3. Convert them to `{ type: "local" }` (removing `browserUrl` field)
4. Set the migration key to prevent re-running

This prevents stale `type: "browser"` data from persisting indefinitely in localStorage and causing unexpected behavior.

## Rust Backend

No changes needed to the Rust backend. The existing `browser_create`, `browser_destroy`, `browser_navigate`, `browser_resize`, etc. are all label-based and will work with the new `browser-left-panel` label. `browser_create` is idempotent (returns Ok if webview already exists).

## Not in scope

- Bookmarks/favorites
- Resizable panel width
- Toolbar button for toggle (keyboard + palette only)
