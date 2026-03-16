# Browser Panel Integration — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Browser as a new Connection Type so users can browse web pages alongside terminal panels without switching apps.

**Architecture:** Browser panels use Tauri 2's native WebView overlay, positioned/sized to match their CSS Grid cell via ResizeObserver. A Rust backend manages WebView lifecycle and emits navigation events to the React frontend. Three new Zustand stores handle bookmarks, browsing history, and per-panel browser state.

**Tech Stack:** Tauri 2 (wry WebView), React 18, TypeScript, Zustand 4, localStorage

**Spec:** `docs/superpowers/specs/2026-03-16-browser-panel-design.md`

---

## File Structure

### New Files
- `src/types/browser.ts` — Bookmark, BrowserHistoryEntry, BrowserPanelState interfaces
- `src/store/bookmarkStore.ts` — Bookmark CRUD + localStorage persistence
- `src/store/browserHistoryStore.ts` — Per-workspace history + localStorage
- `src/store/browserStore.ts` — Per-panel browser state (URL, title, loading, canGoBack/Forward)
- `src/components/BrowserPane/BrowserPane.tsx` — Main browser panel component
- `src/components/BrowserPane/BrowserPane.css` — Browser panel styles
- `src/components/BrowserPane/BrowserUrlBar.tsx` — URL bar with nav buttons + bookmark star
- `src/components/BrowserPane/BrowserEmptyState.tsx` — Bookmarks grid + recent history
- `src/components/BrowserPane/BrowserErrorState.tsx` — Error/crash states
- `src/components/BookmarkManager/BookmarkManagerModal.tsx` — Bookmark management modal
- `src/components/BookmarkManager/BookmarkManagerModal.css` — Modal styles
- `src/components/PanelContextMenu/PanelContextMenu.tsx` — Right-click context menu for panels
- `src/components/PanelContextMenu/PanelContextMenu.css` — Context menu styles
- `src-tauri/src/commands/browser_commands.rs` — Rust Tauri commands for WebView lifecycle
- `src/lib/browserIpc.ts` — Frontend IPC wrapper for browser commands

### Modified Files
- `src/types/terminal.ts` — Add `'browser'` to PanelConnection.type, extend SavedTabPanel
- `src/store/tabStore.ts` — Fix ptyId filter to include browser panels
- `src/components/PanelGrid/PanelGrid.tsx` — Conditional BrowserPane/TerminalPane rendering
- `src/components/SessionPicker/SessionPicker.tsx` — Add Browser connection option
- `src/components/SplitToolbar/SplitToolbar.tsx` — Add "Manage Bookmarks" menu item
- `src/App.tsx` — Bookmark modal state, browser palette commands, overlay z-order management
- `src/lib/tauriIpc.ts` — (no change — browser commands go in separate browserIpc.ts)
- `src-tauri/src/commands/mod.rs` — Export browser_commands module
- `src-tauri/src/lib.rs` — Register browser commands in invoke_handler
- `src-tauri/capabilities/default.json` — Add webview permissions
- `src-tauri/Cargo.toml` — Add `url = "2"` dependency for URL parsing

---

## Chunk 1: Foundation — Types & Stores

### Task 1: Type Definitions

**Files:**
- Create: `src/types/browser.ts`
- Modify: `src/types/terminal.ts`

- [ ] **Step 1: Create browser type definitions**

Create `src/types/browser.ts`:

```typescript
export interface Bookmark {
  id: string
  name: string
  url: string
  favicon?: string
  createdAt: number
}

export interface BrowserHistoryEntry {
  url: string
  title: string
  favicon?: string
  visitedAt: number
  tabId: string
}

export interface BrowserPanelState {
  panelId: string
  url: string
  title: string
  isLoading: boolean
  canGoBack: boolean
  canGoForward: boolean
  error?: string
}
```

- [ ] **Step 2: Extend PanelConnection type**

In `src/types/terminal.ts`, add `'browser'` to PanelConnection.type and `browserUrl?` field:

```typescript
export interface PanelConnection {
  type: 'local' | 'ssh' | 'wsl' | 'browser'
  sshCommand?: string
  shellProgram?: string
  shellArgs?: string[]
  label?: string
  browserUrl?: string
}
```

- [ ] **Step 3: Extend SavedTabPanel type**

In `src/types/terminal.ts`, extend SavedTabPanel to support browser panels:

```typescript
export interface SavedTabPanel {
  panelId: string
  ptyId: string | null
  connection?: PanelConnection
}
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd /Users/handongho/ocp/v-terminal && npx tsc --noEmit`
Expected: No new type errors (existing errors may remain)

- [ ] **Step 5: Commit**

```bash
git add src/types/browser.ts src/types/terminal.ts
git commit -m "feat: add browser type definitions and extend PanelConnection"
```

---

### Task 2: Bookmark Store

**Files:**
- Create: `src/store/bookmarkStore.ts`

Follow the existing `sshStore.ts` pattern exactly.

- [ ] **Step 1: Create bookmarkStore**

```typescript
import { create } from "zustand"
import { v4 as uuidv4 } from "uuid"
import type { Bookmark } from "../types/browser"

const STORAGE_KEY = "v-terminal:bookmarks"

function load(): Bookmark[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function save(bookmarks: Bookmark[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks))
}

interface BookmarkStore {
  bookmarks: Bookmark[]
  addBookmark: (data: Omit<Bookmark, "id" | "createdAt">) => Bookmark
  removeBookmark: (id: string) => void
  updateBookmark: (id: string, updates: Partial<Omit<Bookmark, "id" | "createdAt">>) => void
  isBookmarked: (url: string) => boolean
  getBookmarkByUrl: (url: string) => Bookmark | undefined
}

export const useBookmarkStore = create<BookmarkStore>((set, get) => ({
  bookmarks: load(),

  addBookmark: (data) => {
    const bookmark: Bookmark = { ...data, id: uuidv4(), createdAt: Date.now() }
    set((s) => {
      const next = [...s.bookmarks, bookmark]
      save(next)
      return { bookmarks: next }
    })
    return bookmark
  },

  removeBookmark: (id) => {
    set((s) => {
      const next = s.bookmarks.filter((b) => b.id !== id)
      save(next)
      return { bookmarks: next }
    })
  },

  updateBookmark: (id, updates) => {
    set((s) => {
      const next = s.bookmarks.map((b) => (b.id === id ? { ...b, ...updates } : b))
      save(next)
      return { bookmarks: next }
    })
  },

  isBookmarked: (url) => get().bookmarks.some((b) => b.url === url),

  getBookmarkByUrl: (url) => get().bookmarks.find((b) => b.url === url),
}))
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/handongho/ocp/v-terminal && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/store/bookmarkStore.ts
git commit -m "feat: add bookmark store with localStorage persistence"
```

---

### Task 3: Browser History Store

**Files:**
- Create: `src/store/browserHistoryStore.ts`

- [ ] **Step 1: Create browserHistoryStore**

```typescript
import { create } from "zustand"
import type { BrowserHistoryEntry } from "../types/browser"

const STORAGE_KEY = "v-terminal:browser-history"
const MAX_ENTRIES_PER_TAB = 100

function loadAll(): Record<string, BrowserHistoryEntry[]> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveAll(data: Record<string, BrowserHistoryEntry[]>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

interface BrowserHistoryStore {
  historyByTab: Record<string, BrowserHistoryEntry[]>
  addEntry: (entry: Omit<BrowserHistoryEntry, "visitedAt">) => void
  getHistory: (tabId: string) => BrowserHistoryEntry[]
  clearHistory: (tabId: string) => void
  removeTabHistory: (tabId: string) => void
  searchHistory: (tabId: string, query: string) => BrowserHistoryEntry[]
}

export const useBrowserHistoryStore = create<BrowserHistoryStore>((set, get) => ({
  historyByTab: loadAll(),

  addEntry: (entry) => {
    set((s) => {
      const tabEntries = [...(s.historyByTab[entry.tabId] || [])]
      tabEntries.unshift({ ...entry, visitedAt: Date.now() })
      // Keep only MAX_ENTRIES_PER_TAB
      if (tabEntries.length > MAX_ENTRIES_PER_TAB) {
        tabEntries.length = MAX_ENTRIES_PER_TAB
      }
      const next = { ...s.historyByTab, [entry.tabId]: tabEntries }
      saveAll(next)
      return { historyByTab: next }
    })
  },

  getHistory: (tabId) => get().historyByTab[tabId] || [],

  clearHistory: (tabId) => {
    set((s) => {
      const next = { ...s.historyByTab, [tabId]: [] }
      saveAll(next)
      return { historyByTab: next }
    })
  },

  removeTabHistory: (tabId) => {
    set((s) => {
      const next = { ...s.historyByTab }
      delete next[tabId]
      saveAll(next)
      return { historyByTab: next }
    })
  },

  searchHistory: (tabId, query) => {
    const entries = get().historyByTab[tabId] || []
    const q = query.toLowerCase()
    return entries.filter(
      (e) => e.title.toLowerCase().includes(q) || e.url.toLowerCase().includes(q)
    )
  },
}))
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/handongho/ocp/v-terminal && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/store/browserHistoryStore.ts
git commit -m "feat: add browser history store with per-workspace storage"
```

---

### Task 4: Browser Panel State Store

**Files:**
- Create: `src/store/browserStore.ts`

- [ ] **Step 1: Create browserStore**

```typescript
import { create } from "zustand"
import type { BrowserPanelState } from "../types/browser"

interface BrowserStore {
  panels: Record<string, BrowserPanelState>
  setPanel: (panelId: string, state: BrowserPanelState) => void
  updatePanel: (panelId: string, updates: Partial<BrowserPanelState>) => void
  removePanel: (panelId: string) => void
  getPanel: (panelId: string) => BrowserPanelState | undefined
}

export const useBrowserStore = create<BrowserStore>((set, get) => ({
  panels: {},

  setPanel: (panelId, state) => {
    set((s) => ({ panels: { ...s.panels, [panelId]: state } }))
  },

  updatePanel: (panelId, updates) => {
    set((s) => {
      const existing = s.panels[panelId]
      if (!existing) return s
      return { panels: { ...s.panels, [panelId]: { ...existing, ...updates } } }
    })
  },

  removePanel: (panelId) => {
    set((s) => {
      const next = { ...s.panels }
      delete next[panelId]
      return { panels: next }
    })
  },

  getPanel: (panelId) => get().panels[panelId],
}))
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/handongho/ocp/v-terminal && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/store/browserStore.ts
git commit -m "feat: add browser panel state store"
```

---

### Task 5: Fix tabStore ptyId Filter

**Files:**
- Modify: `src/store/tabStore.ts`

The existing `saveAndRemoveTab` and `saveAllOpenTabsToBackground` filter panels by `ptyId !== null`, which would silently drop browser panels. Fix this.

- [ ] **Step 1: Update saveAndRemoveTab**

In `src/store/tabStore.ts`, find `saveAndRemoveTab`. The current code is:
```typescript
const activePanels = tab?.panels.filter((p) => p.ptyId !== null) ?? [];
if (tab && activePanels.length > 0) {
  // ... save logic
  panels: activePanels.map((p) => ({ panelId: p.id, ptyId: p.ptyId! })),
}
```

Change to:
```typescript
const savablePanels = tab?.panels.filter(
  (p) => p.ptyId !== null || p.connection?.type === 'browser'
) ?? [];
if (tab && savablePanels.length > 0) {
  // ... save logic
  panels: savablePanels.map((p) => ({
    panelId: p.id,
    ptyId: p.ptyId,  // null for browser panels
    connection: p.connection,
  })),
}
```

- [ ] **Step 2: Update saveAllOpenTabsToBackground**

Apply the same pattern change: filter includes browser panels, map includes `connection`, `ptyId` is `string | null`.

- [ ] **Step 3: Update restoreSavedTab**

When restoring a saved tab, browser panels need their connection restored but no PTY attached:

```typescript
// In restoreSavedTab, when building panels array:
panels: saved.panels.map((sp) => ({
  id: sp.panelId,
  ptyId: null,
  ...(sp.connection?.type === 'browser'
    ? { connection: sp.connection }  // restore browser connection
    : { existingSessionId: sp.ptyId ?? undefined }  // attach terminal PTY
  ),
}))
```

- [ ] **Step 4: Guard handleKillSavedTab against null ptyId**

In `App.tsx`, the `handleKillSavedTab` function calls `ipc.daemonKillSession(p.ptyId)` for each panel. Browser panels have `ptyId: null`. Add a guard:

```typescript
for (const p of tab.panels) {
  if (p.ptyId) {  // skip browser panels (ptyId is null)
    await ipc.daemonKillSession(p.ptyId)
  }
}
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd /Users/handongho/ocp/v-terminal && npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add src/store/tabStore.ts
git commit -m "fix: include browser panels in tab save/restore logic"
```

---

## Chunk 2: Rust Backend — Tauri Commands

### Task 6: Browser Commands (Rust)

**Files:**
- Create: `src-tauri/src/commands/browser_commands.rs`
- Modify: `src-tauri/src/commands/mod.rs`

- [ ] **Step 1: Create browser_commands.rs**

```rust
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::{AppHandle, Manager, Emitter, WebviewUrl, WebviewBuilder};

pub struct BrowserState {
    pub webviews: Mutex<HashMap<String, ()>>,
}

impl Default for BrowserState {
    fn default() -> Self {
        Self {
            webviews: Mutex::new(HashMap::new()),
        }
    }
}

#[tauri::command]
pub async fn create_browser_webview(
    app: AppHandle,
    panel_id: String,
    url: Option<String>,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
) -> Result<(), String> {
    let webview_url = match &url {
        Some(u) => WebviewUrl::External(u.parse().map_err(|e| format!("Invalid URL: {e}"))?),
        None => WebviewUrl::External("about:blank".parse().unwrap()),
    };

    let label = format!("browser-{panel_id}");
    let window = app.get_webview_window("main").ok_or("No main window")?;

    let builder = WebviewBuilder::new(&label, webview_url)
        .auto_resize();

    let webview = window
        .add_child(builder, tauri::LogicalPosition::new(x, y), tauri::LogicalSize::new(width, height))
        .map_err(|e| format!("Failed to create webview: {e}"))?;

    // Track navigation events with protocol restriction
    let app_handle = app.clone();
    let pid = panel_id.clone();
    webview.on_navigation(move |url| {
        // Security: block javascript: and data: URLs
        let scheme = url.scheme();
        if scheme == "javascript" || scheme == "data" {
            return false;
        }
        let _ = app_handle.emit("browser:url-changed", serde_json::json!({
            "panelId": pid,
            "url": url.to_string()
        }));
        true
    });

    // Inject title/loading observer script after page load
    // This script posts title changes back via a custom event
    let app_handle2 = app.clone();
    let pid2 = panel_id.clone();
    webview.on_page_load(move |_wv, event| {
        match event {
            tauri::webview::PageLoadEvent::Started => {
                let _ = app_handle2.emit("browser:loading-changed", serde_json::json!({
                    "panelId": pid2,
                    "isLoading": true
                }));
            }
            tauri::webview::PageLoadEvent::Finished => {
                let _ = app_handle2.emit("browser:loading-changed", serde_json::json!({
                    "panelId": pid2,
                    "isLoading": false
                }));
                // Extract title via eval after page load
                let app_for_title = app_handle2.clone();
                let pid_for_title = pid2.clone();
                if let Some(wv) = app_for_title.get_webview(&format!("browser-{pid_for_title}")) {
                    let _ = wv.eval(&format!(
                        r#"window.__VTERMINAL_EMIT_TITLE = function() {{
                            // Use postMessage to communicate title (no Tauri IPC needed)
                        }};
                        document.addEventListener('DOMContentLoaded', function() {{
                            // Title is already available at this point
                        }});"#
                    ));
                }
            }
        }
    });

    let state = app.state::<BrowserState>();
    state.webviews.lock().unwrap().insert(panel_id, ());

    Ok(())
}

#[tauri::command]
pub async fn navigate_browser(
    app: AppHandle,
    panel_id: String,
    url: String,
) -> Result<(), String> {
    let label = format!("browser-{panel_id}");
    let webview = app.get_webview(&label).ok_or("WebView not found")?;
    let parsed: url::Url = url.parse().map_err(|e| format!("Invalid URL: {e}"))?;
    webview.navigate(parsed).map_err(|e| format!("Navigation failed: {e}"))
}

#[tauri::command]
pub async fn close_browser_webview(
    app: AppHandle,
    panel_id: String,
) -> Result<(), String> {
    let label = format!("browser-{panel_id}");
    if let Some(webview) = app.get_webview(&label) {
        webview.close().map_err(|e| format!("Close failed: {e}"))?;
    }
    let state = app.state::<BrowserState>();
    state.webviews.lock().unwrap().remove(&panel_id);
    Ok(())
}

#[tauri::command]
pub async fn set_browser_bounds(
    app: AppHandle,
    panel_id: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
) -> Result<(), String> {
    let label = format!("browser-{panel_id}");
    let webview = app.get_webview(&label).ok_or("WebView not found")?;
    webview.set_position(tauri::LogicalPosition::new(x, y))
        .map_err(|e| format!("Set position failed: {e}"))?;
    webview.set_size(tauri::LogicalSize::new(width, height))
        .map_err(|e| format!("Set size failed: {e}"))?;
    Ok(())
}

#[tauri::command]
pub async fn show_browser_webview(
    app: AppHandle,
    panel_id: String,
) -> Result<(), String> {
    let label = format!("browser-{panel_id}");
    if let Some(webview) = app.get_webview(&label) {
        webview.show().map_err(|e| format!("Show failed: {e}"))?;
    }
    Ok(())
}

#[tauri::command]
pub async fn hide_browser_webview(
    app: AppHandle,
    panel_id: String,
) -> Result<(), String> {
    let label = format!("browser-{panel_id}");
    if let Some(webview) = app.get_webview(&label) {
        webview.hide().map_err(|e| format!("Hide failed: {e}"))?;
    }
    Ok(())
}

#[tauri::command]
pub async fn browser_go_back(
    app: AppHandle,
    panel_id: String,
) -> Result<(), String> {
    let label = format!("browser-{panel_id}");
    let webview = app.get_webview(&label).ok_or("WebView not found")?;
    webview.eval("window.history.back()")
        .map_err(|e| format!("Go back failed: {e}"))
}

#[tauri::command]
pub async fn browser_go_forward(
    app: AppHandle,
    panel_id: String,
) -> Result<(), String> {
    let label = format!("browser-{panel_id}");
    let webview = app.get_webview(&label).ok_or("WebView not found")?;
    webview.eval("window.history.forward()")
        .map_err(|e| format!("Go forward failed: {e}"))
}

#[tauri::command]
pub async fn browser_reload(
    app: AppHandle,
    panel_id: String,
) -> Result<(), String> {
    let label = format!("browser-{panel_id}");
    let webview = app.get_webview(&label).ok_or("WebView not found")?;
    webview.eval("window.location.reload()")
        .map_err(|e| format!("Reload failed: {e}"))
}

#[tauri::command]
pub async fn browser_get_title(
    app: AppHandle,
    panel_id: String,
) -> Result<String, String> {
    let label = format!("browser-{panel_id}");
    let webview = app.get_webview(&label).ok_or("WebView not found")?;
    webview.eval("document.title")
        .map_err(|e| format!("Get title failed: {e}"))?;
    // Title will be returned via event; return empty for now
    Ok(String::new())
}
```

> **Implementation Notes:**
> - `go_back`, `go_forward`, `reload`은 `eval()`로 JavaScript를 실행하는 방식이다. 같은 origin 내에서는 동작하지만, cross-origin 환경에서는 제한될 수 있다. 실제 Tauri 2 / wry API에서 네이티브 `navigate_back()`, `navigate_forward()`, `reload()` 메서드가 제공되는지 먼저 확인하고, 있으면 교체한다.
> - `browser_get_title`은 `on_page_load` 콜백에서 처리하므로 별도 command로는 사용하지 않을 수 있다. 페이지 타이틀은 `on_page_load(Finished)` 후 `eval("document.title")`로 추출하여 이벤트로 전달한다.
> - **Security:** 브라우저 WebView는 `capabilities/default.json`의 `windows` 배열에 등록하지 않는다 (현재 `"main"`만 등록됨). 이로써 브라우저 WebView에서 Tauri IPC 호출이 차단된다. Task 7에서 이를 명시적으로 검증할 것.

- [ ] **Step 2: Export browser_commands in mod.rs**

In `src-tauri/src/commands/mod.rs`, add:

```rust
pub mod browser_commands;
```

- [ ] **Step 3: Verify Rust compiles**

Run: `cd /Users/handongho/ocp/v-terminal && cargo check --manifest-path src-tauri/Cargo.toml`
Fix any compilation errors (imports, API changes, etc.)

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/commands/browser_commands.rs src-tauri/src/commands/mod.rs
git commit -m "feat: add Rust browser commands for WebView lifecycle"
```

---

### Task 7: Register Commands & Add Capabilities

**Files:**
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/capabilities/default.json`

- [ ] **Step 1: Register BrowserState and commands in lib.rs**

In `src-tauri/src/lib.rs`:

Add `use commands::browser_commands::BrowserState;` to imports.

Add `.manage(BrowserState::default())` after existing `.manage(app_state)`.

Add all browser commands to `generate_handler![]`:
```rust
browser_commands::create_browser_webview,
browser_commands::navigate_browser,
browser_commands::close_browser_webview,
browser_commands::set_browser_bounds,
browser_commands::show_browser_webview,
browser_commands::hide_browser_webview,
browser_commands::browser_go_back,
browser_commands::browser_go_forward,
browser_commands::browser_reload,
browser_commands::browser_get_title,
```

- [ ] **Step 2: Add WebView capabilities**

In `src-tauri/capabilities/default.json`, add to the `permissions` array:

```json
"core:webview:allow-create-webview",
"core:webview:allow-set-webview-position",
"core:webview:allow-set-webview-size",
"core:webview:allow-webview-close",
"core:webview:allow-set-webview-focus",
"core:webview:allow-webview-show",
"core:webview:allow-webview-hide"
```

- [ ] **Step 3: Add `url` crate dependency**

In `src-tauri/Cargo.toml`, add to `[dependencies]`:
```toml
url = "2"
```

- [ ] **Step 4: Verify browser WebView IPC isolation**

Confirm that `src-tauri/capabilities/default.json` only lists `"main"` in the `windows` array. Browser WebView labels (`browser-{panelId}`) should NOT be added here. This ensures browser webviews cannot call Tauri IPC commands.

- [ ] **Step 5: Verify Rust compiles**

Run: `cd /Users/handongho/ocp/v-terminal && cargo check --manifest-path src-tauri/Cargo.toml`

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/lib.rs src-tauri/capabilities/default.json src-tauri/Cargo.toml
git commit -m "feat: register browser commands, add webview capabilities, add url dep"
```

---

### Task 8: Frontend Browser IPC

**Files:**
- Create: `src/lib/browserIpc.ts`

- [ ] **Step 1: Create browserIpc.ts**

```typescript
import { invoke } from "@tauri-apps/api/core"
import { listen, type UnlistenFn } from "@tauri-apps/api/event"

export const browserIpc = {
  async createWebview(panelId: string, url: string | null, x: number, y: number, width: number, height: number): Promise<void> {
    return invoke("create_browser_webview", { panelId, url, x, y, width, height })
  },

  async navigate(panelId: string, url: string): Promise<void> {
    return invoke("navigate_browser", { panelId, url })
  },

  async close(panelId: string): Promise<void> {
    return invoke("close_browser_webview", { panelId })
  },

  async setBounds(panelId: string, x: number, y: number, width: number, height: number): Promise<void> {
    return invoke("set_browser_bounds", { panelId, x, y, width, height })
  },

  async show(panelId: string): Promise<void> {
    return invoke("show_browser_webview", { panelId })
  },

  async hide(panelId: string): Promise<void> {
    return invoke("hide_browser_webview", { panelId })
  },

  async goBack(panelId: string): Promise<void> {
    return invoke("browser_go_back", { panelId })
  },

  async goForward(panelId: string): Promise<void> {
    return invoke("browser_go_forward", { panelId })
  },

  async reload(panelId: string): Promise<void> {
    return invoke("browser_reload", { panelId })
  },

  async onUrlChanged(handler: (data: { panelId: string; url: string }) => void): Promise<UnlistenFn> {
    return listen("browser:url-changed", (event) => handler(event.payload as any))
  },

  async onTitleChanged(handler: (data: { panelId: string; title: string }) => void): Promise<UnlistenFn> {
    return listen("browser:title-changed", (event) => handler(event.payload as any))
  },

  async onLoadingChanged(handler: (data: { panelId: string; isLoading: boolean }) => void): Promise<UnlistenFn> {
    return listen("browser:loading-changed", (event) => handler(event.payload as any))
  },
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/handongho/ocp/v-terminal && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/lib/browserIpc.ts
git commit -m "feat: add frontend IPC wrapper for browser commands"
```

---

## Chunk 3: Browser Panel UI Components

### Task 9: BrowserUrlBar Component

**Files:**
- Create: `src/components/BrowserPane/BrowserUrlBar.tsx`

- [ ] **Step 1: Create BrowserUrlBar**

```typescript
import { useState, useRef, useCallback } from "react"

interface BrowserUrlBarProps {
  url: string
  isLoading: boolean
  canGoBack: boolean
  canGoForward: boolean
  isBookmarked: boolean
  onNavigate: (url: string) => void
  onGoBack: () => void
  onGoForward: () => void
  onReload: () => void
  onToggleBookmark: () => void
}

export function BrowserUrlBar({
  url, isLoading, canGoBack, canGoForward, isBookmarked,
  onNavigate, onGoBack, onGoForward, onReload, onToggleBookmark,
}: BrowserUrlBarProps) {
  const [editing, setEditing] = useState(false)
  const [inputValue, setInputValue] = useState(url)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFocus = useCallback(() => {
    setEditing(true)
    setInputValue(url)
    setTimeout(() => inputRef.current?.select(), 0)
  }, [url])

  const handleSubmit = useCallback(() => {
    setEditing(false)
    let finalUrl = inputValue.trim()
    if (finalUrl && !finalUrl.match(/^https?:\/\//)) {
      finalUrl = `https://${finalUrl}`
    }
    if (finalUrl) onNavigate(finalUrl)
  }, [inputValue, onNavigate])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault()
      handleSubmit()
    } else if (e.key === "Escape") {
      setEditing(false)
      setInputValue(url)
      // Return focus to webview via parent
    }
  }, [handleSubmit, url])

  return (
    <div className="browser-url-bar">
      <div className="browser-nav-buttons">
        <button
          className="browser-nav-btn"
          disabled={!canGoBack}
          onClick={onGoBack}
          title="Go Back"
        >
          ←
        </button>
        <button
          className="browser-nav-btn"
          disabled={!canGoForward}
          onClick={onGoForward}
          title="Go Forward"
        >
          →
        </button>
        <button
          className="browser-nav-btn"
          onClick={onReload}
          title="Reload"
        >
          ↻
        </button>
      </div>
      <input
        ref={inputRef}
        className="browser-url-input"
        type="text"
        value={editing ? inputValue : url}
        onChange={(e) => setInputValue(e.target.value)}
        onFocus={handleFocus}
        onBlur={() => setEditing(false)}
        onKeyDown={handleKeyDown}
        placeholder="Enter URL or search..."
        spellCheck={false}
      />
      <button
        className="browser-bookmark-btn"
        onClick={onToggleBookmark}
        title={isBookmarked ? "Remove Bookmark" : "Add Bookmark"}
      >
        {isBookmarked ? "★" : "☆"}
      </button>
      {isLoading && <div className="browser-loading-bar" />}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

- [ ] **Step 3: Commit**

```bash
git add src/components/BrowserPane/BrowserUrlBar.tsx
git commit -m "feat: add BrowserUrlBar component"
```

---

### Task 10: BrowserEmptyState Component

**Files:**
- Create: `src/components/BrowserPane/BrowserEmptyState.tsx`

- [ ] **Step 1: Create BrowserEmptyState**

```typescript
import { useMemo } from "react"
import { useBookmarkStore } from "../../store/bookmarkStore"
import { useBrowserHistoryStore } from "../../store/browserHistoryStore"
import type { Bookmark, BrowserHistoryEntry } from "../../types/browser"

interface BrowserEmptyStateProps {
  tabId: string
  onNavigate: (url: string) => void
}

function faviconUrl(url: string): string {
  try {
    const { origin } = new URL(url)
    return `${origin}/favicon.ico`
  } catch {
    return ""
  }
}

function domainInitial(url: string): string {
  try {
    return new URL(url).hostname.charAt(0).toUpperCase()
  } catch {
    return "?"
  }
}

function timeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp
  const minutes = Math.floor(diff / 60000)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function BrowserEmptyState({ tabId, onNavigate }: BrowserEmptyStateProps) {
  const bookmarks = useBookmarkStore((s) => s.bookmarks)
  const history = useBrowserHistoryStore((s) => s.getHistory(tabId))

  return (
    <div className="browser-empty-state">
      {bookmarks.length > 0 && (
        <div className="browser-empty-section">
          <div className="browser-empty-label">Bookmarks</div>
          <div className="browser-bookmarks-grid">
            {bookmarks.map((b) => (
              <button
                key={b.id}
                className="browser-bookmark-tile"
                onClick={() => onNavigate(b.url)}
              >
                <div className="browser-bookmark-icon">
                  <img
                    src={b.favicon || faviconUrl(b.url)}
                    alt=""
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none"
                      ;(e.target as HTMLImageElement).nextElementSibling
                        ?.classList.add("visible")
                    }}
                  />
                  <span className="browser-bookmark-initial">
                    {domainInitial(b.url)}
                  </span>
                </div>
                <span className="browser-bookmark-name">{b.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {history.length > 0 && (
        <div className="browser-empty-section">
          <div className="browser-empty-label">Recent in this Workspace</div>
          <div className="browser-history-list">
            {history.slice(0, 10).map((h, i) => (
              <button
                key={`${h.url}-${i}`}
                className="browser-history-item"
                onClick={() => onNavigate(h.url)}
              >
                <span className="browser-history-icon">📄</span>
                <div className="browser-history-info">
                  <span className="browser-history-title">{h.title || h.url}</span>
                  <span className="browser-history-meta">
                    {new URL(h.url).hostname} · {timeAgo(h.visitedAt)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {bookmarks.length === 0 && history.length === 0 && (
        <div className="browser-empty-placeholder">
          Enter a URL above to get started
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

- [ ] **Step 3: Commit**

```bash
git add src/components/BrowserPane/BrowserEmptyState.tsx
git commit -m "feat: add BrowserEmptyState component with bookmarks and history"
```

---

### Task 11: BrowserErrorState Component

**Files:**
- Create: `src/components/BrowserPane/BrowserErrorState.tsx`

- [ ] **Step 1: Create BrowserErrorState**

```typescript
interface BrowserErrorStateProps {
  error: string
  onRetry: () => void
}

export function BrowserErrorState({ error, onRetry }: BrowserErrorStateProps) {
  return (
    <div className="browser-error-state">
      <div className="browser-error-icon">⚠</div>
      <div className="browser-error-message">{error}</div>
      <button className="browser-error-retry" onClick={onRetry}>
        Retry
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/BrowserPane/BrowserErrorState.tsx
git commit -m "feat: add BrowserErrorState component"
```

---

### Task 12: BrowserPane Component + Styles

**Files:**
- Create: `src/components/BrowserPane/BrowserPane.tsx`
- Create: `src/components/BrowserPane/BrowserPane.css`

This is the main component that orchestrates URL bar, empty state, error state, and WebView positioning.

- [ ] **Step 1: Create BrowserPane.tsx**

```typescript
import { useRef, useEffect, useCallback, useState } from "react"
import { BrowserUrlBar } from "./BrowserUrlBar"
import { BrowserEmptyState } from "./BrowserEmptyState"
import { BrowserErrorState } from "./BrowserErrorState"
import { browserIpc } from "../../lib/browserIpc"
import { useBrowserStore } from "../../store/browserStore"
import { useBookmarkStore } from "../../store/bookmarkStore"
import { useBrowserHistoryStore } from "../../store/browserHistoryStore"
import "./BrowserPane.css"

interface BrowserPaneProps {
  panelId: string
  tabId: string
  initialUrl?: string
  isActive: boolean
  isVisible: boolean // false when tab is inactive or overlay is open
  onFocus: () => void
}

export function BrowserPane({
  panelId, tabId, initialUrl, isActive, isVisible, onFocus,
}: BrowserPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [webviewCreated, setWebviewCreated] = useState(false)
  const [showEmptyState, setShowEmptyState] = useState(!initialUrl)

  const panelState = useBrowserStore((s) => s.panels[panelId])
  const setPanel = useBrowserStore((s) => s.setPanel)
  const updatePanel = useBrowserStore((s) => s.updatePanel)
  const removePanel = useBrowserStore((s) => s.removePanel)

  const isBookmarked = useBookmarkStore((s) => s.isBookmarked(panelState?.url || ""))
  const addBookmark = useBookmarkStore((s) => s.addBookmark)
  const removeBookmark = useBookmarkStore((s) => s.removeBookmark)
  const getBookmarkByUrl = useBookmarkStore((s) => s.getBookmarkByUrl)

  const addHistoryEntry = useBrowserHistoryStore((s) => s.addEntry)

  // Initialize panel state
  useEffect(() => {
    setPanel(panelId, {
      panelId,
      url: initialUrl || "",
      title: "",
      isLoading: false,
      canGoBack: false,
      canGoForward: false,
    })
    return () => removePanel(panelId)
  }, [panelId])

  // Create WebView and sync position
  const syncBounds = useCallback(() => {
    if (!containerRef.current || !webviewCreated) return
    const rect = containerRef.current.getBoundingClientRect()
    browserIpc.setBounds(panelId, rect.x, rect.y, rect.width, rect.height)
  }, [panelId, webviewCreated])

  // ResizeObserver for position sync
  useEffect(() => {
    if (!containerRef.current || !webviewCreated) return
    const observer = new ResizeObserver(syncBounds)
    observer.observe(containerRef.current)
    window.addEventListener("resize", syncBounds)
    return () => {
      observer.disconnect()
      window.removeEventListener("resize", syncBounds)
    }
  }, [syncBounds, webviewCreated])

  // Show/hide based on visibility
  useEffect(() => {
    if (!webviewCreated) return
    if (isVisible) {
      browserIpc.show(panelId)
      syncBounds()
    } else {
      browserIpc.hide(panelId)
    }
  }, [isVisible, webviewCreated, panelId, syncBounds])

  // Listen for navigation events
  useEffect(() => {
    const unlisteners: (() => void)[] = []

    browserIpc.onUrlChanged((data) => {
      if (data.panelId !== panelId) return
      updatePanel(panelId, { url: data.url })
      addHistoryEntry({ url: data.url, title: "", tabId, favicon: undefined })
    }).then((u) => unlisteners.push(u))

    browserIpc.onTitleChanged((data) => {
      if (data.panelId !== panelId) return
      updatePanel(panelId, { title: data.title })
    }).then((u) => unlisteners.push(u))

    browserIpc.onLoadingChanged((data) => {
      if (data.panelId !== panelId) return
      updatePanel(panelId, { isLoading: data.isLoading })
    }).then((u) => unlisteners.push(u))

    return () => unlisteners.forEach((u) => u())
  }, [panelId, tabId])

  // Cleanup WebView on unmount
  useEffect(() => {
    return () => {
      browserIpc.close(panelId)
    }
  }, [panelId])

  const handleNavigate = useCallback(async (url: string) => {
    if (!webviewCreated) {
      // Create WebView for the first time
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return
      try {
        await browserIpc.createWebview(panelId, url, rect.x, rect.y, rect.width, rect.height)
        setWebviewCreated(true)
        setShowEmptyState(false)
        updatePanel(panelId, { url, isLoading: true })
      } catch (e) {
        updatePanel(panelId, { error: String(e) })
      }
    } else {
      setShowEmptyState(false)
      updatePanel(panelId, { url, isLoading: true })
      await browserIpc.navigate(panelId, url)
    }
  }, [panelId, webviewCreated])

  const handleToggleBookmark = useCallback(() => {
    if (!panelState?.url) return
    const existing = getBookmarkByUrl(panelState.url)
    if (existing) {
      removeBookmark(existing.id)
    } else {
      const favicon = `${new URL(panelState.url).origin}/favicon.ico`
      addBookmark({
        name: panelState.title || panelState.url,
        url: panelState.url,
        favicon,
      })
    }
  }, [panelState?.url, panelState?.title])

  const handleRetry = useCallback(() => {
    updatePanel(panelId, { error: undefined })
    if (panelState?.url) handleNavigate(panelState.url)
  }, [panelState?.url, handleNavigate])

  return (
    <div
      ref={containerRef}
      className={`browser-pane ${isActive ? "active" : ""}`}
      onClick={onFocus}
    >
      <BrowserUrlBar
        url={panelState?.url || ""}
        isLoading={panelState?.isLoading || false}
        canGoBack={panelState?.canGoBack || false}
        canGoForward={panelState?.canGoForward || false}
        isBookmarked={isBookmarked}
        onNavigate={handleNavigate}
        onGoBack={() => browserIpc.goBack(panelId)}
        onGoForward={() => browserIpc.goForward(panelId)}
        onReload={() => browserIpc.reload(panelId)}
        onToggleBookmark={handleToggleBookmark}
      />

      <div className="browser-content">
        {panelState?.error ? (
          <BrowserErrorState error={panelState.error} onRetry={handleRetry} />
        ) : showEmptyState ? (
          <BrowserEmptyState tabId={tabId} onNavigate={handleNavigate} />
        ) : null}
        {/* WebView renders as native overlay on top of this area */}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create BrowserPane.css**

Create `src/components/BrowserPane/BrowserPane.css` with styles for:
- `.browser-pane` — full-height flex column
- `.browser-url-bar` — HIG-compliant toolbar with nav buttons, URL input, bookmark star
- `.browser-loading-bar` — thin animated progress bar
- `.browser-content` — flex-1 area for empty/error state (WebView overlays this natively)
- `.browser-empty-state` — bookmarks grid + history list
- `.browser-error-state` — centered error message + retry
- `.browser-nav-btn` — 28px circular buttons
- `.browser-url-input` — rounded input field
- `.browser-bookmark-btn` — star button, gold when active
- `.browser-bookmark-tile` — grid tile for empty state bookmarks
- `.browser-history-item` — list item for recent pages

All styles should use existing CSS custom properties from `theme.css` (e.g., `var(--bg-primary)`, `var(--text-primary)`, etc.) and follow Apple HIG spacing (4px grid).

- [ ] **Step 3: Verify TypeScript compiles and dev server starts**

Run: `cd /Users/handongho/ocp/v-terminal && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add src/components/BrowserPane/
git commit -m "feat: add BrowserPane component with URL bar, empty state, and error handling"
```

---

## Chunk 4: Integration — PanelGrid, SessionPicker, Context Menu

### Task 13: PanelGrid Conditional Rendering

**Files:**
- Modify: `src/components/PanelGrid/PanelGrid.tsx`

- [ ] **Step 1: Import BrowserPane**

Add import at top:
```typescript
import { BrowserPane } from "../BrowserPane/BrowserPane"
```

- [ ] **Step 2: Add isVisible prop to PanelGrid**

PanelGrid currently receives `tab: Tab` (not separate `tabId`). Add two new props:

```typescript
interface PanelGridProps {
  // ... existing props
  isVisible: boolean  // false when tab is inactive or overlay is open
}
```

In `App.tsx`, compute and pass:
```typescript
const isOverlayOpen = paletteOpen || sshModalOpen || settingsModalOpen || bookmarkModalOpen
// ...
<PanelGrid
  // ... existing props
  isVisible={tab.id === activeTabId && !isOverlayOpen}
/>
```

- [ ] **Step 3: Add conditional rendering in panel loop**

In PanelGrid's panel rendering section (where `<TerminalPane>` is rendered), add a condition. Use `tab.id` (not a separate `tabId` prop) and existing `setActivePanelId` pattern:

```typescript
{panel.connection?.type === "browser" ? (
  <BrowserPane
    panelId={panel.id}
    tabId={tab.id}
    initialUrl={panel.connection.browserUrl}
    isActive={activePanelId === panel.id}
    isVisible={isVisible}
    onFocus={() => setActivePanelId(panel.id)}
  />
) : (
  <TerminalPane
    // ... existing props
  />
)}
```

- [ ] **Step 4: Verify dev server starts and terminal panels still work**

Run: `cd /Users/handongho/ocp/v-terminal && pnpm tauri dev`
Verify existing terminal functionality is not broken.

- [ ] **Step 5: Commit**

```bash
git add src/components/PanelGrid/PanelGrid.tsx src/App.tsx
git commit -m "feat: add conditional BrowserPane rendering in PanelGrid"
```

---

### Task 14: Session Picker Browser Option

**Files:**
- Modify: `src/components/SessionPicker/SessionPicker.tsx`

- [ ] **Step 1: Extend ConnectionOption type**

In `SessionPicker.tsx`, the `ConnectionOption` interface has `type: "local" | "ssh" | "wsl"`. Add `"browser"`:

```typescript
type: "local" | "ssh" | "wsl" | "browser"
```

- [ ] **Step 2: Add Browser to connection options list**

Find where connection options are defined and add:

```typescript
{ label: "Browser", type: "browser", icon: /* SVG icon matching existing style */, description: "Open a web page" }
```

Use an inline SVG globe icon (not emoji) to match existing option styling.

- [ ] **Step 3: Update optionToConnection for browser type**

In the `optionToConnection` function, add the browser case:

```typescript
case "browser":
  return { type: "browser", label: "Browser" }
```

- [ ] **Step 4: Add URL input when Browser is selected**

When the user selects "Browser" as connection type, show an optional URL input field below the connection grid. If left empty, the browser opens with Empty State.

Store the URL in `browserUrl` field of PanelConnection:
```typescript
case "browser":
  return { type: "browser", label: "Browser", browserUrl: urlInput || undefined }
```

- [ ] **Step 5: Handle Per-Panel mode for browser**

In the `PanelConfigGrid` component, browser panels don't need PTY sessions. When `resolveSessionPick` is called with browser connections, the resulting panels should have `ptyId: null` and `connection.type: "browser"`. No daemon session creation should be triggered for these panels.

- [ ] **Step 4: Test in dev mode**

Run: `pnpm tauri dev`
Create a new tab → select Browser → verify it opens a browser panel.

- [ ] **Step 5: Commit**

```bash
git add src/components/SessionPicker/SessionPicker.tsx
git commit -m "feat: add Browser option to Session Picker"
```

---

### Task 15: Panel Context Menu

**Files:**
- Create: `src/components/PanelContextMenu/PanelContextMenu.tsx`
- Create: `src/components/PanelContextMenu/PanelContextMenu.css`

- [ ] **Step 1: Create PanelContextMenu component**

Follow the SplitToolbar menu pattern (portal to document.body, position from click coordinates).

```typescript
import { createPortal } from "react-dom"
import type { PanelConnection } from "../../types/terminal"

interface PanelContextMenuProps {
  x: number
  y: number
  onSwitchConnection: (connection: PanelConnection) => void
  onClose: () => void
}

export function PanelContextMenu({ x, y, onSwitchConnection, onClose }: PanelContextMenuProps) {
  // Render portal with "Switch Connection" submenu
  // Options: Local Shell, WSL, SSH, Browser
  // Escape key and outside-click close
}
```

- [ ] **Step 2: Create PanelContextMenu.css**

Style to match existing SplitToolbar menu aesthetic (frosted glass, rounded corners, Apple HIG).

- [ ] **Step 3: Wire up in PanelGrid**

Add `onContextMenu` handler to each panel wrapper div:
- Prevent default
- Show PanelContextMenu at click position
- On "Switch Connection" selection, update panel's connection type via tabStore

- [ ] **Step 4: Implement connection switch logic in tabStore**

Add `switchPanelConnection(tabId, panelId, connection)` action to tabStore. This:
- If old connection is terminal: calls cleanup (clearPtyId, kill session via daemon)
- If old connection is browser: calls browserIpc.close()
- Sets new connection on panel
- Resets ptyId to null for browser panels

- [ ] **Step 5: Test context menu in dev mode**

Right-click on a terminal panel → Switch Connection → Browser → verify panel switches.

- [ ] **Step 6: Commit**

```bash
git add src/components/PanelContextMenu/ src/components/PanelGrid/PanelGrid.tsx src/store/tabStore.ts
git commit -m "feat: add panel context menu with Switch Connection"
```

---

## Chunk 5: Command Palette, Bookmark Manager & Overlay Management

### Task 16: Bookmark Manager Modal

**Files:**
- Create: `src/components/BookmarkManager/BookmarkManagerModal.tsx`
- Create: `src/components/BookmarkManager/BookmarkManagerModal.css`

Follow SSH Manager Modal pattern.

- [ ] **Step 1: Create BookmarkManagerModal**

```typescript
import { useState } from "react"
import { useBookmarkStore } from "../../store/bookmarkStore"
import "./BookmarkManagerModal.css"

interface BookmarkManagerModalProps {
  onClose: () => void
}

export function BookmarkManagerModal({ onClose }: BookmarkManagerModalProps) {
  // Left panel: bookmark list
  // Right panel: edit form (name, URL)
  // Footer: Close, Delete, Save buttons
  // Add Bookmark button at bottom of list
  // ESC to close
}
```

- [ ] **Step 2: Create CSS following SshManagerModal styling**

- [ ] **Step 3: Wire up in App.tsx**

Add `bookmarkModalOpen` state. Render `BookmarkManagerModal` conditionally.

- [ ] **Step 4: Test in dev mode**

Open bookmark manager → add/edit/delete bookmarks → verify persistence.

- [ ] **Step 5: Commit**

```bash
git add src/components/BookmarkManager/ src/App.tsx
git commit -m "feat: add BookmarkManagerModal"
```

---

### Task 17: SplitToolbar "Manage Bookmarks" Menu Item

**Files:**
- Modify: `src/components/SplitToolbar/SplitToolbar.tsx`

- [ ] **Step 1: Add "Manage Bookmarks" item to More menu**

Add between "SSH Profiles" and "Toolkit" in the more menu:

```typescript
<button onClick={() => { setMenuOpen(false); onOpenBookmarkManager() }}>
  <span className="toolbar-icon">🔖</span>
  Bookmarks
</button>
```

- [ ] **Step 2: Add onOpenBookmarkManager prop**

Add `onOpenBookmarkManager: () => void` to SplitToolbar props. Wire up from App.tsx.

- [ ] **Step 3: Commit**

```bash
git add src/components/SplitToolbar/SplitToolbar.tsx src/App.tsx
git commit -m "feat: add Manage Bookmarks to SplitToolbar menu"
```

---

### Task 18: Command Palette Browser Commands

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add browser-specific palette section**

Create a new `useMemo<PaletteSection>` that builds browser commands. This section is only included when the active panel's connection type is `'browser'`:

```typescript
const browserSection = useMemo<PaletteSection | null>(() => {
  const activePanel = /* get current active panel */
  if (activePanel?.connection?.type !== "browser") return null

  return {
    category: "Browser",
    commands: [
      { id: "browser-back", label: "Go Back", icon: "←", action: () => browserIpc.goBack(activePanel.id) },
      { id: "browser-forward", label: "Go Forward", icon: "→", action: () => browserIpc.goForward(activePanel.id) },
      { id: "browser-reload", label: "Reload Page", icon: "↻", action: () => browserIpc.reload(activePanel.id) },
      { id: "browser-bookmark", label: isBookmarked ? "Remove from Bookmarks" : "Add to Bookmarks", icon: isBookmarked ? "★" : "☆", action: toggleBookmark },
      { id: "browser-manage-bookmarks", label: "Manage Bookmarks", icon: "🔖", action: () => setBookmarkModalOpen(true) },
    ],
  }
}, [activePanel, isBookmarked])
```

- [ ] **Step 2: Add "Switch Panel" commands (always visible)**

Add to the existing Tab section or a new section:

```typescript
{ id: "switch-browser", label: "Switch Panel → Browser", icon: "🌐", action: () => switchActivePanel("browser") },
{ id: "switch-terminal", label: "Switch Panel → Terminal", icon: "💻", action: () => switchActivePanel("local") },
```

- [ ] **Step 3: Add browser history to palette search results**

When a search query is entered, also search browser history for the current workspace and include matching entries as commands that navigate to the URL.

- [ ] **Step 4: Test command palette integration**

Focus a browser panel → Ctrl+K → verify browser commands appear.
Focus a terminal panel → Ctrl+K → verify browser commands are hidden.
Type a search query → verify browser history appears.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "feat: add browser commands and history search to command palette"
```

---

### Task 19: Overlay Z-Order Management

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add isOverlayOpen state**

Create a derived state or dedicated flag that is `true` when any modal or overlay is open:

```typescript
const isOverlayOpen = paletteOpen || sshModalOpen || settingsModalOpen || bookmarkModalOpen
```

- [ ] **Step 2: Pass to PanelGrid**

Pass `isOverlayOpen` to `<PanelGrid>` so `BrowserPane` can hide WebViews when overlays are visible.

- [ ] **Step 3: Test z-order behavior**

1. Open a browser panel with a page loaded
2. Press Ctrl+K → verify WebView hides, command palette is fully visible
3. Close command palette → verify WebView reappears
4. Repeat with Settings modal, SSH modal, Bookmark modal

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx src/components/PanelGrid/PanelGrid.tsx
git commit -m "feat: hide browser WebViews when overlay/modal is open"
```

---

### Task 20: Tab Cleanup — Remove History on Tab Delete

**Files:**
- Modify: `src/store/tabStore.ts`
- Modify: `src/App.tsx` (or wherever tab removal triggers cleanup)

- [ ] **Step 1: Clean up browser resources when tab is removed**

When a tab is permanently removed (not backgrounded), clean up:
- Close all browser WebViews for that tab's panels
- Remove workspace history via `browserHistoryStore.removeTabHistory(tabId)`

- [ ] **Step 2: Clean up on panel removal during layout change**

When `setLayout` returns `removed` panels, close browser WebViews for any removed browser panels.

- [ ] **Step 3: Test lifecycle**

1. Create browser panel → navigate to a page
2. Close tab → verify WebView is destroyed and history is cleaned
3. Change layout to fewer panels → verify removed browser panels are cleaned

- [ ] **Step 4: Commit**

```bash
git add src/store/tabStore.ts src/App.tsx
git commit -m "feat: clean up browser resources on tab/panel removal"
```

---

## Final Integration Test

After all tasks are complete:

- [ ] **Test 1: New tab with browser** — Create new tab → select layout → choose Browser connection → verify empty state with bookmarks
- [ ] **Test 2: Navigate** — Enter URL in URL bar → verify page loads in WebView
- [ ] **Test 3: Bookmark flow** — Click ☆ → verify ★ → open Manage Bookmarks → verify listed → delete → verify ☆
- [ ] **Test 4: Multi-panel** — Create 2-panel layout (Terminal + Browser) → verify both work side by side
- [ ] **Test 5: Panel switch** — Right-click terminal panel → Switch Connection → Browser → verify switch
- [ ] **Test 6: Command palette** — Focus browser panel → Ctrl+K → verify Go Back, Reload, etc. appear
- [ ] **Test 7: History** — Navigate to pages → close browser panel → Ctrl+K → search → verify history items appear
- [ ] **Test 8: Tab switch** — Open two tabs, one with browser → switch tabs → verify WebView hides/shows correctly
- [ ] **Test 9: Overlay z-order** — Load page in browser panel → open Settings → verify WebView hidden behind modal
- [ ] **Test 10: Save/restore** — Create tab with browser → close tab to background → restore → verify browser panel recovers
