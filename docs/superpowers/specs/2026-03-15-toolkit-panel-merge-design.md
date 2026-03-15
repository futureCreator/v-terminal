# Toolkit Panel Merge — Design Spec

**Date:** 2026-03-15
**Status:** Approved

## Problem

The toolkit side panel has 4 tabs (Notes, Pomodoro, Timer, Recurring Alarms). Notes and Todo work well, but the other 3 tabs each occupy the full 280px panel with relatively sparse content, leading to wasted space.

## Solution

Merge Pomodoro, Timer, and Recurring Alarms into a single **"Timers"** tab with collapsible sections. Reduce tabs from 4 to 2 (Notes, Timers).

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Approach | Minimal Merge — keep section internals as-is, add collapsible wrappers | Minimal change, reuses proven UI, fast to implement |
| Tab name | "Timers" | Concise, covers all time-related features |
| Section order | Pomodoro → Timer → Alarms | Most frequently used first |
| Quick Status Bar | Remove | Replaced by active state in collapsed section headers |
| Collapse state | Persist to localStorage | User preference retained across sessions |
| Default state | Last remembered (localStorage) | Falls back to all-expanded on first use |
| Chevron style | Existing `>` / `v` rotation (Apple HIG Disclosure Indicator) | Already correct, no change needed |

## Tab Structure Change

### Before
```
SidebarTab = "notes" | "pomodoro" | "timer" | "recurring"
[Notes] [Pomodoro] [Timer] [Alarm]  [×]
```

### After
```
SidebarTab = "notes" | "timers"
[Notes] [Timers]  [×]
```

- Timers tab icon: reuse the existing clock icon from the Pomodoro tab
- localStorage migration: `"pomodoro"` | `"timer"` | `"recurring"` → `"timers"`

## Timers Tab Internal Structure

```
┌─────────────────────────────┐
│ [Notes]  [Timers]       [×] │  ← 2 tab icons
├─────────────────────────────┤
│ > POMODORO     ● Focus 18:42│  ← collapsed, active state shown
│ v TIMER                     │  ← expanded
│   ┌─ presets ──────────────┐│
│   │ 5m  10m  15m  30m  1h  ││
│   ├─ custom input ─────────┤│
│   │ Label    min  [+]      ││
│   ├─ active timers ────────┤│
│   │ ▶ Meeting       14:32  ││
│   │ ▶ Break          3:20  ││
│   └────────────────────────┘│
│ > ALARMS          ● Next 09:00│  ← collapsed, active state shown
└─────────────────────────────┘
   ↑ no Quick Status Bar
```

### Collapsible Section Header Pattern

All collapsible sections (including Todo in Notes tab) share the same header:

```
[chevron] SECTION_NAME            [dot] status_text
```

- **Left:** Disclosure chevron (`>` collapsed, `v` expanded via 90deg rotation)
- **Center:** Uppercase section label (12px, weight 600, letter-spacing 0.07em)
- **Right:** Colored dot + summary text (only when active state exists)

### Active State Display Rules

| Section | Condition | Color | Text |
|---------|-----------|-------|------|
| Pomodoro | phase !== "idle" | accent (focus), success (break), warning (long break) | "Focus 18:42" / "Break 3:20" / "Long Break 12:00" |
| Timer | running or paused timers exist | accent | "2 running" / "1 paused" / "2 running, 1 paused" |
| Alarms | any enabled alarm exists | warning | "Next 09:00" |

When no active state exists, the dot and text are hidden — only the section name and chevron are shown.

### Collapse State Persistence

- localStorage key: `v-terminal:timers-collapsed`
- Value: `{ pomodoro: boolean, timer: boolean, alarms: boolean }`
- Default (first use): all sections expanded (`false`)
- Updated on every toggle

### Scrolling

The entire Timers tab body uses `overflow-y: auto`, so all 3 sections can be expanded simultaneously without clipping.

## Component Changes

### New Components
- **`TimersPanel`** — Container component for the merged Timers tab. Renders 3 collapsible sections with shared header pattern, manages collapse state via localStorage.

### Modified Components
- **`SidePanel`** — Update `SidebarTab` type, reduce to 2 tab buttons, render `TimersPanel` for "timers" tab, remove `QuickStatus` component
- **`TodoSection`** — Change Korean labels to English

### Removed
- **`QuickStatus`** component (in SidePanel.tsx)
- Quick Status Bar CSS styles (in AlarmPanel.css)

### Unchanged (internals preserved)
- `PomodoroSection` — ring, controls, settings all stay as-is
- `TimerSection` — presets, custom input, timer list all stay as-is
- `RecurringSection` — alarm list, add form all stay as-is

## TodoSection Label Changes (Korean → English)

| Location | Before | After |
|----------|--------|-------|
| Header label | 할 일 | TODO |
| Input placeholder | 할 일 추가... | Add a task... |
| Clear button aria-label & title | 완료 항목 삭제 | Clear completed |
| Checkbox aria-label (completed) | 완료 해제 | Mark incomplete |
| Checkbox aria-label (incomplete) | 완료 처리 | Mark complete |
| Delete button aria-label & title | 삭제 | Delete |

## Files Affected

| File | Change |
|------|--------|
| `src/components/SidePanel/SidePanel.tsx` | Update SidebarTab type, 2 tab buttons, render TimersPanel, remove QuickStatus |
| `src/components/SidePanel/TimersPanel.tsx` | **New** — merged Timers tab with 3 collapsible sections |
| `src/components/NotePanel/TodoSection.tsx` | Korean → English labels |
| `src/components/AlarmPanel/AlarmPanel.css` | Remove Quick Status Bar styles |
| `src/App.tsx` | Update sidebar tab references (type, migration, defaults) |
