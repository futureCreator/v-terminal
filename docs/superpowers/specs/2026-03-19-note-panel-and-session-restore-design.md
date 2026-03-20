# Note Panel Promotion & Session Restore

## Overview

Two interconnected changes: (1) promote notes from a side panel tab to a full panel type that coexists with terminal panels, and (2) persist tab layout, panel types, note content, and connection info across app restarts. Additionally, todos become a global list with their own dedicated tab in the toolkit panel.

## Motivation

- Notes in the side panel have low utility — the narrow width limits editing, and users rarely open the side panel just for notes.
- Making notes a panel type allows side-by-side terminal + note workflows within the same tab layout.
- Currently all tab/layout state is lost on restart, requiring manual reconstruction.
- Todos are more useful as a global checklist than per-tab items.

## Design

### 1. Panel Type Extension — Note as Connection

**Type change:**

```typescript
// PanelConnection.type extended
type: 'local' | 'ssh' | 'wsl' | 'note'
```

**Behavior:**

- When `connection.type === 'note'`, PanelGrid renders a CodeMirror markdown editor instead of xterm.js.
- No session is created (`sessionId` stays `null`).
- Note content is stored in `noteStore` keyed by **panel ID** (not tab ID).

**Switching flow:**

- Right-click context menu: "Note" added below Local/WSL/SSH options.
- Command palette "Switch Connection" section: "Note" added.
- Terminal → Note: existing session is killed, connection.type set to `'note'`, CodeMirror rendered. Note content starts empty.
- Note → Terminal: connection.type changed to desired type, new session created using the tab's `cwd`. **Note content for the panel is deleted** — switching away from note mode discards the note. This is intentional: notes are panel-scoped and ephemeral within a session; only app restart preserves them.

**PanelGrid rendering:**

```
panel.connection.type === 'note'
  → <NotePanel panelId={panel.id} />
else
  → <TerminalPane /> (unchanged)
```

**Broadcast mode:**

- Note panels are excluded from broadcast targets. Broadcast logic lives in `TerminalPane.onData()` which calls `ipc.sessionWrite` on sibling sessions. Since NotePanel renders CodeMirror (not xterm.js), it never calls `ipc.sessionWrite`, so no broadcast input is sent from or to note panels — this is correct by construction, no special filtering needed.

**Layout expansion with note panels:**

- When layout grows (e.g., 1 → 2 panels), new panels inherit `baseConnection` from the first panel. If the first panel is a note panel (`type === 'note'`), new panels fall back to `{ type: 'local' }` instead. Users expanding layout expect new terminal panels, not more note panels.

**Panel zoom:**

- Note panels support zoom — full-screen markdown editor.

### 2. Side Panel Restructuring

**Before:** Notes (markdown + todos) | Timers | Cheatsheet

**After:** Todos (global) | Timers | Cheatsheet

**SidebarTab type change:**

```typescript
// Before
type SidebarTab = "notes" | "timers" | "cheatsheet";

// After
type SidebarTab = "todos" | "timers" | "cheatsheet";
```

**Todos tab:**

- Global todo list — single list shared across all tabs.
- New store: `todoStore` (separated from `noteStore`).
- Storage key: `v-terminal:todos`.
- First tab position in the side panel.
- Icon: checklist-style icon (replacing the notes icon).
- UI: same as existing TodoSection — add, complete, delete, edit, clear completed.

**Removed:**

- NoteEditor from side panel.
- All per-tab todo logic.

### 3. App Restart Restoration

**Storage key:** `v-terminal:workspace`

**Persisted data structure:**

```typescript
interface WorkspaceState {
  version: 1;  // Schema version for future migrations
  tabs: Array<{
    id: string;
    label: string;
    cwd: string;
    layout: Layout;
    broadcastEnabled: boolean;
    panels: Array<{
      id: string;
      connection: PanelConnection;  // includes type, sshProfileId, wslDistro, etc.
    }>;
  }>;
  activeTabId: string;
}
```

Note: `connectionId` is a runtime identifier assigned by the Tauri backend when a session is created. It is NOT persisted — it is regenerated when sessions are created on restore.

**Save trigger:** Debounced write to localStorage on every tab/layout/panel change (300ms debounce, consistent with existing stores).

**Restore flow on app start:**

1. Read `v-terminal:workspace` from localStorage.
2. Recreate tabs with saved IDs, labels, layout, and `broadcastEnabled`. **Panel IDs from the saved state must be preserved** (not regenerated) so that `noteStore` can map panel IDs to their saved markdown content.
3. Set `pendingSessionPick: false` on all restored tabs — sessions are auto-created, not picked by the user.
4. For each panel by connection type:
   - `'local'` / `'wsl'` → auto-create new session with saved connection info and tab's `cwd`.
   - `'ssh'` → auto-create new session with saved SSH profile info.
   - `'note'` → no session, render NotePanel, content loaded from `noteStore` by panel ID.
5. If no saved data or parse failure → create default single tab (current behavior).

**Effect:** Equivalent to opening new tabs with the same layout and connection info. Sessions are new; note content is restored.

**noteStore changes:**

- Key basis: tab ID → **panel ID**.
- Storage key: `v-terminal:panel-notes` (panel ID → markdown content).

### 4. SessionPicker Integration

- When creating a new tab via SessionPicker, "Note" appears as a connection option for each panel.
- `SessionPicker.ConnectionOption` type extended: `type: "local" | "ssh" | "wsl" | "note"`.
- `optionToConnection` handles `'note'` type — no shell program, no label generation, just `{ type: 'note' }`.
- Users can start a tab with mixed terminal + note panels (e.g., 2-split: left terminal, right note).

### 5. Tab/Layout Change Cleanup

- **Tab close:** kill all terminal sessions + delete note data for all panels in the tab. Cleanup must be wired in `handleTabClose`/`handleTabKill` in `App.tsx`, iterating panel IDs to call `noteStore.removeNote(panelId)` for each note-type panel before calling `tabStore.removeTab()`.
- **Layout shrink** (e.g., 4 panels → 2): note data for removed panels is cleaned up, same as terminal session kill logic.
- **Panel switch** (note → terminal): note data for the panel is deleted on switch.

### 6. SSH Restore Failure

- If SSH connection fails on restore, the panel shows the existing SSH connection failure UX (connection pending state).

### 7. Migration

**Note data:**
- Existing `v-terminal:tab-notes` (per-tab notes + todos):
  - Todos: all per-tab todo items merged into `v-terminal:todos` as a single global list (deduplicated by text).
  - Notes: discarded. Per-tab notes cannot map to any specific panel ID since no panels existed for notes in the old model.
- Migration runs once on first launch after update.

**Sidebar tab:**
- If `v-terminal:sidebar-tab` value is `"notes"`, migrate it to `"todos"`.

**All UI text in English:**
- Existing Korean tooltip text in `NotePanel.tsx` (`title="노트 닫기"`) changed to English as part of the NotePanel rework.

## Files Affected

**New:**
- `src/store/todoStore.ts` — global todo store

**Modified:**
- `src/types/terminal.ts` — add `'note'` to PanelConnection type
- `src/store/tabStore.ts` — add localStorage persistence for workspace state (debounced save/restore), handle panel ID preservation on restore, handle layout expansion fallback for note panels
- `src/store/noteStore.ts` — key by panel ID instead of tab ID, remove todo logic
- `src/components/PanelGrid/PanelGrid.tsx` — render NotePanel for note-type panels
- `src/components/PanelContextMenu/PanelContextMenu.tsx` — add "Note" option
- `src/components/SidePanel/SidePanel.tsx` — replace Notes tab with Todos tab, update icon
- `src/components/NotePanel/NotePanel.tsx` — adapt for panel-based usage, fix English text
- `src/components/NotePanel/TodoSection.tsx` — use global todoStore
- `src/components/CommandPalette/CommandPalette.tsx` — add "Note" to connection switching
- `src/components/SessionPicker/SessionPicker.tsx` — add "Note" as connection option, update ConnectionOption type and optionToConnection
- `src/App.tsx` — workspace restore on mount, tab close cleanup wiring

**Removed:**
- `src/store/workspaceStore.ts` — workspace persistence integrated directly into `tabStore` (no separate store)
- Per-tab note/todo coupling in noteStore
