# Browser Left Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the browser from a PanelConnection type embedded in PanelGrid to an independent 600px left-side panel with keep-alive webview, home button, and toggle via Ctrl+Shift+B / command palette.

**Architecture:** Create a new `LeftBrowserPanel` component rendered in `App.tsx`'s `.app-content` div before the terminal area. Remove `'browser'` from PanelConnection type and all browser-related code from PanelGrid, PanelContextMenu, SessionPicker, and App.tsx's connection switching. Add localStorage migration for existing browser panels.

**Tech Stack:** React, TypeScript, Tauri WebView2 IPC, Zustand (browserConfigStore), CSS custom properties

**Spec:** `docs/superpowers/specs/2026-03-20-browser-left-panel-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/components/LeftBrowserPanel/LeftBrowserPanel.tsx` | Create | Browser left panel component with header, toolbar (back/forward/reload/home/URL), webview placeholder, keep-alive lifecycle |
| `src/components/LeftBrowserPanel/LeftBrowserPanel.css` | Create | 600px panel styling matching Apple HIG, header, toolbar, content area |
| `src/types/terminal.ts` | Edit | Remove `'browser'` from PanelConnection type union and `browserUrl` field |
| `src/store/tabStore.ts` | Edit | Remove `"browser"` from type guard at line 219 |
| `src/components/PanelGrid/PanelGrid.tsx` | Edit | Remove BrowserPanel import, browser rendering branch, browser cleanup |
| `src/components/PanelContextMenu/PanelContextMenu.tsx` | Edit | Remove browser option from context menu |
| `src/components/SessionPicker/SessionPicker.tsx` | Edit | Remove browser ConnectionOption, IconBrowser, optionToConnection browser branch, browser icon rendering |
| `src/App.tsx` | Edit | Add browser panel state/toggle/shortcut/palette command, render LeftBrowserPanel, add migration, remove browser from switchConnectionPaletteSection and cleanup handlers |
| `src/components/BrowserPanel/BrowserPanel.tsx` | Delete | Replaced by LeftBrowserPanel |
| `src/components/BrowserPanel/BrowserPanel.css` | Delete | Replaced by LeftBrowserPanel CSS |

---

### Task 1: Remove browser from PanelConnection type and tabStore

**Files:**
- Modify: `src/types/terminal.ts:29-37`
- Modify: `src/store/tabStore.ts:219`

- [ ] **Step 1: Edit terminal.ts — remove 'browser' type and browserUrl field**

In `src/types/terminal.ts`, change the `PanelConnection` interface:

```typescript
// Before (lines 29-37):
export interface PanelConnection {
  type: 'local' | 'ssh' | 'wsl' | 'note' | 'browser';
  sshProfileId?: string;
  shellProgram?: string;
  shellArgs?: string[];
  wslDistro?: string;
  label?: string;
  browserUrl?: string;
}

// After:
export interface PanelConnection {
  type: 'local' | 'ssh' | 'wsl' | 'note';
  sshProfileId?: string;
  shellProgram?: string;
  shellArgs?: string[];
  wslDistro?: string;
  label?: string;
}
```

- [ ] **Step 2: Edit tabStore.ts — remove browser from type guard**

In `src/store/tabStore.ts` line 219, change:

```typescript
// Before:
const baseConnection = (firstConn?.type === "note" || firstConn?.type === "browser") ? undefined : firstConn;

// After:
const baseConnection = (firstConn?.type === "note") ? undefined : firstConn;
```

- [ ] **Step 3: Verify TypeScript compiles (expect errors in files not yet updated)**

Run: `cd /Users/handongho/.openclaw/workspace/projects/v-terminal && npx tsc --noEmit 2>&1 | head -50`

Expected: TypeScript errors in PanelGrid, PanelContextMenu, SessionPicker, App.tsx referencing `"browser"` — these will be fixed in subsequent tasks.

- [ ] **Step 4: Commit**

```bash
git add src/types/terminal.ts src/store/tabStore.ts
git commit -m "refactor: remove 'browser' from PanelConnection type"
```

---

### Task 2: Remove browser from PanelGrid

**Files:**
- Modify: `src/components/PanelGrid/PanelGrid.tsx`

- [ ] **Step 1: Remove BrowserPanel import**

In `src/components/PanelGrid/PanelGrid.tsx`, remove line 5:

```typescript
// DELETE this line:
import { BrowserPanel } from "../BrowserPanel/BrowserPanel";
```

- [ ] **Step 2: Remove browser cleanup in handleSwitchConnection**

In the `handleSwitchConnection` callback (lines 59-76), remove the browser webview cleanup block (lines 64-67):

```typescript
// DELETE these lines:
      // Clean up browser webview if switching away from browser panel
      if (currentPanel?.connection?.type === "browser") {
        ipc.browserDestroy(`browser-${ctxMenu.panelId}`).catch(() => {});
      }
```

- [ ] **Step 3: Remove browser rendering branch in panel map**

In the panel rendering section (lines 190-199), remove the entire browser branch:

```typescript
// DELETE this block (lines 190-199):
            ) : panel.connection?.type === "browser" ? (
              <BrowserPanel
                panelId={panel.id}
                tabId={tab.id}
                browserUrl={panel.connection.browserUrl}
                isActive={panel.id === activePanelId}
                isVisible={isVisible && !hidden && !overlayActive && !ctxMenu}
                onFocus={() => setActivePanelId(panel.id)}
                onContextMenu={(e) => handleContextMenu(e, panel.id, panel.connection)}
              />
```

The conditional should now be:
```typescript
            {panel.connection?.type === "note" ? (
              <NotePanel ... />
            ) : (
              <TerminalPane ... />
            )}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/PanelGrid/PanelGrid.tsx
git commit -m "refactor: remove browser rendering from PanelGrid"
```

---

### Task 3: Remove browser from PanelContextMenu

**Files:**
- Modify: `src/components/PanelContextMenu/PanelContextMenu.tsx`

- [ ] **Step 1: Remove the entire Browser section**

In `src/components/PanelContextMenu/PanelContextMenu.tsx`, remove lines 176-196 (the Browser section including divider):

```tsx
// DELETE this entire block:
      {/* Browser */}
      <div className="panel-ctx-divider" />
      {(() => {
        const isActiveBrowser = connType === "browser";
        return (
          <button
            className={`panel-ctx-item${isActiveBrowser ? " panel-ctx-item--active" : ""}`}
            onClick={() => !isActiveBrowser && handleClick({ type: "browser" })}
            role="menuitem"
          >
            <svg className="panel-ctx-item-icon" width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.2" />
              <ellipse cx="7" cy="7" rx="2.5" ry="5.5" stroke="currentColor" strokeWidth="1" />
              <line x1="1.5" y1="7" x2="12.5" y2="7" stroke="currentColor" strokeWidth="1" />
            </svg>
            <span className="panel-ctx-item-label">Browser</span>
            <span className="panel-ctx-item-meta">Web</span>
            {isActiveBrowser && checkIcon}
          </button>
        );
      })()}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/PanelContextMenu/PanelContextMenu.tsx
git commit -m "refactor: remove browser option from PanelContextMenu"
```

---

### Task 4: Remove browser from SessionPicker

**Files:**
- Modify: `src/components/SessionPicker/SessionPicker.tsx`

- [ ] **Step 1: Remove 'browser' from ConnectionOption type**

In `src/components/SessionPicker/SessionPicker.tsx` line 23, change:

```typescript
// Before:
  type: "local" | "ssh" | "wsl" | "note" | "browser";

// After:
  type: "local" | "ssh" | "wsl" | "note";
```

- [ ] **Step 2: Remove browser branch from optionToConnection**

Remove lines 36-38:

```typescript
// DELETE:
  if (opt.type === "browser") {
    return { type: "browser" };
  }
```

- [ ] **Step 3: Remove IconBrowser component**

Delete lines 85-91:

```typescript
// DELETE:
const IconBrowser = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.25" />
    <ellipse cx="8" cy="8" rx="3" ry="6" stroke="currentColor" strokeWidth="1.1" />
    <line x1="2" y1="8" x2="14" y2="8" stroke="currentColor" strokeWidth="1.1" />
  </svg>
);
```

- [ ] **Step 4: Remove browser entry from connectionOptions**

Remove lines 353-358:

```typescript
// DELETE:
    opts.push({
      id: "browser",
      type: "browser" as const,
      name: "Browser",
      subtitle: "Web browser",
    });
```

- [ ] **Step 5: Remove browser icon rendering branch**

In the icon rendering block (lines 483-486), remove the browser branch:

```tsx
// DELETE:
                    ) : opt.type === "browser" ? (
                      <IconBrowser />
```

The resulting chain should be:
```tsx
                    {opt.type === "ssh" ? (
                      <IconSsh />
                    ) : opt.type === "wsl" ? (
                      <IconLinux />
                    ) : opt.type === "note" ? (
                      <IconNote />
                    ) : (
                      <IconTerminal />
                    )}
```

- [ ] **Step 6: Remove browser CSS from SessionPicker.css**

In `src/components/SessionPicker/SessionPicker.css`, remove the two browser-specific CSS rules:

```css
/* DELETE: */
.sp-row-icon--browser {
  /* ... whatever content ... */
}

/* DELETE: */
.sp-dot--browser { background: #3b82f6; }
```

- [ ] **Step 7: Commit**

```bash
git add src/components/SessionPicker/SessionPicker.tsx src/components/SessionPicker/SessionPicker.css
git commit -m "refactor: remove browser option from SessionPicker"
```

---

### Task 5: Create LeftBrowserPanel component

**Files:**
- Create: `src/components/LeftBrowserPanel/LeftBrowserPanel.tsx`
- Create: `src/components/LeftBrowserPanel/LeftBrowserPanel.css`

- [ ] **Step 1: Create LeftBrowserPanel.css**

Create `src/components/LeftBrowserPanel/LeftBrowserPanel.css`:

```css
/* ══════════════════════════════════════════════════════════════════
   LeftBrowserPanel — 600px left sidebar with embedded browser
   ══════════════════════════════════════════════════════════════════ */

/* ── Panel container ────────────────────────────────────────────── */
.left-browser-panel {
  width: 600px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--separator);
  background: var(--bg-secondary);
  overflow: hidden;
}

.left-browser-panel--hidden {
  display: none;
}

/* ── Header ─────────────────────────────────────────────────────── */
.left-browser-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 10px;
  height: 36px;
  border-bottom: 1px solid var(--separator);
  flex-shrink: 0;
}

.left-browser-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--label-secondary);
  letter-spacing: 0.03em;
  font-family: "Pretendard", -apple-system, sans-serif;
  user-select: none;
}

.left-browser-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: none;
  background: none;
  cursor: pointer;
  border-radius: var(--radius-xs);
  color: var(--label-tertiary);
  padding: 0;
  transition: color 0.12s, background 0.12s;
  flex-shrink: 0;
}

.left-browser-close:hover {
  color: var(--label-primary);
  background: var(--bg-tertiary);
}

/* ── Toolbar ────────────────────────────────────────────────────── */
.left-browser-toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 8px;
  height: 40px;
  min-height: 40px;
  background: var(--toolbar-bg, rgba(255, 255, 255, 0.06));
  border-bottom: 1px solid var(--border, rgba(255, 255, 255, 0.08));
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  cursor: default;
  user-select: none;
}

.left-browser-nav-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-secondary, #999);
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.1s ease, color 0.1s ease;
}

.left-browser-nav-btn:hover {
  background: var(--hover-bg, rgba(255, 255, 255, 0.08));
  color: var(--text-primary, #fff);
}

.left-browser-nav-btn:active {
  background: var(--hover-bg-strong, rgba(255, 255, 255, 0.12));
}

.left-browser-url-form {
  flex: 1;
  min-width: 0;
}

.left-browser-url-input {
  width: 100%;
  height: 28px;
  padding: 0 10px;
  border: 1px solid var(--border, rgba(255, 255, 255, 0.1));
  border-radius: 6px;
  background: var(--input-bg, rgba(0, 0, 0, 0.2));
  color: var(--text-primary, #fff);
  font-family: "Pretendard", -apple-system, sans-serif;
  font-size: 12px;
  outline: none;
  transition: border-color 0.15s ease;
}

.left-browser-url-input:focus {
  border-color: var(--accent, #007aff);
}

.left-browser-url-input::placeholder {
  color: var(--text-tertiary, #666);
}

/* ── Content area ───────────────────────────────────────────────── */
.left-browser-content {
  flex: 1;
  position: relative;
  min-height: 0;
}

/* ── Error state ────────────────────────────────────────────────── */
.left-browser-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 12px;
  color: var(--text-secondary, #999);
}

.left-browser-error-msg {
  font-size: 12px;
  max-width: 300px;
  text-align: center;
  word-break: break-word;
}

.left-browser-retry-btn {
  padding: 6px 16px;
  border: 1px solid var(--border, rgba(255, 255, 255, 0.15));
  border-radius: 6px;
  background: var(--hover-bg, rgba(255, 255, 255, 0.06));
  color: var(--text-primary, #fff);
  font-size: 12px;
  cursor: pointer;
  transition: background 0.1s ease;
}

.left-browser-retry-btn:hover {
  background: var(--hover-bg-strong, rgba(255, 255, 255, 0.1));
}
```

- [ ] **Step 2: Create LeftBrowserPanel.tsx**

Create `src/components/LeftBrowserPanel/LeftBrowserPanel.tsx`:

**IMPORTANT: Keep-alive strategy** — This component is always mounted in App.tsx (never conditionally rendered). The webview is created lazily on first `isVisible=true` and never destroyed. When the panel is closed, the outer div gets `display: none` and the webview is hidden via `browserResize(0,0,0,0)`.

```tsx
import { useState, useRef, useEffect, useCallback } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { ipc } from "../../lib/tauriIpc";
import { useBrowserConfigStore } from "../../store/browserConfigStore";
import "./LeftBrowserPanel.css";

const WEBVIEW_LABEL = "browser-left-panel";
const URL_STORAGE_KEY = "v-terminal:browser-panel-url";

interface LeftBrowserPanelProps {
  isVisible: boolean;
  overlayActive: boolean;
  onClose: () => void;
}

interface BrowserUrlPayload {
  label: string;
  url: string;
}

export function LeftBrowserPanel({ isVisible, overlayActive, onClose }: LeftBrowserPanelProps) {
  const placeholderRef = useRef<HTMLDivElement>(null);
  const [url, setUrl] = useState(() => localStorage.getItem(URL_STORAGE_KEY) ?? "");
  const [inputValue, setInputValue] = useState(() => localStorage.getItem(URL_STORAGE_KEY) ?? "");
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState(false);
  const urlRef = useRef(url);
  urlRef.current = url;
  const createdRef = useRef(false);
  const isVisibleRef = useRef(isVisible);
  isVisibleRef.current = isVisible;

  const getStartUrl = useBrowserConfigStore((s) => s.getStartUrl);

  // Persist URL changes to localStorage
  const persistUrl = useCallback((newUrl: string) => {
    try {
      localStorage.setItem(URL_STORAGE_KEY, newUrl);
    } catch {}
  }, []);

  // Lazy-create webview on first isVisible=true (keep-alive: never destroyed)
  useEffect(() => {
    if (!isVisible || createdRef.current) return;

    const el = placeholderRef.current;
    if (!el) return;

    const startUrl = localStorage.getItem(URL_STORAGE_KEY) || getStartUrl();
    const rect = el.getBoundingClientRect();

    ipc.browserCreate(
      WEBVIEW_LABEL,
      startUrl,
      rect.left,
      rect.top,
      rect.width,
      rect.height,
    ).then(() => {
      setCreated(true);
      createdRef.current = true;
      setError(null);
      setUrl(startUrl);
      setInputValue(startUrl === "about:blank" ? "" : startUrl);
      persistUrl(startUrl);
    }).catch((err) => {
      setError(String(err));
    });
  }, [isVisible]); // eslint-disable-line react-hooks/exhaustive-deps

  // Listen for URL changes from the webview
  useEffect(() => {
    let unlisten: UnlistenFn | null = null;

    listen<BrowserUrlPayload>("browser-url-changed", (event) => {
      if (event.payload.label !== WEBVIEW_LABEL) return;
      const newUrl = event.payload.url;
      if (newUrl !== urlRef.current) {
        setUrl(newUrl);
        setInputValue(newUrl === "about:blank" ? "" : newUrl);
        persistUrl(newUrl);
      }
    }).then((fn) => { unlisten = fn; });

    return () => { unlisten?.(); };
  }, [persistUrl]);

  // Sync webview bounds: show when visible, hide (0,0,0,0) when not
  const shouldShow = isVisible && !overlayActive;

  useEffect(() => {
    const el = placeholderRef.current;
    if (!el || !createdRef.current) return;

    let throttleTimer: ReturnType<typeof setTimeout> | null = null;

    const syncBounds = () => {
      if (!createdRef.current) return;
      if (!shouldShow) {
        ipc.browserResize(WEBVIEW_LABEL, 0, 0, 0, 0).catch(() => {});
      } else {
        const rect = el.getBoundingClientRect();
        ipc.browserResize(WEBVIEW_LABEL, rect.left, rect.top, rect.width, rect.height).catch(() => {});
      }
    };

    const throttledSync = () => {
      if (throttleTimer) return;
      throttleTimer = setTimeout(() => {
        throttleTimer = null;
        syncBounds();
      }, 50);
    };

    const observer = new ResizeObserver(throttledSync);
    observer.observe(el);

    window.addEventListener("resize", throttledSync);

    // Initial sync
    syncBounds();

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", throttledSync);
      if (throttleTimer) clearTimeout(throttleTimer);
    };
  }, [shouldShow]);

  // Navigation handlers
  const handleNavigate = useCallback((targetUrl: string) => {
    const trimmed = targetUrl.trim();
    if (!trimmed) return;
    ipc.browserNavigate(WEBVIEW_LABEL, trimmed).catch(() => {});
  }, []);

  const handleUrlSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    handleNavigate(inputValue);
  }, [inputValue, handleNavigate]);

  const handleBack = useCallback(() => {
    ipc.browserGoBack(WEBVIEW_LABEL).catch(() => {});
  }, []);

  const handleForward = useCallback(() => {
    ipc.browserGoForward(WEBVIEW_LABEL).catch(() => {});
  }, []);

  const handleReload = useCallback(() => {
    ipc.browserReload(WEBVIEW_LABEL).catch(() => {});
  }, []);

  const handleHome = useCallback(() => {
    const homeUrl = getStartUrl();
    ipc.browserNavigate(WEBVIEW_LABEL, homeUrl).catch(() => {});
    setInputValue(homeUrl);
  }, [getStartUrl]);

  const handleRetry = useCallback(() => {
    setError(null);
    const el = placeholderRef.current;
    if (!el) return;
    const startUrl = localStorage.getItem(URL_STORAGE_KEY) || getStartUrl();
    const rect = el.getBoundingClientRect();
    ipc.browserCreate(WEBVIEW_LABEL, startUrl, rect.left, rect.top, rect.width, rect.height)
      .then(() => {
        setCreated(true);
        createdRef.current = true;
      })
      .catch((err) => setError(String(err)));
  }, [getStartUrl]);

  return (
    <div className={`left-browser-panel${isVisible ? "" : " left-browser-panel--hidden"}`}>
      {/* Header */}
      <div className="left-browser-header">
        <span className="left-browser-title">Browser</span>
        <button
          className="left-browser-close"
          onClick={onClose}
          aria-label="Close browser panel"
          title="Close browser panel"
        >
          <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
            <path d="M1.5 1.5l6 6M7.5 1.5l-6 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Toolbar */}
      <div className="left-browser-toolbar">
        <button className="left-browser-nav-btn" onClick={handleBack} title="Back">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 2.5L4.5 7 9 11.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button className="left-browser-nav-btn" onClick={handleForward} title="Forward">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M5 2.5L9.5 7 5 11.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button className="left-browser-nav-btn" onClick={handleReload} title="Reload">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2.5 7a4.5 4.5 0 1 1 1 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            <path d="M2.5 11.5V7H6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button className="left-browser-nav-btn" onClick={handleHome} title="Home">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2.5 7L7 2.5L11.5 7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M4 6v5.5h2.25V9h1.5v2.5H10V6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <form className="left-browser-url-form" onSubmit={handleUrlSubmit}>
          <input
            className="left-browser-url-input"
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Enter URL..."
            spellCheck={false}
            autoComplete="off"
          />
        </form>
      </div>

      {/* Webview placeholder */}
      <div ref={placeholderRef} className="left-browser-content">
        {error && !created && (
          <div className="left-browser-error">
            <p className="left-browser-error-msg">{error}</p>
            <button className="left-browser-retry-btn" onClick={handleRetry}>
              Retry
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/LeftBrowserPanel/
git commit -m "feat: create LeftBrowserPanel component with keep-alive webview"
```

---

### Task 6: Integrate LeftBrowserPanel into App.tsx and add migration

**Files:**
- Modify: `src/App.tsx`

This is the largest task. It involves:
1. Adding browser panel state
2. Adding keyboard shortcut
3. Adding command palette entry
4. Rendering the LeftBrowserPanel
5. Removing browser from switchConnectionPaletteSection
6. Removing browser cleanup from layout/tab handlers
7. Adding localStorage migration

- [ ] **Step 1: Add import for LeftBrowserPanel**

At the top of `src/App.tsx`, add after the SidePanel import (line 13):

```typescript
import { LeftBrowserPanel } from "./components/LeftBrowserPanel/LeftBrowserPanel";
```

- [ ] **Step 2: Add browserPanelOpen state**

After the `sidebarTab` state declaration (after line 79), add:

```typescript
  const [browserPanelOpen, setBrowserPanelOpen] = useState(() => {
    return localStorage.getItem("v-terminal:browser-panel-open") === "true";
  });
```

- [ ] **Step 3: Add browserPanelOpen ref for keyboard handler**

After the `sidebarOpenRef` (line 141), add:

```typescript
  const browserPanelOpenRef = useRef(browserPanelOpen);
  useEffect(() => { browserPanelOpenRef.current = browserPanelOpen; }, [browserPanelOpen]);
```

- [ ] **Step 4: Add toggle handler**

After `handleCloseSidebar` (after line 153), add:

```typescript
  const handleToggleBrowserPanel = useCallback(() => {
    const next = !browserPanelOpen;
    setBrowserPanelOpen(next);
    localStorage.setItem("v-terminal:browser-panel-open", String(next));
  }, [browserPanelOpen]);

  const handleCloseBrowserPanel = useCallback(() => {
    setBrowserPanelOpen(false);
    localStorage.setItem("v-terminal:browser-panel-open", "false");
  }, []);
```

- [ ] **Step 5: Add Ctrl+Shift+B keyboard shortcut**

In the `onKeyDown` handler (inside the `useEffect` at line 161), after the `Ctrl+Shift+N` block (after line 182), add:

```typescript
      if (e.ctrlKey && e.shiftKey && e.key === "B") {
        e.preventDefault();
        e.stopPropagation();
        const next = !browserPanelOpenRef.current;
        setBrowserPanelOpen(next);
        localStorage.setItem("v-terminal:browser-panel-open", String(next));
      }
```

- [ ] **Step 6: Add browser toggle command to tabPaletteSection**

In the `tabPaletteSection` (the `useMemo` starting around line 301), add a new command object after the "Show Toolkit" / "Hide Toolkit" entry (after line 394) and before the "SSH Profiles" entry:

```typescript
      {
        id: "view:browser",
        label: browserPanelOpen ? "Hide Browser" : "Show Browser",
        description: "Toggle the browser side panel",
        meta: "Ctrl+Shift+B",
        icon: (
          <span className="cp-cmd-icon">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.2" />
              <ellipse cx="7" cy="7" rx="2.5" ry="5.5" stroke="currentColor" strokeWidth="1" />
              <line x1="1.5" y1="7" x2="12.5" y2="7" stroke="currentColor" strokeWidth="1" />
            </svg>
          </span>
        ),
        isActive: browserPanelOpen,
        action: handleToggleBrowserPanel,
      },
```

Add `browserPanelOpen` and `handleToggleBrowserPanel` to the `useMemo` dependency array.

- [ ] **Step 7: Remove browser entry from switchConnectionPaletteSection**

In the `switchConnectionPaletteSection` (the `useMemo` starting around line 741), remove the entire Browser command object (lines 803-826):

```typescript
// DELETE the entire "Browser" block:
      // Browser
      {
        id: "conn:browser",
        label: "Browser",
        ...
      },
```

Also remove browser cleanup code from the Local Shell, Note, WSL, and SSH action handlers. In each `action` callback, remove lines like:

```typescript
// DELETE from each action where it appears:
          if (connType === "browser") {
            ipc.browserDestroy(`browser-${activePanelId}`).catch(() => {});
          }
```

- [ ] **Step 8: Remove browser cleanup from handleLayoutChange**

In `handleLayoutChange` (around line 241), remove the browser cleanup block (lines 253-258):

```typescript
// DELETE:
    const removedBrowserPanelIds = removed
      .filter((p) => p.connection?.type === "browser")
      .map((p) => p.id);
    for (const id of removedBrowserPanelIds) {
      ipc.browserDestroy(`browser-${id}`).catch(() => {});
    }
```

- [ ] **Step 9: Remove browser cleanup from handleTabClose and handleTabKill**

In `handleTabClose` (around line 903), remove:

```typescript
// DELETE:
      const browserPanelIds = tab.panels
        .filter((p) => p.connection?.type === "browser")
        .map((p) => p.id);
      for (const id of browserPanelIds) {
        ipc.browserDestroy(`browser-${id}`).catch(() => {});
      }
```

In `handleTabKill` (around line 922), remove the same pattern:

```typescript
// DELETE:
      const browserPanelIds = tab.panels
        .filter((p) => p.connection?.type === "browser")
        .map((p) => p.id);
      for (const id of browserPanelIds) {
        ipc.browserDestroy(`browser-${id}`).catch(() => {});
      }
```

- [ ] **Step 10: Render LeftBrowserPanel in app-content (always mounted)**

In the JSX return (around line 967), change the `.app-content` div to include the LeftBrowserPanel before `.app-terminal-area`. **IMPORTANT: The component is always rendered (never conditionally mounted) to preserve the WebView2 keep-alive.** Visibility is controlled via the `isVisible` prop and CSS `display: none`.

```tsx
      <div className="app-content">
        <LeftBrowserPanel
          isVisible={browserPanelOpen}
          overlayActive={paletteOpen || settingsModalOpen || sshModalOpen || showWelcome}
          onClose={handleCloseBrowserPanel}
        />
        <div className="app-terminal-area">
```

- [ ] **Step 11: Add localStorage migration for stale browser panels**

After the existing note migration `useEffect` (after line 135), add:

```typescript
  // One-time migration: convert stale browser panel connections to local
  useEffect(() => {
    const MIGRATION_KEY = "v-terminal:migration-browser-panel-done";
    if (localStorage.getItem(MIGRATION_KEY)) return;

    const wsRaw = localStorage.getItem("v-terminal:workspace");
    if (wsRaw) {
      try {
        const ws = JSON.parse(wsRaw);
        let changed = false;
        if (ws.tabs && Array.isArray(ws.tabs)) {
          for (const tab of ws.tabs) {
            if (tab.panels && Array.isArray(tab.panels)) {
              for (const panel of tab.panels) {
                if (panel.connection?.type === "browser") {
                  panel.connection = { type: "local" };
                  panel.sessionId = null;
                  changed = true;
                }
              }
            }
          }
        }
        if (changed) {
          localStorage.setItem("v-terminal:workspace", JSON.stringify(ws));
        }
      } catch {}
    }

    localStorage.setItem(MIGRATION_KEY, "true");
  }, []);
```

- [ ] **Step 12: Verify TypeScript compiles**

Run: `cd /Users/handongho/.openclaw/workspace/projects/v-terminal && npx tsc --noEmit`

Expected: No errors.

- [ ] **Step 13: Commit**

```bash
git add src/App.tsx
git commit -m "feat: integrate LeftBrowserPanel into App with toggle, shortcut, palette, and migration"
```

---

### Task 7: Delete old BrowserPanel component

**Files:**
- Delete: `src/components/BrowserPanel/BrowserPanel.tsx`
- Delete: `src/components/BrowserPanel/BrowserPanel.css`

- [ ] **Step 1: Delete old BrowserPanel files**

```bash
rm src/components/BrowserPanel/BrowserPanel.tsx src/components/BrowserPanel/BrowserPanel.css
rmdir src/components/BrowserPanel
```

- [ ] **Step 2: Verify no remaining imports**

Run: `grep -r "BrowserPanel" src/ --include="*.tsx" --include="*.ts"`

Expected: No results (all references should have been removed in prior tasks).

- [ ] **Step 3: Verify TypeScript still compiles**

Run: `cd /Users/handongho/.openclaw/workspace/projects/v-terminal && npx tsc --noEmit`

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: delete old BrowserPanel component and browser CSS"
```

---

### Task 8: Build verification

- [ ] **Step 1: Run full TypeScript check**

Run: `cd /Users/handongho/.openclaw/workspace/projects/v-terminal && npx tsc --noEmit`

Expected: No errors.

- [ ] **Step 2: Run dev build**

Run: `cd /Users/handongho/.openclaw/workspace/projects/v-terminal && npm run build 2>&1 | tail -20`

Expected: Build succeeds without errors.

- [ ] **Step 3: Verify no stale browser references**

Run: `grep -rn "\"browser\"" src/ --include="*.tsx" --include="*.ts" | grep -v "LeftBrowserPanel" | grep -v "browserConfig" | grep -v "tauriIpc" | grep -v "browser-left-panel" | grep -v "browser-panel"`

Expected: No results referencing the old browser PanelConnection type.

- [ ] **Step 4: Final commit if any fixups needed**

```bash
git add -A
git commit -m "fix: address build verification issues"
```
