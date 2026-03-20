# Browser Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a native WebView2 browser panel to v-terminal using Tauri 2 multiwebview, with full UI integration (SessionPicker, ContextMenu, CommandPalette, Settings).

**Architecture:** React renders a toolbar (URL bar + nav buttons) at the top of the panel. Below it, a placeholder div is measured and its bounds sent to Rust via IPC. Rust creates a native WebView2 child webview at those coordinates. URL sync uses a hybrid of initialization scripts, `on_navigation`, and fallback polling.

**Tech Stack:** Tauri 2 (multiwebview, `unstable` feature), React 18, Zustand, TypeScript, Rust

**Spec:** `docs/superpowers/specs/2026-03-20-browser-panel-design.md`

---

## File Map

**New files:**
- `src-tauri/src/commands/browser_commands.rs` — 8 Rust IPC commands for webview lifecycle
- `src/store/browserConfigStore.ts` — Zustand store for browser settings (home page)
- `src/components/BrowserPanel/BrowserPanel.tsx` — React browser panel component
- `src/components/BrowserPanel/BrowserPanel.css` — Browser panel styles

**Modified files:**
- `src/types/terminal.ts` — Add `'browser'` to PanelConnection type
- `src-tauri/src/commands/mod.rs` — Export browser_commands module
- `src-tauri/src/lib.rs` — Register 8 new IPC commands
- `src/lib/tauriIpc.ts` — Add 8 browser IPC wrapper functions
- `src/store/tabStore.ts:219` — Skip browser in `baseConnection` inheritance
- `src/components/SessionPicker/SessionPicker.tsx` — Add Browser connection option
- `src/components/PanelContextMenu/PanelContextMenu.tsx` — Add Browser menu item
- `src/App.tsx:735-859` — Add `conn:browser` to CommandPalette connection section
- `src/App.tsx:241-253` — Add browser cleanup in `handleLayoutChange`
- `src/App.tsx:861-888` — Add browser cleanup in `handleTabClose`/`handleTabKill`
- `src/components/PanelGrid/PanelGrid.tsx:178-203` — Add BrowserPanel render branch
- `src/components/SettingsModal/SettingsModal.tsx` — Add Browser settings tab

---

### Task 1: Type Foundation + Rust IPC Commands

**Files:**
- Modify: `src/types/terminal.ts`
- Create: `src-tauri/src/commands/browser_commands.rs`
- Modify: `src-tauri/src/commands/mod.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Add `'browser'` type and `browserUrl` to PanelConnection**

In `src/types/terminal.ts`, update the `PanelConnection` interface:

```typescript
export interface PanelConnection {
  type: 'local' | 'ssh' | 'wsl' | 'note' | 'browser';
  sshProfileId?: string;
  shellProgram?: string;
  shellArgs?: string[];
  wslDistro?: string;
  label?: string;
  browserUrl?: string;
}
```

- [ ] **Step 2: Create `browser_commands.rs` with all 8 IPC commands**

Create `src-tauri/src/commands/browser_commands.rs`:

```rust
use serde::Serialize;
use tauri::{AppHandle, Manager, WebviewBuilder, WebviewUrl};
use tauri::LogicalPosition;
use tauri::LogicalSize;

#[derive(Clone, Serialize)]
struct BrowserUrlPayload {
    label: String,
    url: String,
}

// Placeholder __WEBVIEW_LABEL__ is replaced with the actual label at runtime.
// Note: Tauri 2 injects __TAURI_INTERNALS__ into child webviews created via
// window.add_child(), so invoke() IS available even for external URLs.
// If IPC is somehow unavailable, on_navigation still provides best-effort tracking.
const URL_SYNC_SCRIPT: &str = r#"
(function() {
  var LABEL = '__WEBVIEW_LABEL__';
  var lastUrl = location.href;

  function reportUrl() {
    var url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      if (window.__TAURI_INTERNALS__) {
        window.__TAURI_INTERNALS__.invoke('browser_url_report', { label: LABEL, url: url });
      }
    }
  }

  // Intercept pushState / replaceState
  var origPush = history.pushState;
  var origReplace = history.replaceState;
  history.pushState = function() {
    origPush.apply(this, arguments);
    reportUrl();
  };
  history.replaceState = function() {
    origReplace.apply(this, arguments);
    reportUrl();
  };

  window.addEventListener('popstate', reportUrl);
  window.addEventListener('hashchange', reportUrl);
})();
"#;

#[tauri::command]
pub async fn browser_create(
    app: AppHandle,
    label: String,
    url: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
) -> Result<(), String> {
    let window = app.get_webview_window("main")
        .ok_or("Main window not found")?;

    let parsed_url = url.parse::<tauri::Url>()
        .map_err(|e| format!("Invalid URL: {e}"))?;

    let app_handle = app.clone();
    let label_for_nav = label.clone();

    let builder = WebviewBuilder::new(
        &label,
        WebviewUrl::External(parsed_url),
    )
    .initialization_script(&URL_SYNC_SCRIPT.replace("__WEBVIEW_LABEL__", &label))
    .on_navigation(move |nav_url| {
        let _ = app_handle.emit("browser-url-changed", BrowserUrlPayload {
            label: label_for_nav.clone(),
            url: nav_url.to_string(),
        });
        true // allow all navigation
    });

    window.add_child(
        builder,
        LogicalPosition::new(x, y),
        LogicalSize::new(width, height),
    ).map_err(|e| format!("Failed to create browser webview: {e}"))?;

    Ok(())
}

#[tauri::command]
pub async fn browser_navigate(
    app: AppHandle,
    label: String,
    url: String,
) -> Result<(), String> {
    let webview = app.get_webview(&label)
        .ok_or(format!("Webview '{label}' not found"))?;

    let final_url = if !url.contains("://") {
        format!("https://{url}")
    } else {
        url
    };

    let parsed = final_url.parse::<tauri::Url>()
        .map_err(|e| format!("Invalid URL: {e}"))?;

    webview.navigate(parsed)
        .map_err(|e| format!("Navigation failed: {e}"))
}

#[tauri::command]
pub async fn browser_go_back(
    app: AppHandle,
    label: String,
) -> Result<(), String> {
    let webview = app.get_webview(&label)
        .ok_or(format!("Webview '{label}' not found"))?;
    webview.eval("window.history.back()")
        .map_err(|e| format!("Eval failed: {e}"))
}

#[tauri::command]
pub async fn browser_go_forward(
    app: AppHandle,
    label: String,
) -> Result<(), String> {
    let webview = app.get_webview(&label)
        .ok_or(format!("Webview '{label}' not found"))?;
    webview.eval("window.history.forward()")
        .map_err(|e| format!("Eval failed: {e}"))
}

#[tauri::command]
pub async fn browser_reload(
    app: AppHandle,
    label: String,
) -> Result<(), String> {
    let webview = app.get_webview(&label)
        .ok_or(format!("Webview '{label}' not found"))?;
    webview.eval("window.location.reload()")
        .map_err(|e| format!("Eval failed: {e}"))
}

#[tauri::command]
pub async fn browser_resize(
    app: AppHandle,
    label: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
) -> Result<(), String> {
    let webview = app.get_webview(&label)
        .ok_or(format!("Webview '{label}' not found"))?;
    webview.set_position(LogicalPosition::new(x, y))
        .map_err(|e| format!("Set position failed: {e}"))?;
    webview.set_size(LogicalSize::new(width, height))
        .map_err(|e| format!("Set size failed: {e}"))
}

#[tauri::command]
pub async fn browser_destroy(
    app: AppHandle,
    label: String,
) -> Result<(), String> {
    if let Some(webview) = app.get_webview(&label) {
        webview.close().map_err(|e| format!("Close failed: {e}"))?;
    }
    Ok(())
}

#[tauri::command]
pub async fn browser_get_current_url(
    app: AppHandle,
    label: String,
) -> Result<String, String> {
    let webview = app.get_webview(&label)
        .ok_or(format!("Webview '{label}' not found"))?;
    webview.eval("window.location.href")
        .map_err(|e| format!("Eval failed: {e}"))?;
    // Note: eval is fire-and-forget in Tauri 2 — use the URL sync event instead
    // This command is a best-effort trigger; actual URL comes via browser-url-changed event
    Ok(String::new())
}

#[tauri::command]
pub async fn browser_url_report(
    app: AppHandle,
    label: String,
    url: String,
) -> Result<(), String> {
    app.emit("browser-url-changed", BrowserUrlPayload { label, url })
        .map_err(|e| format!("Emit failed: {e}"))
}
```

**Important note on `browser_get_current_url`**: Tauri 2's `webview.eval()` is fire-and-forget — it doesn't return a value. Instead of polling via IPC return values, we inject the initialization script that proactively reports URL changes. The `browser_url_report` command is the receiving end of the init script's `invoke` call. If `eval` return values become available in a future Tauri version, `browser_get_current_url` can be updated.

- [ ] **Step 3: Export module in `commands/mod.rs`**

Add to `src-tauri/src/commands/mod.rs`:

```rust
pub mod session_commands;
pub mod wsl_commands;
pub mod browser_commands;
```

- [ ] **Step 4: Register commands in `lib.rs`**

Update the `invoke_handler` in `src-tauri/src/lib.rs`:

```rust
.invoke_handler(tauri::generate_handler![
    session_commands::session_create,
    session_commands::session_create_with_password,
    session_commands::session_create_wsl_with_sudo,
    session_commands::session_write,
    session_commands::session_resize,
    session_commands::session_kill,
    wsl_commands::get_wsl_distros,
    browser_commands::browser_create,
    browser_commands::browser_navigate,
    browser_commands::browser_go_back,
    browser_commands::browser_go_forward,
    browser_commands::browser_reload,
    browser_commands::browser_resize,
    browser_commands::browser_destroy,
    browser_commands::browser_get_current_url,
    browser_commands::browser_url_report,
])
```

Also add the import at the top:

```rust
use commands::{session_commands, wsl_commands, browser_commands};
```

- [ ] **Step 5: Verify Rust compiles**

Run: `cd src-tauri && cargo check`
Expected: Compiles without errors.

- [ ] **Step 6: Commit**

```bash
git add src/types/terminal.ts src-tauri/src/commands/browser_commands.rs src-tauri/src/commands/mod.rs src-tauri/src/lib.rs
git commit -m "feat: add browser panel type and Rust IPC commands"
```

---

### Task 2: Frontend IPC Wrappers + Browser Config Store

**Files:**
- Modify: `src/lib/tauriIpc.ts`
- Create: `src/store/browserConfigStore.ts`

- [ ] **Step 1: Add 8 browser IPC wrappers to `tauriIpc.ts`**

Add these methods inside the `export const ipc = {` object at the end (before the closing `};` on line 105):

```typescript
  // Browser panel
  async browserCreate(label: string, url: string, x: number, y: number, width: number, height: number): Promise<void> {
    return invoke("browser_create", { label, url, x, y, width, height });
  },
  async browserNavigate(label: string, url: string): Promise<void> {
    return invoke("browser_navigate", { label, url });
  },
  async browserGoBack(label: string): Promise<void> {
    return invoke("browser_go_back", { label });
  },
  async browserGoForward(label: string): Promise<void> {
    return invoke("browser_go_forward", { label });
  },
  async browserReload(label: string): Promise<void> {
    return invoke("browser_reload", { label });
  },
  async browserResize(label: string, x: number, y: number, width: number, height: number): Promise<void> {
    return invoke("browser_resize", { label, x, y, width, height });
  },
  async browserDestroy(label: string): Promise<void> {
    return invoke("browser_destroy", { label });
  },
  async browserGetCurrentUrl(label: string): Promise<string> {
    return invoke<string>("browser_get_current_url", { label });
  },
```

- [ ] **Step 2: Create `browserConfigStore.ts`**

Create `src/store/browserConfigStore.ts`:

```typescript
import { create } from "zustand";

const STORAGE_KEY = "v-terminal:browser-config";

interface BrowserConfig {
  homePage: string;
}

const DEFAULTS: BrowserConfig = {
  homePage: "",
};

function loadConfig(): BrowserConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULTS };
}

function saveConfig(config: BrowserConfig) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {}
}

interface BrowserConfigStore extends BrowserConfig {
  setHomePage: (url: string) => void;
  getStartUrl: () => string;
}

export const useBrowserConfigStore = create<BrowserConfigStore>((set, get) => ({
  ...loadConfig(),

  setHomePage: (url) => {
    set({ homePage: url });
    saveConfig({ ...get(), homePage: url });
  },

  getStartUrl: () => {
    const hp = get().homePage.trim();
    return hp || "about:blank";
  },
}));
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/tauriIpc.ts src/store/browserConfigStore.ts
git commit -m "feat: add browser IPC wrappers and config store"
```

---

### Task 3: BrowserPanel Component

**Files:**
- Create: `src/components/BrowserPanel/BrowserPanel.tsx`
- Create: `src/components/BrowserPanel/BrowserPanel.css`

- [ ] **Step 1: Create `BrowserPanel.tsx`**

Create `src/components/BrowserPanel/BrowserPanel.tsx`:

```tsx
import { useState, useRef, useEffect, useCallback } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { ipc } from "../../lib/tauriIpc";
import { useBrowserConfigStore } from "../../store/browserConfigStore";
import { useTabStore } from "../../store/tabStore";
import "./BrowserPanel.css";

interface BrowserPanelProps {
  panelId: string;
  tabId: string;
  browserUrl?: string;
  isActive: boolean;
  isVisible: boolean;
  onFocus: () => void;
}

interface BrowserUrlPayload {
  label: string;
  url: string;
}

export function BrowserPanel({
  panelId,
  tabId,
  browserUrl,
  isActive,
  isVisible,
  onFocus,
}: BrowserPanelProps) {
  const webviewLabel = `browser-${panelId}`;
  const placeholderRef = useRef<HTMLDivElement>(null);
  const [url, setUrl] = useState(browserUrl ?? "");
  const [inputValue, setInputValue] = useState(browserUrl ?? "");
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState(false);
  const urlRef = useRef(url);
  urlRef.current = url;
  const createdRef = useRef(false);

  const getStartUrl = useBrowserConfigStore((s) => s.getStartUrl);
  const switchPanelConnection = useTabStore((s) => s.switchPanelConnection);

  // Persist URL changes to workspace
  const persistUrl = useCallback((newUrl: string) => {
    switchPanelConnection(tabId, panelId, {
      type: "browser",
      browserUrl: newUrl,
    });
  }, [tabId, panelId, switchPanelConnection]);

  // Create webview on mount
  useEffect(() => {
    const el = placeholderRef.current;
    if (!el) return;

    const startUrl = browserUrl || getStartUrl();
    const rect = el.getBoundingClientRect();

    ipc.browserCreate(
      webviewLabel,
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
    }).catch((err) => {
      setError(String(err));
    });

    return () => {
      if (createdRef.current) {
        ipc.browserDestroy(webviewLabel).catch(() => {});
        createdRef.current = false;
      }
    };
  }, [webviewLabel]); // eslint-disable-line react-hooks/exhaustive-deps

  // Listen for URL changes
  useEffect(() => {
    let unlisten: UnlistenFn | null = null;

    listen<BrowserUrlPayload>("browser-url-changed", (event) => {
      if (event.payload.label !== webviewLabel) return;
      const newUrl = event.payload.url;
      if (newUrl !== urlRef.current) {
        setUrl(newUrl);
        setInputValue(newUrl === "about:blank" ? "" : newUrl);
        persistUrl(newUrl);
      }
    }).then((fn) => { unlisten = fn; });

    return () => { unlisten?.(); };
  }, [webviewLabel, persistUrl]);

  // ResizeObserver + visibility sync — single effect handles both
  useEffect(() => {
    const el = placeholderRef.current;
    if (!el || !created) return;

    let throttleTimer: ReturnType<typeof setTimeout> | null = null;

    const syncBounds = () => {
      if (!createdRef.current) return;
      if (!isVisible) {
        ipc.browserResize(webviewLabel, 0, 0, 0, 0).catch(() => {});
      } else {
        const rect = el.getBoundingClientRect();
        ipc.browserResize(webviewLabel, rect.left, rect.top, rect.width, rect.height).catch(() => {});
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

    // Also sync on window resize
    window.addEventListener("resize", throttledSync);

    // Initial sync (handles visibility on mount/tab switch)
    syncBounds();

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", throttledSync);
      if (throttleTimer) clearTimeout(throttleTimer);
    };
  }, [webviewLabel, created, isVisible]);

  // Navigation handlers
  const handleNavigate = useCallback((targetUrl: string) => {
    const trimmed = targetUrl.trim();
    if (!trimmed) return;
    ipc.browserNavigate(webviewLabel, trimmed).catch(() => {});
  }, [webviewLabel]);

  const handleUrlSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    handleNavigate(inputValue);
  }, [inputValue, handleNavigate]);

  const handleBack = useCallback(() => {
    ipc.browserGoBack(webviewLabel).catch(() => {});
  }, [webviewLabel]);

  const handleForward = useCallback(() => {
    ipc.browserGoForward(webviewLabel).catch(() => {});
  }, [webviewLabel]);

  const handleReload = useCallback(() => {
    ipc.browserReload(webviewLabel).catch(() => {});
  }, [webviewLabel]);

  const handleRetry = useCallback(() => {
    setError(null);
    const el = placeholderRef.current;
    if (!el) return;
    const startUrl = browserUrl || getStartUrl();
    const rect = el.getBoundingClientRect();
    ipc.browserCreate(webviewLabel, startUrl, rect.left, rect.top, rect.width, rect.height)
      .then(() => {
        setCreated(true);
        createdRef.current = true;
      })
      .catch((err) => setError(String(err)));
  }, [webviewLabel, browserUrl, getStartUrl]);

  return (
    <div
      className={`browser-panel${isActive ? " browser-panel--active" : ""}`}
      onClick={onFocus}
    >
      {/* Toolbar */}
      <div className="browser-toolbar">
        <button className="browser-nav-btn" onClick={handleBack} title="Back">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 2.5L4.5 7 9 11.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button className="browser-nav-btn" onClick={handleForward} title="Forward">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M5 2.5L9.5 7 5 11.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button className="browser-nav-btn" onClick={handleReload} title="Reload">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2.5 7a4.5 4.5 0 1 1 1 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            <path d="M2.5 11.5V7H6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <form className="browser-url-form" onSubmit={handleUrlSubmit}>
          <input
            className="browser-url-input"
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
      <div ref={placeholderRef} className="browser-content">
        {error && (
          <div className="browser-error">
            <p className="browser-error-msg">{error}</p>
            <button className="browser-retry-btn" onClick={handleRetry}>
              Retry
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `BrowserPanel.css`**

Create `src/components/BrowserPanel/BrowserPanel.css`:

```css
.browser-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  overflow: hidden;
  border: 1px solid transparent;
  border-radius: 6px;
  transition: border-color 0.15s ease;
}

.browser-panel--active {
  border-color: var(--accent, #007aff);
}

/* ── Toolbar ─────────────────────────────────── */

.browser-toolbar {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px 6px;
  height: 32px;
  min-height: 32px;
  background: var(--toolbar-bg, rgba(255, 255, 255, 0.06));
  border-bottom: 1px solid var(--border, rgba(255, 255, 255, 0.08));
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.browser-nav-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--text-secondary, #999);
  cursor: pointer;
  flex-shrink: 0;
}

.browser-nav-btn:hover {
  background: var(--hover-bg, rgba(255, 255, 255, 0.08));
  color: var(--text-primary, #fff);
}

.browser-url-form {
  flex: 1;
  min-width: 0;
}

.browser-url-input {
  width: 100%;
  height: 24px;
  padding: 0 8px;
  border: 1px solid var(--border, rgba(255, 255, 255, 0.1));
  border-radius: 6px;
  background: var(--input-bg, rgba(0, 0, 0, 0.2));
  color: var(--text-primary, #fff);
  font-family: "Pretendard", -apple-system, sans-serif;
  font-size: 12px;
  outline: none;
  transition: border-color 0.15s ease;
}

.browser-url-input:focus {
  border-color: var(--accent, #007aff);
}

.browser-url-input::placeholder {
  color: var(--text-tertiary, #666);
}

/* ── Content area ────────────────────────────── */

.browser-content {
  flex: 1;
  position: relative;
  min-height: 0;
}

/* ── Error state ─────────────────────────────── */

.browser-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 12px;
  color: var(--text-secondary, #999);
}

.browser-error-msg {
  font-size: 12px;
  max-width: 300px;
  text-align: center;
  word-break: break-word;
}

.browser-retry-btn {
  padding: 6px 16px;
  border: 1px solid var(--border, rgba(255, 255, 255, 0.15));
  border-radius: 6px;
  background: var(--hover-bg, rgba(255, 255, 255, 0.06));
  color: var(--text-primary, #fff);
  font-size: 12px;
  cursor: pointer;
}

.browser-retry-btn:hover {
  background: var(--hover-bg-strong, rgba(255, 255, 255, 0.1));
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/BrowserPanel/BrowserPanel.tsx src/components/BrowserPanel/BrowserPanel.css
git commit -m "feat: add BrowserPanel component with toolbar and webview lifecycle"
```

---

### Task 4: PanelGrid Integration + tabStore Fix

**Files:**
- Modify: `src/components/PanelGrid/PanelGrid.tsx`
- Modify: `src/store/tabStore.ts`

- [ ] **Step 1: Add BrowserPanel rendering branch in PanelGrid**

In `src/components/PanelGrid/PanelGrid.tsx`:

1. Add import at top:
```typescript
import { BrowserPanel } from "../BrowserPanel/BrowserPanel";
```

2. In the `handleSwitchConnection` callback (~line 57-70), add browser cleanup before the note cleanup:
```typescript
const handleSwitchConnection = useCallback(
  (connection: PanelConnection) => {
    if (!ctxMenu) return;
    const currentTab = useTabStore.getState().tabs.find((t) => t.id === tab.id);
    const currentPanel = currentTab?.panels.find((p) => p.id === ctxMenu.panelId);
    // Clean up browser webview if switching away from browser panel
    if (currentPanel?.connection?.type === "browser") {
      ipc.browserDestroy(`browser-${ctxMenu.panelId}`).catch(() => {});
    }
    // Clean up note data if switching away from note panel
    if (currentPanel?.connection?.type === "note" && connection.type !== "note") {
      useNoteStore.getState().removeNote(ctxMenu.panelId);
    }
    switchPanelConnection(tab.id, ctxMenu.panelId, connection);
    setCtxMenu(null);
  },
  [ctxMenu, tab.id, switchPanelConnection]
);
```

3. In the panel render section (~line 178-203), add the browser branch. Replace the existing ternary with a three-way check:

```tsx
{panel.connection?.type === "note" ? (
  <NotePanel
    panelId={panel.id}
    isActive={panel.id === activePanelId}
    onFocus={() => setActivePanelId(panel.id)}
  />
) : panel.connection?.type === "browser" ? (
  <BrowserPanel
    panelId={panel.id}
    tabId={tab.id}
    browserUrl={panel.connection.browserUrl}
    isActive={panel.id === activePanelId}
    isVisible={isVisible && !hidden}
    onFocus={() => setActivePanelId(panel.id)}
  />
) : (
  <TerminalPane
    cwd={tab.cwd}
    isActive={panel.id === activePanelId}
    broadcastEnabled={tab.broadcastEnabled}
    siblingSessionIds={siblingSessionIds}
    connectionType={panel.connection?.type}
    sshHost={sshProfile?.host}
    sshPort={sshProfile?.port}
    sshUsername={sshProfile?.username}
    sshIdentityFile={sshProfile?.identityFile}
    shellProgram={panel.connection?.shellProgram}
    shellArgs={panel.connection?.shellArgs}
    wslDistro={panel.connection?.wslDistro}
    onSessionCreated={(sessionId, connectionId) => handleSessionCreated(panel.id, sessionId, connectionId)}
    onSessionKilled={() => handleSessionKilled(panel.id)}
    onFocus={() => setActivePanelId(panel.id)}
    onNextPanel={handleNextPanel}
    onPrevPanel={handlePrevPanel}
  />
)}
```

- [ ] **Step 2: Fix `baseConnection` in tabStore.ts**

In `src/store/tabStore.ts` line 219, change:

```typescript
const baseConnection = firstConn?.type === "note" ? undefined : firstConn;
```

to:

```typescript
const baseConnection = (firstConn?.type === "note" || firstConn?.type === "browser") ? undefined : firstConn;
```

- [ ] **Step 3: Commit**

```bash
git add src/components/PanelGrid/PanelGrid.tsx src/store/tabStore.ts
git commit -m "feat: integrate BrowserPanel into PanelGrid, fix baseConnection inheritance"
```

---

### Task 5: SessionPicker + PanelContextMenu

**Files:**
- Modify: `src/components/SessionPicker/SessionPicker.tsx`
- Modify: `src/components/PanelContextMenu/PanelContextMenu.tsx`

- [ ] **Step 1: Add Browser option to SessionPicker**

In `src/components/SessionPicker/SessionPicker.tsx`:

1. Add `IconBrowser` component after `IconNote` (~line 73-80):

```tsx
const IconBrowser = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.25" />
    <ellipse cx="8" cy="8" rx="3" ry="6" stroke="currentColor" strokeWidth="1.1" />
    <line x1="2" y1="8" x2="14" y2="8" stroke="currentColor" strokeWidth="1.1" />
  </svg>
);
```

2. Update `ConnectionOption` type (~line 22) to include `'browser'`:
```typescript
type: "local" | "ssh" | "wsl" | "note" | "browser";
```

3. Add `optionToConnection` branch for browser (~line 32-36):
```typescript
function optionToConnection(opt: ConnectionOption): PanelConnection {
  if (opt.type === "note") {
    return { type: "note" };
  }
  if (opt.type === "browser") {
    return { type: "browser" };
  }
  return {
    type: opt.type,
    // ... existing fields
  };
}
```

4. Add browser option in `connectionOptions` array, after the Note entry (~line 337-341):
```typescript
opts.push({
  id: "browser",
  type: "browser" as const,
  name: "Browser",
  subtitle: "Web browser",
});
```

5. Add `IconBrowser` to the icon switch in the render (~line 460-470). After the `IconNote` check:
```tsx
opt.type === "browser" ? (
  <IconBrowser />
) :
```

- [ ] **Step 2: Add Browser option to PanelContextMenu**

In `src/components/PanelContextMenu/PanelContextMenu.tsx`, after the Note section (~line 174), add:

```tsx
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

- [ ] **Step 3: Add `.sp-dot--browser` CSS**

In `src/components/SessionPicker/SessionPicker.css`, the `.sp-dot--browser` class already exists at line 285 with `background: var(--warning, #f5a623)`. Update it to a blue color to match the globe/browser metaphor:

```css
.sp-dot--browser { background: #3b82f6; }
```

- [ ] **Step 4: Commit**

```bash
git add src/components/SessionPicker/SessionPicker.tsx src/components/SessionPicker/SessionPicker.css src/components/PanelContextMenu/PanelContextMenu.tsx
git commit -m "feat: add Browser option to SessionPicker and PanelContextMenu"
```

---

### Task 6: CommandPalette + App.tsx Cleanup Handlers

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add `conn:browser` to CommandPalette connection section**

In `src/App.tsx`, inside the `switchConnectionPaletteSection` useMemo (~line 735-859), add a Browser entry in the `commands` array after the Note entry (~after line 790) and before the WSL distros:

```typescript
// Browser
{
  id: "conn:browser",
  label: "Browser",
  description: "Open a web browser in this panel",
  meta: "Web",
  icon: (
    <span className="cp-cmd-icon">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.2" />
        <ellipse cx="7" cy="7" rx="2.5" ry="5.5" stroke="currentColor" strokeWidth="1" />
        <line x1="1.5" y1="7" x2="12.5" y2="7" stroke="currentColor" strokeWidth="1" />
      </svg>
    </span>
  ),
  isActive: connType === "browser",
  action: () => {
    if (connType === "browser") return;
    if (connType === "note") {
      useNoteStore.getState().removeNote(activePanelId);
    }
    switchPanelConnection(activeTab.id, activePanelId, { type: "browser" });
  },
},
```

Also, update every other connection switch action (`conn:local`, `conn:note`, each WSL distro, each SSH profile) to add browser cleanup. In each action function, add this **before** the `switchPanelConnection` call:
```typescript
// Destroy browser webview if switching away from browser
if (connType === "browser") {
  ipc.browserDestroy(`browser-${activePanelId}`).catch(() => {});
}
```

Specifically, add it to these existing actions:
- `conn:local` action (~line 762): before `switchPanelConnection(activeTab.id, activePanelId, { type: "local" })`
- `conn:note` action (~line 787): before `switchPanelConnection(activeTab.id, activePanelId, { type: "note" })`
- Each WSL distro action (~line 815): before `switchPanelConnection(activeTab.id, activePanelId, { type: "wsl", ... })`
- Each SSH profile action (~line 849): before `switchPanelConnection(activeTab.id, activePanelId, { type: "ssh", ... })`
```

- [ ] **Step 2: Add browser cleanup to `handleLayoutChange`**

In `src/App.tsx` `handleLayoutChange` (~line 241-253), add after the note cleanup:

```typescript
const removedBrowserPanelIds = removed
  .filter((p) => p.connection?.type === "browser")
  .map((p) => p.id);
for (const id of removedBrowserPanelIds) {
  ipc.browserDestroy(`browser-${id}`).catch(() => {});
}
```

- [ ] **Step 3: Add browser cleanup to `handleTabClose` and `handleTabKill`**

In `handleTabClose` (~line 861-872), add after the note cleanup:

```typescript
const browserPanelIds = tab.panels
  .filter((p) => p.connection?.type === "browser")
  .map((p) => p.id);
for (const id of browserPanelIds) {
  ipc.browserDestroy(`browser-${id}`).catch(() => {});
}
```

Same pattern in `handleTabKill` (~line 874-888).

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat: add Browser to CommandPalette, add webview cleanup in all teardown paths"
```

---

### Task 7: Settings Modal — Browser Tab

**Files:**
- Modify: `src/components/SettingsModal/SettingsModal.tsx`

- [ ] **Step 1: Add Browser tab to SettingsModal**

In `src/components/SettingsModal/SettingsModal.tsx`:

1. Update Tab type (~line 12):
```typescript
type Tab = "appearance" | "terminal" | "browser";
```

2. Add import at top:
```typescript
import { useBrowserConfigStore } from "../../store/browserConfigStore";
```

3. In the `SettingsModal` component, add store access:
```typescript
const { homePage, setHomePage } = useBrowserConfigStore();
```

4. Add "Browser" nav item in the `<nav>` section (~after line 144):
```tsx
<button
  className={`settings-nav-item${activeTab === "browser" ? " settings-nav-item--active" : ""}`}
  onClick={() => setActiveTab("browser")}
>
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.2" />
    <ellipse cx="7" cy="7" rx="2.5" ry="5.5" stroke="currentColor" strokeWidth="1" />
    <line x1="1.5" y1="7" x2="12.5" y2="7" stroke="currentColor" strokeWidth="1" />
  </svg>
  Browser
</button>
```

5. Add the BrowserTab render in the content area (~after line 175):
```tsx
{activeTab === "browser" && (
  <BrowserSettingsTab
    homePage={homePage}
    onHomePageChange={setHomePage}
  />
)}
```

6. Add the `BrowserSettingsTab` component at the bottom of the file:
```tsx
interface BrowserSettingsTabProps {
  homePage: string;
  onHomePageChange: (url: string) => void;
}

function BrowserSettingsTab({ homePage, onHomePageChange }: BrowserSettingsTabProps) {
  return (
    <div className="settings-section">
      <div className="settings-section-label">Home Page</div>
      <div className="settings-field">
        <input
          className="settings-text-input"
          type="text"
          value={homePage}
          onChange={(e) => onHomePageChange(e.target.value)}
          placeholder="https://example.com"
          spellCheck={false}
          autoComplete="off"
        />
        <span className="settings-field-sublabel">
          Leave empty for blank page
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add `.settings-text-input` style if not existing**

In `src/components/SettingsModal/SettingsModal.css`, add (if not already present):

```css
.settings-text-input {
  width: 100%;
  height: 32px;
  padding: 0 10px;
  border: 1px solid var(--border, rgba(255, 255, 255, 0.12));
  border-radius: 6px;
  background: var(--input-bg, rgba(0, 0, 0, 0.2));
  color: var(--text-primary, #fff);
  font-family: "Pretendard", -apple-system, sans-serif;
  font-size: 13px;
  outline: none;
  transition: border-color 0.15s ease;
}

.settings-text-input:focus {
  border-color: var(--accent, #007aff);
}

.settings-text-input::placeholder {
  color: var(--text-tertiary, #666);
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/SettingsModal/SettingsModal.tsx src/components/SettingsModal/SettingsModal.css
git commit -m "feat: add Browser tab to Settings with home page configuration"
```

---

### Task 8: Build Verification + Manual Testing

- [ ] **Step 1: Verify TypeScript compiles**

Run: `cd /Users/handongho/.openclaw/workspace/projects/v-terminal && npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 2: Verify Rust compiles**

Run: `cd /Users/handongho/.openclaw/workspace/projects/v-terminal/src-tauri && cargo check`
Expected: No compilation errors.

- [ ] **Step 3: Verify Vite builds**

Run: `cd /Users/handongho/.openclaw/workspace/projects/v-terminal && npx vite build`
Expected: Build succeeds.

- [ ] **Step 4: Fix any issues found and commit**

```bash
git add -A
git commit -m "fix: resolve build issues for browser panel"
```

---

## Implementation Notes

**On `webview.eval()` return values**: Tauri 2's `eval()` is fire-and-forget. It executes JS in the webview but does not return a result to Rust. The URL sync relies entirely on the initialization script calling `invoke('browser_url_report', ...)` back to Rust. The `browser_get_current_url` command is a placeholder — if Tauri adds eval-with-return in the future, it can be upgraded.

**On the initialization script**: The script is injected via `WebviewBuilder::initialization_script()` which runs on every page load. It monkey-patches `history.pushState`/`replaceState` and listens for `popstate`/`hashchange`. The `__WEBVIEW_LABEL__` placeholder is replaced at runtime with the actual webview label. Tauri 2 injects `__TAURI_INTERNALS__` into child webviews created via `window.add_child()`, so `invoke()` IS available even for external URLs. Cross-origin restrictions do not apply because the script is injected at the WebView2 host level, not by the page.

**On `connKey` in PanelGrid**: The `connKey` variable (~line 159-161 in PanelGrid.tsx) is used as part of the React key. It intentionally does NOT include `browserUrl`. This prevents URL navigation from causing React to unmount/remount the BrowserPanel component, which would destroy and recreate the native webview.
