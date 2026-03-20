# Background Tab UX Improvement & WebGL Renderer

## Overview

Two Phase 1 improvements:
1. Make "Send to Background" discoverable by changing default close behavior and adding context menu
2. Enable WebGL renderer with graceful fallback for performance improvement

---

## Feature 1: Background Tab UX

### Problem

Current close button behavior is hidden behind a Ctrl+Click modifier. Users have no way to discover that backgrounding exists unless they read the tooltip carefully. This results in users accidentally killing sessions they meant to preserve.

Note: This is an intentional breaking UX change. The Ctrl+Click pattern was effectively undiscoverable, so the migration cost is minimal — very few users will have learned the old behavior.

### Design

**A. Default close behavior → Background (safe default)**

- X button click (no modifier): calls `onClose()` → `saveAndRemoveTab()` — sends tab to background
- Shift+Click on X button: calls `onKill()` → `removeTab()` — kills session permanently
- Tooltip updated: "Send to Background · Shift+Click: Close Tab"
- Icon changes to a down-arrow (background semantic) in default state, changes to a trash icon when Shift is held

The callback names `onClose` and `onKill` already have the correct semantic meaning in App.tsx (`onCloseTab` → `saveAndRemoveTab`, `onKillTab` → kills PTY). The current TabBar.tsx has them inverted at the call site (default calls `onKill`, Ctrl calls `onClose`). The fix is swapping which callback is called in the default vs. modifier case.

**B. Tab right-click context menu**

New context menu appears on right-click of any tab:
- "Send to Background" — calls `saveAndRemoveTab()`
- "Close Tab" — calls `removeTab()`
- Divider
- "Rename Tab" — triggers rename flow

The context menu is rendered inside `TabItem` component so it has direct access to the local `startEdit()` function for rename. This avoids lifting editing state or adding refs. The context menu follows the existing design system (same styling as PanelContextMenu).

Context menu state: `TabItem` manages `contextMenuOpen` and `contextMenuPosition` as local state. A `useEffect` closes the menu on outside click or Escape key, same pattern as PanelContextMenu.

**C. Background Tray indicator**

Add a small indicator in the TabBar showing the count of backgrounded tabs:
- Positioned at the right end of the tab bar, before the "+" new tab button
- Shows a down-arrow icon + count badge (e.g., "↓3")
- Click behavior: opens the command palette with the query field pre-filled as empty string, which already shows the "Background" section with all saved tabs in the existing `extraSections` logic. To implement this, add an `initialQuery` prop to CommandPalette and a `onOpenPalette(initialQuery?: string)` callback from TabBar to App.
- Hidden when savedTabs count is 0

**Keyboard accessibility:** The existing command palette already has "Send Current Tab to Background" command. No additional keyboard shortcut is needed — the context menu and command palette cover all interaction modes.

### Implementation Details

**TabBar.tsx changes:**
- Replace `ctrlHeld` state with `shiftHeld` state (same keyboard listener pattern)
- Swap click handler: default click → `onClose()` (background), Shift+Click → `onKill()` (kill)
- Add `onContextMenu` handler on `.tab-item` elements → sets `contextMenuOpen` + position
- Render context menu inline within `TabItem` (3 items: background, close, rename)
- Add background tray indicator before the new-tab button, reading `savedTabs.length` from tabStore
- Add `onOpenPalette` prop to TabBar/TabBarProps for tray indicator click

**TabBar.css changes:**
- Context menu styles (reuse pattern from PanelContextMenu)
- Background tray indicator styles (small pill with icon + count)
- Shift-held trash icon styles

**App.tsx changes:**
- Pass `onOpenPalette` callback to TabBar that sets CommandPalette open state
- Add `initialQuery` prop to CommandPalette (default: empty string)

**CommandPalette.tsx changes:**
- Accept optional `initialQuery` prop, use it to seed the query state when opening

### Acceptance Criteria

- X button click backgrounds the tab and tray count increments
- Shift+Click kills the session without backgrounding
- Right-click on tab shows context menu with 3 options
- "Rename Tab" in context menu triggers inline rename
- Background tray shows count, click opens command palette with background tabs visible
- Tray is hidden when no background tabs exist

---

## Feature 2: WebGL Renderer

### Problem

Currently using the default DOM renderer which is the slowest option in xterm.js. Performance degrades with large output volumes and multiple panels.

### Design

Install `@xterm/addon-webgl` and `@xterm/addon-canvas` for a graceful fallback chain:

```
WebGL → Canvas → DOM (current default)
```

### Implementation Details

**Package installation:**
- `@xterm/addon-webgl` — GPU-accelerated renderer (use version compatible with `@xterm/xterm@^6.0.0`)
- `@xterm/addon-canvas` — Canvas 2D fallback (faster than DOM, no GPU dependency)

**TerminalPane.tsx changes:**

After `term.open(containerRef.current)` and `fitAddon.fit()`, attempt to load renderers:

```typescript
try {
  const webglAddon = new WebglAddon();
  webglAddon.onContextLost(() => {
    webglAddon.dispose();
    // Fall back to canvas
    try {
      term.loadAddon(new CanvasAddon());
    } catch {
      // DOM renderer remains as final fallback
    }
  });
  term.loadAddon(webglAddon);
} catch {
  try {
    term.loadAddon(new CanvasAddon());
  } catch {
    // DOM renderer remains as final fallback
  }
}
```

**WebGL context limit & multi-tab strategy:**
- Browsers typically allow 8-16 WebGL contexts
- A user with multiple tabs (e.g., 2 tabs × 9 panels = 18 terminals) may exceed the limit
- Mitigation: rely on `onContextLost` callback as the primary safety net. When the browser reclaims a context (e.g., for an inactive tab's panel), the handler falls back to Canvas automatically
- No proactive dispose-on-tab-switch needed — the `onContextLost` fallback is sufficient and simpler to maintain
- `term.dispose()` in the existing cleanup function cascades to all loaded addons, properly releasing WebGL contexts when panels are removed

### Risks

- Low risk: WebGL is well-supported in Chromium-based webviews (Tauri uses WebView2 on Windows)
- The fallback chain ensures zero regression — worst case, behavior is identical to current (DOM renderer)
- `allowTransparency: false` is already set, which avoids the known WebGL transparency issues

### Acceptance Criteria

- Fresh terminal panel loads with WebGL renderer active (verify: panel canvas element exists in DOM instead of rows of span elements)
- If WebGL fails (e.g., context lost), panel automatically falls back to Canvas without user intervention
- No visual regressions in text rendering, cursor, or selection across all bundled themes
- 9-panel layout renders without errors

---

## Out of Scope

- Background tab auto-cleanup / garbage collection (separate Phase 1 item)
- Session health dashboard (separate Phase 1 item)
- Renderer performance benchmarking UI
