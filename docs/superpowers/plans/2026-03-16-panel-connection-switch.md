# Panel Connection Switch Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to replace the active panel's connection (Local, WSL, SSH, Browser) via Command Palette `#` prefix or right-click context menu.

**Architecture:** Extend the existing `switchPanelConnection()` store action with dynamic connection lists in both the Command Palette and Context Menu. Remove `@` prefix and SSH Profiles palette section. Add `#` prefix filtering to a new "Switch Connection" palette category.

**Tech Stack:** React, TypeScript, Zustand, Tauri IPC

**Spec:** `docs/superpowers/specs/2026-03-16-panel-connection-switch-design.md`

---

## Chunk 1: Command Palette Changes

### Task 1: Update CommandPalette prefix system

**Files:**
- Modify: `src/components/CommandPalette/CommandPalette.tsx`

- [ ] **Step 1: Update PrefixMode type and parsePrefix function**

Replace the `PrefixMode` type and `parsePrefix()` at lines 101-115:

```typescript
type PrefixMode = "all" | "tabs" | "layout" | "connection";

function parsePrefix(raw: string): { mode: PrefixMode; query: string } {
  const trimmed = raw.trimStart();
  if (trimmed.startsWith(">")) {
    return { mode: "tabs", query: trimmed.slice(1).trimStart() };
  }
  if (trimmed.startsWith("#")) {
    return { mode: "connection", query: trimmed.slice(1).trimStart() };
  }
  if (trimmed.startsWith("!")) {
    return { mode: "layout", query: trimmed.slice(1).trimStart() };
  }
  return { mode: "all", query: trimmed };
}
```

- [ ] **Step 2: Update filtered pool logic**

Replace the prefix mode filter block at lines 154-161:

```typescript
// Prefix mode filter
if (mode === "tabs") {
  pool = pool.filter((c) => c.category === "Tab List");
} else if (mode === "connection") {
  pool = pool.filter((c) => c.category === "Switch Connection");
} else if (mode === "layout") {
  pool = pool.filter((c) => c.category === "Layout");
}
```

- [ ] **Step 3: Update empty state suggestions**

At line 409, replace the suggestions array:

```typescript
const suggestions = ["tab", "layout", "panel", "connect"];
```

- [ ] **Step 4: Update modeLabel**

At line 432, replace the modeLabel ternary:

```typescript
const modeLabel = mode === "tabs" ? "Tabs" : mode === "connection" ? "Connection" : mode === "layout" ? "Layout" : null;
```

- [ ] **Step 5: Update placeholder**

At line 455, replace the placeholder ternary:

```typescript
placeholder={mode === "tabs" ? "Switch to tab..." : mode === "connection" ? "Switch connection..." : mode === "layout" ? "Change layout..." : "Search commands..."}
```

- [ ] **Step 6: Update footer hints**

At lines 488-490, replace the `@` SSH hint with `#` Connect:

```tsx
<span className="cp-hint"><kbd>&gt;</kbd> Tabs</span>
<span className="cp-hint"><kbd>#</kbd> Connect</span>
<span className="cp-hint"><kbd>!</kbd> Layout</span>
```

- [ ] **Step 7: Verify build**

Run: `cd /Users/handongho/.openclaw/workspace/projects/v-terminal && npm run build`
Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 8: Commit**

```bash
git add src/components/CommandPalette/CommandPalette.tsx
git commit -m "feat: replace @ SSH prefix with # connection prefix in command palette"
```

---

### Task 2: Replace palette sections in App.tsx

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add WSL distros state**

After the existing `const [paletteQuery, setPaletteQuery] = useState("");` at line 801, add WSL distros state for the palette section:

```typescript
const [wslDistros, setWslDistros] = useState<string[]>([]);
useEffect(() => {
  ipc.getWslDistros().then(setWslDistros).catch(() => setWslDistros([]));
}, []);
```

Note: The app already prefetches WSL distros at line 77-79 to warm the Rust cache. This separate state is for the palette section to access the list.

- [ ] **Step 2: Create the new switchConnectionPaletteSection**

Replace the `switchPanelPaletteSection` useMemo block (lines 753-797) with the new dynamic section:

```typescript
const switchConnectionPaletteSection = useMemo<PaletteSection | null>(() => {
  if (!activeTab || !activePanelId) return null;

  const conn = activePanel?.connection;
  const connType = conn?.type ?? "local";

  const isActiveLocal = connType === "local";
  const isActiveBrowser = connType === "browser";

  const commands = [
    // Local Shell
    {
      id: "conn:local",
      label: "Local Shell",
      description: "Switch to a local terminal session",
      meta: "PowerShell",
      icon: (
        <span className="cp-cmd-icon">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <rect x="1" y="2" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
            <path d="M3.5 6l2 1.5-2 1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M7.5 9.5h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </span>
      ),
      isActive: isActiveLocal,
      action: () => {
        if (isActiveLocal) return; // no-op if already active
        switchPanelConnection(activeTab.id, activePanelId, { type: "local" });
      },
    },
    // WSL distros
    ...wslDistros.map((distro) => {
      const isActiveWsl = connType === "wsl"
        && conn?.shellArgs?.[0] === "-d"
        && conn?.shellArgs?.[1] === distro;
      return {
        id: `conn:wsl:${distro}`,
        label: distro,
        description: `Switch to WSL: ${distro}`,
        meta: "WSL",
        icon: (
          <span className="cp-cmd-icon">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.2" />
              <path d="M4 5.5c.5-1 1.5-1.5 3-1.5s2.5.5 3 1.5M4 8.5c.5 1 1.5 1.5 3 1.5s2.5-.5 3-1.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
            </svg>
          </span>
        ),
        isActive: isActiveWsl,
        action: () => {
          if (isActiveWsl) return;
          switchPanelConnection(activeTab.id, activePanelId, {
            type: "wsl",
            shellProgram: "wsl.exe",
            shellArgs: ["-d", distro],
          });
        },
      };
    }),
    // SSH profiles
    ...sshProfiles.map((profile) => {
      const sshCmd = buildSshCommand(profile);
      const isActiveSsh = connType === "ssh" && conn?.sshCommand === sshCmd;
      return {
        id: `conn:ssh:${profile.id}`,
        label: profile.name,
        description: `Switch to SSH: ${profile.username}@${profile.host}${profile.port !== 22 ? `:${profile.port}` : ""}`,
        meta: `${profile.username}@${profile.host}`,
        icon: (
          <span className="cp-cmd-icon">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="1" y="3" width="12" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
              <path d="M1 5.5h12" stroke="currentColor" strokeWidth="1.3" />
              <circle cx="3" cy="4.25" r="0.6" fill="currentColor" />
              <circle cx="5" cy="4.25" r="0.6" fill="currentColor" />
              <path d="M3.5 8.5l2 1.5-2 1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M8 11.5h2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </span>
        ),
        isActive: isActiveSsh,
        action: () => {
          if (isActiveSsh) return;
          switchPanelConnection(activeTab.id, activePanelId, {
            type: "ssh",
            sshCommand: sshCmd,
          });
        },
      };
    }),
    // Browser
    {
      id: "conn:browser",
      label: "Browser",
      description: "Switch to a web browser panel",
      meta: "Web panel",
      icon: (
        <span className="cp-cmd-icon">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.2" />
            <path d="M1.5 7h11M7 1.5c-2 2-2 9 0 11M7 1.5c2 2 2 9 0 11" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
          </svg>
        </span>
      ),
      isActive: isActiveBrowser,
      action: () => {
        if (isActiveBrowser) return;
        switchPanelConnection(activeTab.id, activePanelId, { type: "browser" });
      },
    },
  ];

  return { category: "Switch Connection", commands };
}, [activeTab, activePanelId, activePanel, switchPanelConnection, wslDistros, sshProfiles]);
```

- [ ] **Step 3: Delete sshProfilesPaletteSection**

Delete the entire `sshProfilesPaletteSection` useMemo block (lines 615-646).

- [ ] **Step 4: Update extraSections array**

Replace the `extraSections` array at lines 982-991. Remove `switchPanelPaletteSection` and `sshProfilesPaletteSection`, add `switchConnectionPaletteSection`:

```typescript
extraSections={[
  tabPaletteSection,
  tabListPaletteSection,
  ...(browserPaletteSection ? [browserPaletteSection] : []),
  ...(switchConnectionPaletteSection ? [switchConnectionPaletteSection] : []),
  ...(backgroundTabsPaletteSection ? [backgroundTabsPaletteSection] : []),
  layoutPaletteSection,
  ...(browserHistoryPaletteSection ? [browserHistoryPaletteSection] : []),
]}
```

- [ ] **Step 5: Reorder Tab category — move New Tab to top**

In the `tabPaletteSection` useMemo (line 250), move the "New Tab" command object (currently the 3rd item, `id: "tab:new"`) to the first position in the `commands` array, before "Close Current Tab".

- [ ] **Step 6: Verify build**

Run: `cd /Users/handongho/.openclaw/workspace/projects/v-terminal && npm run build`
Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx
git commit -m "feat: dynamic switch connection palette section with # prefix, remove @ SSH section"
```

---

## Chunk 2: Context Menu & PanelGrid Changes

### Task 3: Expand PanelContextMenu with full connection list

**Files:**
- Modify: `src/components/PanelContextMenu/PanelContextMenu.tsx`
- Modify: `src/components/PanelContextMenu/PanelContextMenu.css`

- [ ] **Step 1: Update props interface and component**

Replace the entire `PanelContextMenu.tsx` content with:

```typescript
import { useRef, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { PanelConnection, SshProfile } from "../../types/terminal";
import { buildSshCommand } from "../../lib/sshUtils";
import "./PanelContextMenu.css";

interface PanelContextMenuProps {
  x: number;
  y: number;
  currentConnection?: PanelConnection;
  wslDistros: string[];
  sshProfiles: SshProfile[];
  onSwitchConnection: (connection: PanelConnection) => void;
  onClose: () => void;
}

export function PanelContextMenu({
  x,
  y,
  currentConnection,
  wslDistros,
  sshProfiles,
  onSwitchConnection,
  onClose,
}: PanelContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: y, left: x });

  // Adjust position if menu overflows viewport
  useEffect(() => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    let top = y;
    let left = x;
    if (left + rect.width > window.innerWidth - 8) {
      left = window.innerWidth - rect.width - 8;
    }
    if (top + rect.height > window.innerHeight - 8) {
      top = window.innerHeight - rect.height - 8;
    }
    setPos({ top, left });
  }, [x, y]);

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const connType = currentConnection?.type ?? "local";
  const isLocal = connType === "local";
  const isBrowser = connType === "browser";

  const handleClick = (connection: PanelConnection) => {
    onSwitchConnection(connection);
    onClose();
  };

  const checkIcon = (
    <svg className="panel-ctx-check" width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M3.5 8.5l3 3 6-7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );

  return createPortal(
    <div
      ref={menuRef}
      className="panel-ctx-menu"
      role="menu"
      style={{ top: pos.top, left: pos.left }}
    >
      <div className="panel-ctx-section-label">Switch Connection</div>

      {/* Local Shell */}
      <button
        className={`panel-ctx-item${isLocal ? " panel-ctx-item--active" : ""}`}
        onClick={() => !isLocal && handleClick({ type: "local" })}
        role="menuitem"
      >
        <span className="panel-ctx-item-icon">💻</span>
        <span className="panel-ctx-item-label">Local Shell</span>
        <span className="panel-ctx-item-meta">PowerShell</span>
        {isLocal && checkIcon}
      </button>

      {/* WSL distros */}
      {wslDistros.length > 0 && <div className="panel-ctx-divider" />}
      {wslDistros.map((distro) => {
        const isActiveWsl = connType === "wsl"
          && currentConnection?.shellArgs?.[0] === "-d"
          && currentConnection?.shellArgs?.[1] === distro;
        return (
          <button
            key={`wsl:${distro}`}
            className={`panel-ctx-item${isActiveWsl ? " panel-ctx-item--active" : ""}`}
            onClick={() => !isActiveWsl && handleClick({
              type: "wsl",
              shellProgram: "wsl.exe",
              shellArgs: ["-d", distro],
            })}
            role="menuitem"
          >
            <span className="panel-ctx-item-icon">🐧</span>
            <span className="panel-ctx-item-label">{distro}</span>
            <span className="panel-ctx-item-meta">WSL</span>
            {isActiveWsl && checkIcon}
          </button>
        );
      })}

      {/* SSH profiles */}
      {sshProfiles.length > 0 && <div className="panel-ctx-divider" />}
      {sshProfiles.map((profile) => {
        const sshCmd = buildSshCommand(profile);
        const isActiveSsh = connType === "ssh" && currentConnection?.sshCommand === sshCmd;
        return (
          <button
            key={`ssh:${profile.id}`}
            className={`panel-ctx-item${isActiveSsh ? " panel-ctx-item--active" : ""}`}
            onClick={() => !isActiveSsh && handleClick({
              type: "ssh",
              sshCommand: sshCmd,
            })}
            role="menuitem"
          >
            <span className="panel-ctx-item-icon">🔑</span>
            <span className="panel-ctx-item-label">{profile.name}</span>
            <span className="panel-ctx-item-meta">{profile.username}@{profile.host}</span>
            {isActiveSsh && checkIcon}
          </button>
        );
      })}

      {/* Browser */}
      <div className="panel-ctx-divider" />
      <button
        className={`panel-ctx-item${isBrowser ? " panel-ctx-item--active" : ""}`}
        onClick={() => !isBrowser && handleClick({ type: "browser" })}
        role="menuitem"
      >
        <span className="panel-ctx-item-icon">🌐</span>
        <span className="panel-ctx-item-label">Browser</span>
        <span className="panel-ctx-item-meta">Web panel</span>
        {isBrowser && checkIcon}
      </button>
    </div>,
    document.body
  );
}
```

- [ ] **Step 2: Add CSS for divider and meta**

Append to `PanelContextMenu.css`:

```css
/* ── Divider ───────────────────────────────────────────────── */
.panel-ctx-divider {
  height: 1px;
  background: var(--separator);
  margin: 3px 8px;
}

/* ── Meta (subtitle) ───────────────────────────────────────── */
.panel-ctx-item-meta {
  font-size: 11px;
  color: var(--label-tertiary);
  flex-shrink: 0;
  margin-left: auto;
}
```

- [ ] **Step 3: Do NOT build yet** — PanelGrid still passes old props. Continue to Task 4.

---

### Task 4: Update PanelGrid to pass new props

**Files:**
- Modify: `src/components/PanelGrid/PanelGrid.tsx`

- [ ] **Step 1: Add imports and state**

Add imports at the top of the file:

```typescript
import { useSshStore } from "../../store/sshStore";
import { ipc } from "../../lib/tauriIpc";
```

Inside the component, after the existing `ctxMenu` state (line 37), add:

```typescript
// Connection data for context menu
const { profiles: sshProfiles } = useSshStore();
const [wslDistros, setWslDistros] = useState<string[]>([]);
useEffect(() => {
  ipc.getWslDistros().then(setWslDistros).catch(() => setWslDistros([]));
}, []);
```

- [ ] **Step 2: Update ctxMenu state and handleContextMenu**

Replace the `ctxMenu` state type (lines 32-37) to store the panel's connection object instead of `currentType` string:

```typescript
const [ctxMenu, setCtxMenu] = useState<{
  x: number;
  y: number;
  panelId: string;
  currentConnection?: PanelConnection;
} | null>(null);
```

Replace `handleContextMenu` (lines 39-45):

```typescript
const handleContextMenu = useCallback(
  (e: React.MouseEvent, panelId: string, connection?: PanelConnection) => {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY, panelId, currentConnection: connection });
  },
  []
);
```

- [ ] **Step 3: Simplify handleSwitchConnection**

Replace `handleSwitchConnection` (lines 47-58):

```typescript
const handleSwitchConnection = useCallback(
  (connection: PanelConnection) => {
    if (!ctxMenu) return;
    switchPanelConnection(tab.id, ctxMenu.panelId, connection);
    setCtxMenu(null);
  },
  [ctxMenu, tab.id, switchPanelConnection]
);
```

- [ ] **Step 4: Update onContextMenu calls in JSX**

In the `tab.panels.map(...)` JSX (lines 138-184), update both `onContextMenu` calls to pass the full connection object instead of `panelType` string.

For the browser panel div (line 145):
```tsx
onContextMenu={(e) => handleContextMenu(e, panel.id, panel.connection)}
```

For the terminal panel div (line 161):
```tsx
onContextMenu={(e) => handleContextMenu(e, panel.id, panel.connection)}
```

Note: The `panelType` variable at line 140 is no longer needed since we pass the full `panel.connection`. It can be kept if used elsewhere (it's not) or removed for cleanliness.

- [ ] **Step 5: Update PanelContextMenu usage**

Replace the `PanelContextMenu` JSX (lines 185-193):

```tsx
{ctxMenu && (
  <PanelContextMenu
    x={ctxMenu.x}
    y={ctxMenu.y}
    currentConnection={ctxMenu.currentConnection}
    wslDistros={wslDistros}
    sshProfiles={sshProfiles}
    onSwitchConnection={handleSwitchConnection}
    onClose={() => setCtxMenu(null)}
  />
)}
```

- [ ] **Step 6: Verify build**

Run: `cd /Users/handongho/.openclaw/workspace/projects/v-terminal && npm run build`
Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 7: Commit (Task 3 + Task 4 together)**

```bash
git add src/components/PanelContextMenu/PanelContextMenu.tsx src/components/PanelContextMenu/PanelContextMenu.css src/components/PanelGrid/PanelGrid.tsx
git commit -m "feat: expand context menu with full connection list and update PanelGrid"
```

---

### Task 5: Manual verification

- [ ] **Step 1: Launch dev server**

Run: `cd /Users/handongho/.openclaw/workspace/projects/v-terminal && npm run tauri dev`

- [ ] **Step 2: Verify Command Palette # prefix**

1. Press `Ctrl+K` to open palette
2. Type `#` — should show "Connection" badge and "Switch connection..." placeholder
3. Should list: Local Shell, any WSL distros, any SSH profiles, Browser
4. Active connection should show checkmark
5. Footer should show `# Connect` instead of `@ SSH`

- [ ] **Step 3: Verify context menu**

1. Right-click any panel
2. "Switch Connection" section should show full flat list
3. Items should have meta text (PowerShell, WSL, user@host, Web panel)
4. Dividers should separate groups
5. Click "Browser" — should open BrowserEmptyState (start page), not google.com
6. Click "Local Shell" — should switch back to terminal

- [ ] **Step 4: Verify @ prefix is removed**

1. Press `Ctrl+K`, type `@`
2. Should NOT show SSH mode badge or filter to SSH profiles
3. Should just search normally with `@` as part of the query

- [ ] **Step 5: Verify New Tab at top of Tab category**

1. Press `Ctrl+K` (no prefix)
2. Tab category should show "New Tab" as the first item

- [ ] **Step 6: Verify no-op on re-select**

1. Open palette with `#`, click the already-active connection
2. Terminal session should NOT restart

- [ ] **Step 7: Commit (if any fixes needed)**

```bash
git add -u
git commit -m "fix: address issues found during manual verification"
```
