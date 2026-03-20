# Panel Connection Switch — Design Spec

## Summary

Allow users to replace the active panel's connection (Local Shell, WSL, SSH, Browser) via the Command Palette `#` prefix or the right-click context menu. Currently only Local ↔ Browser switching is supported with two static items; this expands to all connection types as a dynamic flat list.

## Goals

- Users can switch any panel to any connection type without closing the tab
- Consistent flat-list UI in both Command Palette and Context Menu
- Remove `@` prefix (SSH Profiles category) to avoid confusion with new `#` prefix
- Browser panel switches to start page (bookmarks + recent) instead of hardcoded google.com

## Non-Goals

- Background session restoration via connection switch (handled separately)
- New connection types beyond what already exists (local, wsl, ssh, browser)
- Refactoring SessionPicker to share code with the new connection list

## Migration Note

The `@` prefix previously opened SSH connections in a **new tab**. This workflow is removed. Users who want SSH in a new tab should use **New Tab → SessionPicker** (the standard flow). The new `#` prefix switches the **active panel's** connection in-place.

## Design

### 1. Command Palette: `#` Prefix Mode

**File: `src/components/CommandPalette/CommandPalette.tsx`**

Add `"connection"` to `PrefixMode` union type and update `parsePrefix()`:

```
type PrefixMode = "all" | "tabs" | "layout" | "connection";
```

Changes:
- `#` maps to `mode: "connection"`, filtering to `category === "Switch Connection"`
- Remove `"ssh"` from `PrefixMode` and `@` parsing branch
- Update placeholder: `"Switch connection..."`
- Update `modeLabel`: `"Connection"`
- Footer hints: replace `<kbd>@</kbd> SSH` with `<kbd>#</kbd> Connect`
- Update empty state suggestions array: replace `"ssh"` with `"connect"` in the suggestions list

**File: `src/App.tsx`**

Remove both existing sections and replace with one dynamic section:
- **Remove** `switchPanelPaletteSection` (the useMemo that creates the "Switch Panel" category with 2 static items)
- **Remove** `sshProfilesPaletteSection` (the useMemo that creates the "SSH Profiles" category)
- **Remove** both from the `extraSections` array

**Add** a new `switchConnectionPaletteSection` with category name `"Switch Connection"`. Items:

1. **Local Shell** — `{ type: "local" }`, icon: 💻, meta: "PowerShell"
2. **WSL distros** (0..N) — `{ type: "wsl", shellProgram: "wsl.exe", shellArgs: ["-d", distro] }`, icon: 🐧, meta: "WSL"
3. **SSH profiles** (0..N) — `{ type: "ssh", sshCommand: buildSshCommand(profile) }`, icon: 🔑, meta: `user@host`
4. **Browser** — `{ type: "browser" }` (no `browserUrl`), icon: 🌐, meta: "Web panel"

Each item calls `switchPanelConnection(activeTab.id, activePanelId, connection)`.

The section is `null` when there is no active panel (`!activeTab || !activePanelId`).

`isActive` matching logic:
- Local: `activePanel.connection?.type === "local"` or `!activePanel.connection?.type`
- WSL: `activePanel.connection?.type === "wsl"` and `shellArgs` deep-equal
- SSH: `activePanel.connection?.type === "ssh"` and `sshCommand` string-equal
- Browser: `activePanel.connection?.type === "browser"`

Position in `extraSections` array: replace the old `switchPanelPaletteSection` and `sshProfilesPaletteSection` slots with the single `switchConnectionPaletteSection`.

### 2. Command Palette: Reorder Tab Category

Move "New Tab" command to the first item in `tabPaletteSection.commands` array (currently it's the 3rd item after "Close Current Tab" and "Send Current Tab to Background").

### 3. Context Menu: Full Connection List

**File: `src/components/PanelContextMenu/PanelContextMenu.tsx`**

New props:
```typescript
interface PanelContextMenuProps {
  // ... existing props
  wslDistros: string[];
  sshProfiles: SshProfile[];
  currentConnection?: PanelConnection;  // full connection object for active-item matching
}
```

Replace `currentType: string` usage with `currentConnection?: PanelConnection` for accurate checkmark matching (needed to distinguish between different WSL distros or SSH profiles).

Replace the current 2-button "Switch Connection" section with a flat list:

- Local Shell (always, with ✓ if active)
- Divider (if WSL distros exist)
- WSL distros (dynamic, with ✓ if matching distro is active)
- Divider (if SSH profiles exist)
- SSH profiles (dynamic, showing `user@host` as subtitle, with ✓ if matching profile is active)
- Divider
- Browser (always, with ✓ if active)

Change `onSwitchConnection` callback signature to accept a full `PanelConnection` object instead of `"local" | "browser"`.

**File: `src/components/PanelGrid/PanelGrid.tsx`**

- Simplify `handleSwitchConnection` to directly forward the `PanelConnection` object from the context menu (no longer constructs it internally from a type string)
- Pass `currentConnection={panel.connection}` to `PanelContextMenu` (where `panel` is the context-menu-targeted panel)
- WSL distros: fetch via `ipc.getWslDistros()` in a `useState`/`useEffect` (same pattern as SessionPicker)
- SSH profiles: read from `useSshStore()`
- Pass both to `PanelContextMenu` as props

### 4. Browser Switch: Start Page

When switching to browser, use `{ type: "browser" }` without `browserUrl`. This causes `BrowserPane` to mount with no `initialUrl`, showing `BrowserEmptyState` (bookmarks + recent URLs).

Update both:
- Command Palette action (in the new dynamic section)
- Context Menu action

### 5. Session Termination Behavior

When `switchPanelConnection()` is called, it already sets `ptyId: null` and `existingSessionId: undefined`. The old TerminalPane unmounts, and the daemon session continues in the background (existing behavior). No confirmation dialog.

### 6. Re-selecting the Active Connection

If the user clicks the already-active connection, it is a **no-op** — no session restart. This avoids accidentally killing a running terminal session.

## File Change Summary

| File | Changes |
|------|---------|
| `CommandPalette.tsx` | Add `"connection"` to PrefixMode, `#` parsing, remove `"ssh"` / `@`, update placeholder/label/footer/suggestions |
| `App.tsx` | New dynamic `switchConnectionPaletteSection`, remove `switchPanelPaletteSection` and `sshProfilesPaletteSection`, update `extraSections`, reorder Tab category |
| `PanelContextMenu.tsx` | Accept `wslDistros`/`sshProfiles`/`currentConnection` props, render full flat list with dividers, change callback signature |
| `PanelGrid.tsx` | Fetch WSL distros, read SSH profiles, pass to PanelContextMenu with `currentConnection`, simplify `handleSwitchConnection` |

## Edge Cases

- **No WSL distros / no SSH profiles**: Groups simply don't appear, no dividers for empty groups
- **No active panel**: `#` prefix section returns `null`; palette shows other available commands or empty state
- **Re-selecting active connection**: No-op (no session restart)
- **WSL distros loading**: Show whatever is available; distros are pre-fetched on app startup
