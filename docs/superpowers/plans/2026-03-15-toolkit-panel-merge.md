# Toolkit Panel Merge Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge the 3 time-related toolkit tabs (Pomodoro, Timer, Alarms) into a single "Timers" tab with collapsible sections, fix Korean labels in TodoSection.

**Architecture:** Minimal merge approach — wrap existing section components in a new `TimersPanel` container with collapsible headers. Reduce `SidebarTab` from 4 values to 2. Remove `QuickStatus` component, show active state in collapsed section headers instead.

**Tech Stack:** React, TypeScript, Zustand, CSS, Tauri, Vite

**Spec:** `docs/superpowers/specs/2026-03-15-toolkit-panel-merge-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/components/SidePanel/TimersPanel.tsx` | Create | Merged Timers tab — renders 3 collapsible sections with shared header pattern, manages collapse state via localStorage |
| `src/components/SidePanel/SidePanel.tsx` | Modify | Update SidebarTab type to `"notes" \| "timers"`, reduce to 2 tab buttons, render TimersPanel, delete QuickStatus |
| `src/components/SidePanel/SidePanel.css` | Modify | Add collapsible section header styles (shared by TimersPanel sections) |
| `src/components/NotePanel/TodoSection.tsx` | Modify | Change 6 Korean labels to English |
| `src/components/AlarmPanel/AlarmPanel.tsx` | Delete | Dead legacy component |
| `src/components/AlarmPanel/AlarmPanel.css` | Modify | Remove Quick Status Bar styles (lines 865-899) |
| `src/App.tsx` | Modify | Update SidebarTab type, migration logic, defaults |

---

## Chunk 1: Cleanup & Label Fixes

### Task 1: Delete legacy AlarmPanel.tsx

**Files:**
- Delete: `src/components/AlarmPanel/AlarmPanel.tsx`

- [ ] **Step 1: Delete the file**

```bash
rm src/components/AlarmPanel/AlarmPanel.tsx
```

- [ ] **Step 2: Type-check to verify nothing breaks**

Run: `npx tsc --noEmit`
Expected: No errors (file was not imported anywhere)

- [ ] **Step 3: Commit**

```bash
git add -u
git commit -m "chore: delete dead AlarmPanel.tsx legacy component"
```

---

### Task 2: Remove Quick Status Bar CSS

**Files:**
- Modify: `src/components/AlarmPanel/AlarmPanel.css:865-899`

- [ ] **Step 1: Remove the Quick Status Bar styles**

Delete everything from line 865 (`/* ══════ QUICK STATUS BAR ...`) to the end of the file (line 899). This removes these CSS classes:
- `.alarm-quick-status`
- `.alarm-quick-status-item`
- `.alarm-quick-status-dot`
- `.alarm-quick-status-text`

- [ ] **Step 2: Commit**

```bash
git add src/components/AlarmPanel/AlarmPanel.css
git commit -m "style: remove Quick Status Bar CSS"
```

---

### Task 3: Fix TodoSection Korean labels to English

**Files:**
- Modify: `src/components/NotePanel/TodoSection.tsx`

- [ ] **Step 1: Replace all 6 Korean strings**

| Line | Before | After |
|------|--------|-------|
| 64 | `할 일` | `TODO` |
| 77 | `aria-label="완료 항목 삭제"` | `aria-label="Clear completed"` |
| 78 | `title="완료 항목 삭제"` | `title="Clear completed"` |
| 104 | `aria-label={todo.completed ? "완료 해제" : "완료 처리"}` | `aria-label={todo.completed ? "Mark incomplete" : "Mark complete"}` |
| 158 | `aria-label="삭제"` | `aria-label="Delete"` |
| 159 | `title="삭제"` | `title="Delete"` |
| 178 | `placeholder="할 일 추가..."` | `placeholder="Add a task..."` |

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/NotePanel/TodoSection.tsx
git commit -m "fix: change TodoSection Korean labels to English"
```

---

## Chunk 2: Create TimersPanel Component

### Task 4: Add collapsible section header CSS to SidePanel.css

**Files:**
- Modify: `src/components/SidePanel/SidePanel.css`

- [ ] **Step 1: Add collapsible section styles at the end of SidePanel.css**

Append the following CSS after the existing `.side-panel-body` block (after line 96):

```css
/* ── Collapsible section — shared by TimersPanel & TodoSection ──── */
.collapsible-section {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: var(--bg-terminal);
  border: 1px solid var(--bg-panel-border);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.collapsible-header {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 12px;
  border: none;
  background: none;
  cursor: pointer;
  user-select: none;
  flex-shrink: 0;
  width: 100%;
  text-align: left;
}

.collapsible-header:hover {
  background: var(--bg-tertiary);
}

.collapsible-chevron {
  color: var(--label-tertiary);
  transition: transform 0.15s ease;
  flex-shrink: 0;
}

.collapsible-chevron--open {
  transform: rotate(90deg);
}

.collapsible-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--label-tertiary);
  letter-spacing: 0.07em;
  text-transform: uppercase;
  font-family: "Pretendard", sans-serif;
}

.collapsible-status {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 4px;
}

.collapsible-status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.collapsible-status-text {
  font-size: 11px;
  font-weight: 500;
  font-family: "JetBrains Mono", "JetBrainsMonoNerdFont", monospace;
  color: var(--label-secondary);
  white-space: nowrap;
}

.collapsible-body {
  border-top: 1px solid var(--bg-panel-border);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/SidePanel/SidePanel.css
git commit -m "style: add collapsible section header CSS"
```

---

### Task 5: Create TimersPanel.tsx

**Files:**
- Create: `src/components/SidePanel/TimersPanel.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/SidePanel/TimersPanel.tsx` with this content:

```tsx
import { useState, useCallback } from "react";
import { PomodoroSection } from "../AlarmPanel/PomodoroSection";
import { TimerSection } from "../AlarmPanel/TimerSection";
import { RecurringSection } from "../AlarmPanel/RecurringSection";
import { useAlarmStore } from "../../store/alarmStore";
import "../AlarmPanel/AlarmPanel.css";

const STORAGE_KEY = "v-terminal:timers-collapsed";

type SectionKey = "pomodoro" | "timer" | "alarms";

interface CollapsedState {
  pomodoro: boolean;
  timer: boolean;
  alarms: boolean;
}

function loadCollapsed(): CollapsedState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch { /* ignore */ }
  return { pomodoro: false, timer: false, alarms: false };
}

function formatMs(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function TimersPanel() {
  const [collapsed, setCollapsed] = useState<CollapsedState>(loadCollapsed);

  const toggle = useCallback((key: SectionKey) => {
    setCollapsed((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return (
    <div className="timers-panel">
      <PomodoroCollapsible collapsed={collapsed.pomodoro} onToggle={() => toggle("pomodoro")} />
      <TimerCollapsible collapsed={collapsed.timer} onToggle={() => toggle("timer")} />
      <AlarmsCollapsible collapsed={collapsed.alarms} onToggle={() => toggle("alarms")} />
    </div>
  );
}

/* ── Pomodoro section ─────────────────────────────────────────────── */

function PomodoroCollapsible({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const phase = useAlarmStore((s) => s.pomodoroState.phase);
  const remainingMs = useAlarmStore((s) => s.pomodoroState.remainingMs);

  const isActive = phase !== "idle";
  const phaseLabel = phase === "focus" ? "Focus" : phase === "break" ? "Break" : phase === "longBreak" ? "Long Break" : "";
  const phaseColor = phase === "focus"
    ? "var(--accent)"
    : phase === "break"
      ? "var(--success)"
      : "var(--warning)";

  return (
    <div className="collapsible-section">
      <button className="collapsible-header" onClick={onToggle} aria-expanded={!collapsed}>
        <svg
          className={`collapsible-chevron${!collapsed ? " collapsible-chevron--open" : ""}`}
          width="8" height="8" viewBox="0 0 8 8" fill="none"
        >
          <path d="M2 1.5L5.5 4 2 6.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="collapsible-label">Pomodoro</span>
        {isActive && (
          <span className="collapsible-status">
            <span className="collapsible-status-dot" style={{ background: phaseColor }} />
            <span className="collapsible-status-text">{phaseLabel} {formatMs(remainingMs)}</span>
          </span>
        )}
      </button>
      {!collapsed && (
        <div className="collapsible-body">
          <div className="alarm-panel-body"><PomodoroSection /></div>
        </div>
      )}
    </div>
  );
}

/* ── Timer section ────────────────────────────────────────────────── */

function TimerCollapsible({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const timers = useAlarmStore((s) => s.timers);

  const runningCount = timers.filter((t) => t.status === "running").length;
  const pausedCount = timers.filter((t) => t.status === "paused").length;
  const isActive = runningCount > 0 || pausedCount > 0;

  let statusText = "";
  if (runningCount > 0 && pausedCount > 0) {
    statusText = `${runningCount} running, ${pausedCount} paused`;
  } else if (runningCount > 0) {
    statusText = `${runningCount} running`;
  } else if (pausedCount > 0) {
    statusText = `${pausedCount} paused`;
  }

  return (
    <div className="collapsible-section">
      <button className="collapsible-header" onClick={onToggle} aria-expanded={!collapsed}>
        <svg
          className={`collapsible-chevron${!collapsed ? " collapsible-chevron--open" : ""}`}
          width="8" height="8" viewBox="0 0 8 8" fill="none"
        >
          <path d="M2 1.5L5.5 4 2 6.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="collapsible-label">Timer</span>
        {isActive && (
          <span className="collapsible-status">
            <span className="collapsible-status-dot" style={{ background: "var(--accent)" }} />
            <span className="collapsible-status-text">{statusText}</span>
          </span>
        )}
      </button>
      {!collapsed && (
        <div className="collapsible-body">
          <div className="alarm-panel-body"><TimerSection /></div>
        </div>
      )}
    </div>
  );
}

/* ── Alarms section ───────────────────────────────────────────────── */

function AlarmsCollapsible({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const alarms = useAlarmStore((s) => s.alarms);

  const enabledAlarms = alarms.filter((a) => a.enabled);
  const nextAlarm = enabledAlarms.length > 0
    ? enabledAlarms.reduce((earliest, a) => (a.time < earliest.time ? a : earliest))
    : null;

  return (
    <div className="collapsible-section">
      <button className="collapsible-header" onClick={onToggle} aria-expanded={!collapsed}>
        <svg
          className={`collapsible-chevron${!collapsed ? " collapsible-chevron--open" : ""}`}
          width="8" height="8" viewBox="0 0 8 8" fill="none"
        >
          <path d="M2 1.5L5.5 4 2 6.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="collapsible-label">Alarms</span>
        {nextAlarm && (
          <span className="collapsible-status">
            <span className="collapsible-status-dot" style={{ background: "var(--warning)" }} />
            <span className="collapsible-status-text">Next {nextAlarm.time}</span>
          </span>
        )}
      </button>
      {!collapsed && (
        <div className="collapsible-body">
          <div className="alarm-panel-body"><RecurringSection /></div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/SidePanel/TimersPanel.tsx
git commit -m "feat: create TimersPanel with collapsible sections"
```

---

## Chunk 3: Update SidePanel & App.tsx

### Task 6: Update SidePanel.tsx and App.tsx together — merge tabs, remove QuickStatus, fix migration

Both files must be updated in a single commit to avoid a broken intermediate state (SidePanel exports a new `SidebarTab` type that App.tsx must match).

**Files:**
- Modify: `src/components/SidePanel/SidePanel.tsx`
- Modify: `src/App.tsx:49-55` (sidebarTab state initializer only; lines 15, 82-85 need no code changes — they automatically align with the new `SidebarTab` type)

- [ ] **Step 1: Rewrite SidePanel.tsx**

Replace the entire file with:

```tsx
import { useEffect } from "react";
import { NoteEditor } from "../NotePanel/NoteEditor";
import { TodoSection } from "../NotePanel/TodoSection";
import { TimersPanel } from "./TimersPanel";
import { useNoteStore } from "../../store/noteStore";
import "../NotePanel/NotePanel.css";
import "./SidePanel.css";

export type SidebarTab = "notes" | "timers";

interface SidePanelProps {
  tabId: string;
  activeTab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
  onClose: () => void;
}

export function SidePanel({ tabId, activeTab, onTabChange, onClose }: SidePanelProps) {
  // Migrate legacy global note on first mount
  useEffect(() => {
    useNoteStore.getState().migrateOldNote(tabId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="side-panel">
      <div className="side-panel-header">
        <div className="side-panel-tabs">
          <button
            className={`side-panel-tab${activeTab === "notes" ? " side-panel-tab--active" : ""}`}
            onClick={() => onTabChange("notes")}
            title="Notes"
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <rect x="2.5" y="1" width="10" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
              <line x1="5" y1="4.5" x2="10" y2="4.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
              <line x1="5" y1="7" x2="10" y2="7" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
              <line x1="5" y1="9.5" x2="8" y2="9.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
            </svg>
          </button>
          <button
            className={`side-panel-tab${activeTab === "timers" ? " side-panel-tab--active" : ""}`}
            onClick={() => onTabChange("timers")}
            title="Timers"
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <circle cx="7.5" cy="8" r="5" stroke="currentColor" strokeWidth="1.2"/>
              <line x1="7.5" y1="5" x2="7.5" y2="8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              <line x1="7.5" y1="8" x2="9.5" y2="8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              <line x1="7.5" y1="1.5" x2="7.5" y2="3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
        <button
          className="side-panel-close"
          onClick={onClose}
          aria-label="Close panel"
          title="Close panel"
        >
          <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
            <path
              d="M1.5 1.5l6 6M7.5 1.5l-6 6"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      <div className="side-panel-body">
        {activeTab === "notes" && (
          <>
            <NoteEditor tabId={tabId} />
            <TodoSection tabId={tabId} />
          </>
        )}
        {activeTab === "timers" && <TimersPanel />}
      </div>
    </div>
  );
}
```

Key changes:
- `SidebarTab` type: `"notes" | "timers"` (was 4 values)
- Removed imports: `PomodoroSection`, `TimerSection`, `RecurringSection`, `useAlarmStore`, `AlarmPanel.css`
- Added import: `TimersPanel`
- Tab buttons: 2 (was 4). Timers tab reuses clock icon from old Pomodoro tab.
- Removed: entire `QuickStatus` function (lines 119-167)
- `{activeTab === "timers" && <TimersPanel />}` replaces 3 separate tab conditionals

- [ ] **Step 2: Update App.tsx sidebarTab state initializer (lines 49-55)**

Replace the `sidebarTab` state initialization:

```tsx
// Before:
const [sidebarTab, setSidebarTab] = useState<SidebarTab>(() => {
  const stored = localStorage.getItem("v-terminal:sidebar-tab");
  if (stored === "notes" || stored === "pomodoro" || stored === "timer" || stored === "recurring") return stored;
  // Migrate legacy "alerts" value
  if (stored === "alerts") return "pomodoro";
  return localStorage.getItem("v-terminal:alarm-open") === "true" ? "pomodoro" : "notes";
});

// After:
const [sidebarTab, setSidebarTab] = useState<SidebarTab>(() => {
  const stored = localStorage.getItem("v-terminal:sidebar-tab");
  if (stored === "notes" || stored === "timers") return stored;
  // Migrate legacy values
  if (stored === "pomodoro" || stored === "timer" || stored === "recurring" || stored === "alerts") {
    localStorage.setItem("v-terminal:sidebar-tab", "timers");
    return "timers";
  }
  return localStorage.getItem("v-terminal:alarm-open") === "true" ? "timers" : "notes";
});
```

Key changes:
- Valid values: only `"notes"` and `"timers"`
- All old values (`"pomodoro"`, `"timer"`, `"recurring"`, `"alerts"`) migrate to `"timers"`
- Legacy `alarm-open` fallback now maps to `"timers"` instead of `"pomodoro"`
- Writes migrated value back to localStorage immediately
- No changes needed at line 15 (import) or lines 82-85 (handleSidebarTabChange) — they auto-align with the new type

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/components/SidePanel/SidePanel.tsx src/App.tsx
git commit -m "feat: merge 4 tabs to 2 (Notes + Timers), update tab migration"
```

---

### Task 7: Add TimersPanel scrollable body CSS

**Files:**
- Modify: `src/components/SidePanel/SidePanel.css`

- [ ] **Step 1: Add timers-panel styles**

Append after the collapsible section styles added in Task 4:

```css
/* ── Timers panel — scrollable container for 3 collapsible sections ── */
.timers-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-height: 0;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--bg-tertiary) transparent;
}

.timers-panel::-webkit-scrollbar {
  width: 4px;
}

.timers-panel::-webkit-scrollbar-track {
  background: transparent;
}

.timers-panel::-webkit-scrollbar-thumb {
  background: var(--bg-tertiary);
  border-radius: 2px;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/SidePanel/SidePanel.css
git commit -m "style: add timers-panel scrollable container CSS"
```

---

### Task 8: Final type-check & manual verification

- [ ] **Step 1: Full type-check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 2: Dev server smoke test**

Run: `npm run dev`

Manual checks:
1. Open the toolkit panel (Ctrl+Shift+N) — should show 2 tab icons (Notes, Timers)
2. Click Timers tab — should show 3 collapsible sections: Pomodoro, Timer, Alarms
3. Toggle each section collapsed/expanded — chevron rotates, content hides/shows
4. Refresh the page — collapsed state should persist
5. Start a Pomodoro, then collapse the section — header should show "Focus XX:XX" with colored dot
6. Add a timer, collapse Timer section — header should show "1 running"
7. Switch to Notes tab — Todo section header should say "TODO" (not "할 일")
8. Input placeholder should say "Add a task..." (not "할 일 추가...")
9. No Quick Status Bar at the bottom of the panel
10. All 3 sections expanded simultaneously — panel should scroll

- [ ] **Step 3: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix: address issues found during manual verification"
```
