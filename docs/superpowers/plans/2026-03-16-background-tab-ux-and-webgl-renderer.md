# Background Tab UX & WebGL Renderer Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make "Send to Background" the default close behavior with context menu, and enable WebGL renderer for performance.

**Architecture:** Two independent features. Feature 1 modifies TabBar (swap close/kill default, add context menu, add background tray) and CommandPalette (initialQuery prop). Feature 2 adds WebGL/Canvas addons to TerminalPane with graceful fallback.

**Tech Stack:** React 18, TypeScript, xterm.js 6, @xterm/addon-webgl, @xterm/addon-canvas

---

## Chunk 1: Background Tab UX

### Task 1: Swap default close behavior (shiftHeld)

**Files:**
- Modify: `src/components/TabBar/TabBar.tsx:16-30` (ctrlHeld → shiftHeld)
- Modify: `src/components/TabBar/TabBar.tsx:131` (TabItemProps)
- Modify: `src/components/TabBar/TabBar.tsx:174-198` (click handler + icon)

- [ ] **Step 1: Replace ctrlHeld with shiftHeld state**

In `TabBar.tsx`, change the state and keyboard listeners:

```typescript
// Line 16: rename state
const [shiftHeld, setShiftHeld] = useState(false);

// Lines 18-30: change key detection
useEffect(() => {
  const down = (e: KeyboardEvent) => { if (e.key === "Shift") setShiftHeld(true); };
  const up = (e: KeyboardEvent) => { if (e.key === "Shift") setShiftHeld(false); };
  const blur = () => setShiftHeld(false);
  window.addEventListener("keydown", down);
  window.addEventListener("keyup", up);
  window.addEventListener("blur", blur);
  return () => {
    window.removeEventListener("keydown", down);
    window.removeEventListener("keyup", up);
    window.removeEventListener("blur", blur);
  };
}, []);
```

- [ ] **Step 2: Update TabItem props and usage**

In `TabBar.tsx`, update the prop name and the TabItem call:

```typescript
// Line 91: pass shiftHeld instead of ctrlHeld
<TabItem
  key={tab.id}
  id={tab.id}
  label={tab.label}
  isActive={tab.id === activeTabId}
  shiftHeld={shiftHeld}
  ...
/>

// Line 124: rename prop in interface
interface TabItemProps {
  id: string;
  label: string;
  isActive: boolean;
  shiftHeld: boolean;  // was: ctrlHeld
  ...
}

// Line 131: rename in destructure
function TabItem({ id, label, isActive, shiftHeld, onActivate, onClose, onKill, onRename }: TabItemProps) {
```

- [ ] **Step 3: Swap the click handler logic and update icon/tooltip**

In `TabBar.tsx` lines 174-198, swap `onClose` and `onKill`:

```typescript
<div className="tab-item-actions">
  <button
    className={`tab-item-btn ${shiftHeld ? "tab-item-btn--kill" : "tab-item-btn--bg"}`}
    onClick={(e) => {
      e.stopPropagation();
      if (e.shiftKey) onKill();
      else onClose();
    }}
    title={shiftHeld ? "Close Tab (Kill Session)" : "Send to Background · Shift+Click: Close Tab"}
    aria-label={shiftHeld ? "Close tab" : "Send to background"}
  >
    {shiftHeld ? (
      /* Trash icon for kill */
      <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
        <path d="M1.5 2.5h6M3 2.5V1.5h3v1M2.5 2.5l.4 5h3.2l.4-5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ) : (
      /* Down-arrow icon for background (existing design) */
      <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
        <path d="M4.5 1v5.5M2.5 4.5L4.5 6.5L6.5 4.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M1 8h7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    )}
  </button>
</div>
```

Note: The default icon changes from X to a down-arrow (background), which better communicates the "send to background" semantic. When Shift is held, the trash icon communicates "permanent delete." This deviates from the spec's "Icon stays as X" — the down-arrow is more intuitive for a default-to-background behavior. The CSS class `tab-item-btn--bg` has no explicit style rule in `TabBar.css`, but this works correctly because it inherits the base `.tab-item-btn:hover` style (non-destructive). The `tab-item-btn--kill` class has the red destructive hover from lines 120-123.

- [ ] **Step 4: Verify manually**

Run: `npm run dev` (or `pnpm dev`)
1. Click X on a tab → should send to background (check command palette Background section)
2. Hold Shift + click X → should kill session permanently
3. Tooltip should update when Shift is held/released

- [ ] **Step 5: Commit**

```bash
git add src/components/TabBar/TabBar.tsx
git commit -m "feat: swap default tab close to background, Shift+Click to kill"
```

---

### Task 2: Add tab right-click context menu

**Files:**
- Modify: `src/components/TabBar/TabBar.tsx:131-198` (add context menu inside TabItem)
- Modify: `src/components/TabBar/TabBar.css` (add context menu styles)

- [ ] **Step 1: Add context menu state and handlers to TabItem**

In `TabBar.tsx`, inside the `TabItem` function (after the existing `startEdit`/`commitEdit`/`handleKeyDown` code), add:

```typescript
// Context menu state
const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
const ctxMenuRef = useRef<HTMLDivElement>(null);

const [ctxPos, setCtxPos] = useState({ top: 0, left: 0 });

// Viewport clamping (same pattern as PanelContextMenu)
useEffect(() => {
  if (!ctxMenu || !ctxMenuRef.current) return;
  const rect = ctxMenuRef.current.getBoundingClientRect();
  let top = ctxMenu.y;
  let left = ctxMenu.x;
  if (left + rect.width > window.innerWidth - 8) {
    left = window.innerWidth - rect.width - 8;
  }
  if (top + rect.height > window.innerHeight - 8) {
    top = window.innerHeight - rect.height - 8;
  }
  setCtxPos({ top, left });
}, [ctxMenu]);

// Close on outside click or Escape
useEffect(() => {
  if (!ctxMenu) return;
  const handleClick = (e: MouseEvent) => {
    if (ctxMenuRef.current && !ctxMenuRef.current.contains(e.target as Node)) {
      setCtxMenu(null);
    }
  };
  const handleKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") setCtxMenu(null);
  };
  document.addEventListener("mousedown", handleClick);
  document.addEventListener("keydown", handleKey);
  return () => {
    document.removeEventListener("mousedown", handleClick);
    document.removeEventListener("keydown", handleKey);
  };
}, [ctxMenu]);
```

- [ ] **Step 2: Add onContextMenu handler to the tab-item div**

In `TabBar.tsx`, update the `.tab-item` div:

```typescript
<div
  className={`tab-item${isActive ? " tab-item--active" : ""}`}
  data-tab-id={id}
  onClick={onActivate}
  onDoubleClick={startEdit}
  onContextMenu={(e) => {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY });
  }}
>
```

- [ ] **Step 3: Render context menu inside TabItem (before closing div)**

Add this just before the closing `</div>` of the TabItem return:

```typescript
{ctxMenu && createPortal(
  <div
    ref={ctxMenuRef}
    className="tab-ctx-menu"
    role="menu"
    style={{ top: ctxPos.top, left: ctxPos.left }}
  >
    <button
      className="tab-ctx-item"
      role="menuitem"
      onClick={(e) => { e.stopPropagation(); onClose(); setCtxMenu(null); }}
    >
      <span className="tab-ctx-item-icon">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M7 3v6M4.5 6.5L7 9L9.5 6.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M2 12h10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      </span>
      <span className="tab-ctx-item-label">Send to Background</span>
    </button>
    <button
      className="tab-ctx-item tab-ctx-item--destructive"
      role="menuitem"
      onClick={(e) => { e.stopPropagation(); onKill(); setCtxMenu(null); }}
    >
      <span className="tab-ctx-item-icon">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      </span>
      <span className="tab-ctx-item-label">Close Tab</span>
    </button>
    <div className="tab-ctx-divider" />
    <button
      className="tab-ctx-item"
      role="menuitem"
      onClick={(e) => { e.stopPropagation(); startEdit(); setCtxMenu(null); }}
    >
      <span className="tab-ctx-item-icon">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M8.5 2.5l3 3-7.5 7.5H1v-3l7.5-7.5z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span className="tab-ctx-item-label">Rename Tab</span>
    </button>
  </div>,
  document.body
)}
```

Add `createPortal` to the imports at top of file:

```typescript
import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
```

- [ ] **Step 4: Add context menu CSS to TabBar.css**

Append to `src/components/TabBar/TabBar.css`:

```css
/* ── Tab Context Menu ──────────────────────────────────────── */
.tab-ctx-menu {
  position: fixed;
  min-width: 180px;
  background: var(--bg-elevated);
  border: 1px solid var(--separator-strong);
  border-radius: var(--radius-lg);
  padding: 6px;
  box-shadow: var(--shadow-md);
  backdrop-filter: blur(24px) saturate(160%);
  -webkit-backdrop-filter: blur(24px) saturate(160%);
  z-index: 1100;
  animation: tab-ctx-in 0.12s ease-out;
}

@keyframes tab-ctx-in {
  from { opacity: 0; transform: scale(0.97); }
  to   { opacity: 1; transform: scale(1); }
}

.tab-ctx-item {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  padding: 7px 10px;
  border: none;
  border-radius: 7px;
  background: transparent;
  color: var(--label-secondary);
  font-size: 13px;
  cursor: pointer;
  transition: background 0.1s, color 0.1s;
  text-align: left;
  font-family: inherit;
}

.tab-ctx-item:hover {
  background: var(--bg-tertiary);
  color: var(--label-primary);
}

.tab-ctx-item--destructive:hover {
  background: color-mix(in srgb, var(--destructive) 15%, transparent);
  color: var(--destructive);
}

.tab-ctx-item-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

.tab-ctx-item-label {
  flex: 1;
}

.tab-ctx-divider {
  height: 1px;
  background: var(--separator);
  margin: 3px 8px;
}
```

- [ ] **Step 5: Verify manually**

1. Right-click a tab → context menu appears with 3 items
2. "Send to Background" → tab goes to background
3. "Close Tab" → tab killed permanently
4. "Rename Tab" → triggers inline rename input
5. Click outside or press Escape → menu closes
6. Context menu doesn't overflow viewport edges

- [ ] **Step 6: Commit**

```bash
git add src/components/TabBar/TabBar.tsx src/components/TabBar/TabBar.css
git commit -m "feat: add tab right-click context menu with background, close, rename"
```

---

### Task 3: Add background tray indicator

**Files:**
- Modify: `src/components/TabBar/TabBar.tsx:11-12` (add tabStore access for savedTabs)
- Modify: `src/components/TabBar/TabBar.tsx:71-117` (add tray before closing div)
- Modify: `src/components/TabBar/TabBar.tsx:5-9` (add onOpenPalette prop)
- Modify: `src/components/TabBar/TabBar.css` (add tray styles)

- [ ] **Step 1: Add onOpenPalette prop to TabBar**

```typescript
interface TabBarProps {
  onCloseTab?: (tabId: string) => void;
  onKillTab?: (tabId: string) => void;
  onActivateTab?: (tabId: string) => void;
  onOpenPalette?: () => void;  // NEW
}

export function TabBar({ onCloseTab, onKillTab, onActivateTab, onOpenPalette }: TabBarProps) {
```

- [ ] **Step 2: Read savedTabs from tabStore**

At the top of the TabBar function, add `savedTabs` to the destructured store:

```typescript
const { tabs, activeTabId, savedTabs, removeTab, setActiveTab, renameTab } = useTabStore();
```

- [ ] **Step 3: Add tray indicator in the TabBar JSX**

Insert between the scroll buttons container and the closing `</div>` of `.tabbar`, right after `{canScrollRight && (...)}`:

```typescript
{savedTabs.length > 0 && (
  <button
    className="tabbar-bg-tray"
    onClick={() => onOpenPalette?.()}
    title={`${savedTabs.length} background tab${savedTabs.length > 1 ? "s" : ""}`}
    aria-label={`${savedTabs.length} background tabs`}
  >
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
      <path d="M5 1.5v5M3 4.5L5 6.5L7 4.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M1 8.5h8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
    <span className="tabbar-bg-tray-count">{savedTabs.length}</span>
  </button>
)}
```

- [ ] **Step 4: Add tray CSS to TabBar.css**

Append to `TabBar.css`:

```css
/* ── Background Tray Indicator ────────────────────────────── */
.tabbar-bg-tray {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 4px;
  height: 22px;
  padding: 0 8px;
  margin-left: 2px;
  border: none;
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  color: var(--accent);
  font-size: 11px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
}

.tabbar-bg-tray:hover {
  background: color-mix(in srgb, var(--accent) 20%, transparent);
}

.tabbar-bg-tray:active {
  opacity: 0.7;
}

.tabbar-bg-tray-count {
  line-height: 1;
}
```

- [ ] **Step 5: Pass onOpenPalette from App.tsx**

In `src/App.tsx`, update the TabBar usage (around line 949):

```typescript
<TabBar
  onCloseTab={handleTabClose}
  onKillTab={handleTabKill}
  onActivateTab={activateTab}
  onOpenPalette={() => setPaletteOpen(true)}
/>
```

- [ ] **Step 6: Verify manually**

1. Background a tab → tray appears with count "1"
2. Background another tab → count updates to "2"
3. Click tray → command palette opens, Background section is visible
4. Restore all background tabs → tray disappears
5. Tray styling matches the design system (accent color pill)

- [ ] **Step 7: Commit**

```bash
git add src/components/TabBar/TabBar.tsx src/components/TabBar/TabBar.css src/App.tsx
git commit -m "feat: add background tray indicator in tab bar"
```

---

### Task 3.5: Add initialQuery prop to CommandPalette

**Files:**
- Modify: `src/components/CommandPalette/CommandPalette.tsx:34-39` (add initialQuery prop)
- Modify: `src/components/CommandPalette/CommandPalette.tsx:186-192` (use initialQuery on open)
- Modify: `src/App.tsx:1020-1033` (pass initialQuery prop)

This task enables future callers to pre-fill the command palette query when opening it. Currently unused by the tray (which opens with empty query to show the Background section), but provides the extensibility the spec requires.

- [ ] **Step 1: Add initialQuery prop to CommandPalette**

In `CommandPalette.tsx`, update the Props interface (line 34):

```typescript
interface Props {
  isOpen: boolean;
  onClose: () => void;
  extraSections?: PaletteSection[];
  onQueryChange?: (query: string) => void;
  initialQuery?: string;  // NEW: seed the query when opening
}
```

Update the destructure (line 119):

```typescript
export function CommandPalette({ isOpen, onClose, extraSections = [], onQueryChange, initialQuery = "" }: Props) {
```

- [ ] **Step 2: Use initialQuery when opening**

In `CommandPalette.tsx`, update the open effect (line 190):

```typescript
// Change: setQuery("") → setQuery(initialQuery)
useEffect(() => {
  if (isOpen) {
    setVisible(true);
    setPhase("in");
    setQuery(initialQuery);
    setActiveIndex(0);
    onQueryChange?.(initialQuery);
  } else if (visible) {
    setPhase("out");
    const timer = setTimeout(() => {
      setVisible(false);
      setPhase(null);
    }, 120);
    return () => clearTimeout(timer);
  }
}, [isOpen]);
```

- [ ] **Step 3: Verify manually**

1. Press Ctrl+K → palette opens with empty query, shows all sections including Background
2. Click background tray → same behavior (empty query)
3. All existing palette behavior unchanged

- [ ] **Step 4: Commit**

```bash
git add src/components/CommandPalette/CommandPalette.tsx
git commit -m "feat: add initialQuery prop to CommandPalette"
```

---

## Chunk 2: WebGL Renderer

### Task 4: Install WebGL and Canvas addon packages

**Files:**
- Modify: `package.json` (add dependencies)

- [ ] **Step 1: Install packages**

The project uses pnpm (pnpm-lock.yaml exists). Run:

```bash
pnpm add @xterm/addon-webgl @xterm/addon-canvas
```

Verify the installed versions are compatible with `@xterm/xterm@^6.0.0` by checking no errors during install.

- [ ] **Step 2: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "deps: add @xterm/addon-webgl and @xterm/addon-canvas"
```

---

### Task 5: Add WebGL → Canvas → DOM fallback in TerminalPane

**Files:**
- Modify: `src/components/TerminalPane/TerminalPane.tsx:1-4` (add imports)
- Modify: `src/components/TerminalPane/TerminalPane.tsx:138-139` (add renderer after open + fit)

- [ ] **Step 1: Add imports for WebGL and Canvas addons**

At the top of `TerminalPane.tsx`, add after the existing addon imports (line 3-4):

```typescript
import { WebglAddon } from "@xterm/addon-webgl";
import { CanvasAddon } from "@xterm/addon-canvas";
```

- [ ] **Step 2: Add renderer fallback chain after term.open() and fitAddon.fit()**

In `TerminalPane.tsx`, after line 139 (`fitAddon.fit();`), add:

```typescript
// Renderer: WebGL → Canvas → DOM fallback
try {
  const webglAddon = new WebglAddon();
  webglAddon.onContextLost(() => {
    webglAddon.dispose();
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

- [ ] **Step 3: Verify manually**

Run: `npm run dev`
1. Open a new terminal panel → should render normally
2. Inspect the terminal element in DevTools: look for a `<canvas>` element inside `.xterm-screen` (WebGL) instead of rows of `<span>` elements (DOM)
3. Test with all bundled themes — no visual regressions in text, cursor, selection
4. Test 9-panel layout — all panels should render without errors
5. Test large output: `seq 1 100000` or similar — should be smooth

- [ ] **Step 4: Commit**

```bash
git add src/components/TerminalPane/TerminalPane.tsx
git commit -m "perf: enable WebGL renderer with Canvas/DOM fallback"
```

---

## Final Verification

- [ ] **Full integration test**

1. Start app fresh
2. Open 3 tabs, each with different layouts (1, 4, 9 panels)
3. X-click a tab → goes to background, tray shows count
4. Shift+Click a tab → killed permanently, no tray increment
5. Right-click a tab → context menu shows 3 options, all work
6. Click tray → palette opens with Background section
7. Restore a background tab → tray count decrements
8. All terminals render via WebGL (check canvas in DevTools)
9. Switch themes → all panels update correctly

- [ ] **Final commit (if any cleanup needed)**

```bash
git add -A
git commit -m "chore: final cleanup for background tab UX and WebGL renderer"
```
