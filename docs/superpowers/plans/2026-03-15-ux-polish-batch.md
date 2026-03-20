# UX Polish Batch Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement 5 independent UX improvements: command palette cleanup, Pomodoro settings redesign, timer preset grid, and Settings modal.

**Architecture:** Each task is independent and self-contained. Tasks 1-2 are small edits to CommandPalette.tsx. Tasks 3-4 modify the Timers panel components. Task 5 is the largest — a new Settings modal with consolidated terminal config store.

**Tech Stack:** React 18, TypeScript, Zustand, xterm.js, CSS (no CSS-in-JS), Tauri 2

**Spec:** `docs/superpowers/specs/2026-03-15-ux-polish-batch-design.md`

---

## Chunk 1: Command Palette Changes

### Task 1: Remove Recent Section from Command Palette

**Files:**
- Modify: `src/components/CommandPalette/CommandPalette.tsx`

- [ ] **Step 1: Remove Recent-related code**

Delete the entire "Recent commands" section (lines 98-115):
```typescript
// DELETE: RECENT_KEY, MAX_RECENT, getRecent(), pushRecent()
```

Remove `recentIds` and `recentCommands` useMemo hooks (lines 198-206):
```typescript
// DELETE these two useMemo blocks
```

Remove `pushRecent(cmd.id)` from the `execute` callback (line 251). The execute function becomes:
```typescript
const execute = useCallback(async (cmd: Command) => {
    await cmd.action();
    onClose();
}, [onClose]);
```

- [ ] **Step 2: Simplify index calculations**

Update `totalCount` (line 238):
```typescript
const totalCount = filtered.length;
```

Replace `resolveCommandAtIndex` (lines 343-346):
```typescript
const resolveCommandAtIndex = (idx: number): Command | undefined => {
    return filtered[idx];
};
```

Replace `buildFlatList` (lines 336-341):
```typescript
const buildFlatList = (): Command[] => {
    return [...filtered];
};
```

- [ ] **Step 3: Simplify jumpCategory**

In `jumpCategory` (lines 309-333), remove `_source` typing. The function now works on `filtered` directly:
```typescript
const jumpCategory = (dir: 1 | -1) => {
    if (q) return;
    if (filtered.length === 0) return;

    const catStarts: number[] = [];
    let lastCat = "";
    filtered.forEach((item, i) => {
        if (item.category !== lastCat) {
            catStarts.push(i);
            lastCat = item.category;
        }
    });

    const currentCatIdx = catStarts.findIndex((start, i) => {
        const nextStart = catStarts[i + 1] ?? filtered.length;
        return activeIndex >= start && activeIndex < nextStart;
    });

    let nextCatIdx = currentCatIdx + dir;
    if (nextCatIdx < 0) nextCatIdx = catStarts.length - 1;
    if (nextCatIdx >= catStarts.length) nextCatIdx = 0;
    setActiveIndex(catStarts[nextCatIdx]);
};
```

- [ ] **Step 4: Update render section**

In `renderGrouped` (line 381), change the offset from `recentCommands.length` to `0`:
```typescript
let globalIndex = 0; // was: recentCommands.length
```

Remove the `recentCommands.length > 0` check from the divider condition (line 407):
```typescript
className={`cp-category${catIdx > 0 ? " cp-category--divided" : ""}`}
```

Delete `renderRecent` function entirely (lines 427-438).

In the render JSX (lines 511-515), remove `{renderRecent()}`:
```tsx
) : (
    renderGrouped()
)}
```

In `showDescription` (line 377), keep as-is — it still works since `resolveCommandAtIndex` is simplified.

- [ ] **Step 5: Commit**

```bash
git add src/components/CommandPalette/CommandPalette.tsx
git commit -m "refactor: remove Recent section from command palette

Simplifies UI and fixes Tab-jump bug where Tab key navigated
within Recent's mixed categories instead of jumping to main categories."
```

---

### Task 2: Update Command Palette Footer Hints

**Files:**
- Modify: `src/components/CommandPalette/CommandPalette.tsx`

- [ ] **Step 1: Replace footer hints**

Replace lines 527-531:
```tsx
{/* Footer hint */}
<div className="cp-footer">
    <span className="cp-hint"><kbd>↑↓</kbd> Navigate</span>
    <span className="cp-hint"><kbd>↵</kbd> Execute</span>
    <span className="cp-hint"><kbd>Tab</kbd> Jump</span>
    <span className="cp-hint"><kbd>&gt;</kbd> Tabs</span>
    <span className="cp-hint"><kbd>@</kbd> SSH</span>
</div>
```

Note: Use `&gt;` for `>` inside JSX to avoid parsing issues.

- [ ] **Step 2: Commit**

```bash
git add src/components/CommandPalette/CommandPalette.tsx
git commit -m "feat: add prefix hints to command palette footer

Replace 'Ctrl K Close' with '> Tabs' and '@ SSH' hints to
teach users about prefix filtering features."
```

---

## Chunk 2: Pomodoro Settings UX

### Task 3: Redesign Pomodoro Settings with Stepper Controls

**Files:**
- Modify: `src/components/AlarmPanel/PomodoroSection.tsx`
- Modify: `src/components/AlarmPanel/AlarmPanel.css`

- [ ] **Step 1: Add settings toggle state to PomodoroSection**

In `PomodoroSection.tsx`, add state at the top of the component:
```typescript
import { useState } from "react";
// ... existing imports

export function PomodoroSection() {
    const [showSettings, setShowSettings] = useState(false);
    // ... existing code
```

- [ ] **Step 2: Add gear toggle button to controls row**

Replace the controls div (lines 90-111) with:
```tsx
{/* Controls */}
<div className="pomodoro-controls">
    {phase === "idle" ? (
        <button className="pomodoro-btn pomodoro-btn--primary" onClick={startPomodoro}>
            Start
        </button>
    ) : (
        <>
            {isRunning ? (
                <button className="pomodoro-btn" onClick={pausePomodoro}>
                    Pause
                </button>
            ) : isPaused ? (
                <button className="pomodoro-btn pomodoro-btn--primary" onClick={resumePomodoro}>
                    Resume
                </button>
            ) : null}
            <button className="pomodoro-btn pomodoro-btn--danger" onClick={resetPomodoro}>
                Reset
            </button>
        </>
    )}
    <button
        className={`pomodoro-gear-btn${showSettings ? " pomodoro-gear-btn--active" : ""}`}
        onClick={() => setShowSettings((v) => !v)}
        title="Settings"
        aria-label="Toggle settings"
    >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6.8 1.5h2.4l.3 1.8.8.4 1.6-.9 1.7 1.7-.9 1.6.4.8 1.8.3v2.4l-1.8.3-.4.8.9 1.6-1.7 1.7-1.6-.9-.8.4-.3 1.8H6.8l-.3-1.8-.8-.4-1.6.9-1.7-1.7.9-1.6-.4-.8-1.8-.3V6.8l1.8-.3.4-.8-.9-1.6 1.7-1.7 1.6.9.8-.4z"/>
            <circle cx="8" cy="8" r="2.2"/>
        </svg>
    </button>
</div>
```

- [ ] **Step 3: Replace settings section with stepper controls**

Replace the entire settings div (lines 113-170) with:
```tsx
{/* Settings (toggled by gear button) */}
{showSettings && (
    <div className={`pomodoro-settings${phase !== "idle" ? " pomodoro-settings--disabled" : ""}`}>
        {phase !== "idle" && (
            <span className="pomodoro-settings-hint">Reset to edit</span>
        )}
        <div className="pomodoro-stepper-row">
            <span className="pomodoro-stepper-label">Focus</span>
            <div className="pomodoro-stepper">
                <button
                    className="pomodoro-stepper-btn"
                    disabled={phase !== "idle" || pomodoroConfig.focusMinutes <= 5}
                    onClick={() => setPomodoroConfig({ focusMinutes: pomodoroConfig.focusMinutes - 5 })}
                >−</button>
                <span className="pomodoro-stepper-value">{pomodoroConfig.focusMinutes}<span className="pomodoro-stepper-unit">m</span></span>
                <button
                    className="pomodoro-stepper-btn"
                    disabled={phase !== "idle" || pomodoroConfig.focusMinutes >= 120}
                    onClick={() => setPomodoroConfig({ focusMinutes: pomodoroConfig.focusMinutes + 5 })}
                >+</button>
            </div>
        </div>
        <div className="pomodoro-stepper-row">
            <span className="pomodoro-stepper-label">Break</span>
            <div className="pomodoro-stepper">
                <button
                    className="pomodoro-stepper-btn"
                    disabled={phase !== "idle" || pomodoroConfig.breakMinutes <= 1}
                    onClick={() => setPomodoroConfig({ breakMinutes: pomodoroConfig.breakMinutes - 1 })}
                >−</button>
                <span className="pomodoro-stepper-value">{pomodoroConfig.breakMinutes}<span className="pomodoro-stepper-unit">m</span></span>
                <button
                    className="pomodoro-stepper-btn"
                    disabled={phase !== "idle" || pomodoroConfig.breakMinutes >= 60}
                    onClick={() => setPomodoroConfig({ breakMinutes: pomodoroConfig.breakMinutes + 1 })}
                >+</button>
            </div>
        </div>
        <div className="pomodoro-stepper-row">
            <span className="pomodoro-stepper-label">Long Break</span>
            <div className="pomodoro-stepper">
                <button
                    className="pomodoro-stepper-btn"
                    disabled={phase !== "idle" || pomodoroConfig.longBreakMinutes <= 5}
                    onClick={() => setPomodoroConfig({ longBreakMinutes: pomodoroConfig.longBreakMinutes - 5 })}
                >−</button>
                <span className="pomodoro-stepper-value">{pomodoroConfig.longBreakMinutes}<span className="pomodoro-stepper-unit">m</span></span>
                <button
                    className="pomodoro-stepper-btn"
                    disabled={phase !== "idle" || pomodoroConfig.longBreakMinutes >= 60}
                    onClick={() => setPomodoroConfig({ longBreakMinutes: pomodoroConfig.longBreakMinutes + 5 })}
                >+</button>
            </div>
        </div>
        <div className="pomodoro-stepper-row pomodoro-stepper-row--last">
            <div className="pomodoro-stepper-label-group">
                <span className="pomodoro-stepper-label">Sessions</span>
                <span className="pomodoro-stepper-sublabel">before long break</span>
            </div>
            <div className="pomodoro-stepper">
                <button
                    className="pomodoro-stepper-btn"
                    disabled={phase !== "idle" || pomodoroConfig.sessionsBeforeLongBreak <= 1}
                    onClick={() => setPomodoroConfig({ sessionsBeforeLongBreak: pomodoroConfig.sessionsBeforeLongBreak - 1 })}
                >−</button>
                <span className="pomodoro-stepper-value">{pomodoroConfig.sessionsBeforeLongBreak}</span>
                <button
                    className="pomodoro-stepper-btn"
                    disabled={phase !== "idle" || pomodoroConfig.sessionsBeforeLongBreak >= 12}
                    onClick={() => setPomodoroConfig({ sessionsBeforeLongBreak: pomodoroConfig.sessionsBeforeLongBreak + 1 })}
                >+</button>
            </div>
        </div>
    </div>
)}
```

- [ ] **Step 4: Add CSS for gear button and stepper controls**

In `AlarmPanel.css`, replace the existing `.pomodoro-settings`, `.pomodoro-settings-header`, `.pomodoro-setting-row`, `.pomodoro-setting-label`, `.pomodoro-setting-input`, `.pomodoro-setting-input::-webkit-*`, `.pomodoro-setting-input:focus`, `.pomodoro-setting-unit` rules with:

```css
/* ── Gear toggle button ────────────────────────────────────────── */
.pomodoro-gear-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: none;
  background: transparent;
  color: var(--label-tertiary);
  border-radius: var(--radius-sm);
  cursor: pointer;
  margin-left: auto;
  transition: color 0.12s, background 0.12s;
}
.pomodoro-gear-btn:hover {
  background: var(--bg-tertiary);
  color: var(--label-secondary);
}
.pomodoro-gear-btn--active {
  color: var(--accent);
}

/* ── Settings panel (stepper) ──────────────────────────────────── */
.pomodoro-settings {
  margin-top: 10px;
  border-top: 1px solid var(--separator);
  padding-top: 10px;
  position: relative;
  animation: pomo-settings-in 0.15s ease;
}
@keyframes pomo-settings-in {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}
.pomodoro-settings--disabled .pomodoro-stepper-value {
  opacity: 0.3;
}
.pomodoro-settings-hint {
  position: absolute;
  top: 10px;
  right: 0;
  font-size: 10px;
  font-style: italic;
  color: var(--label-tertiary);
}

/* ── Stepper rows ──────────────────────────────────────────────── */
.pomodoro-stepper-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid var(--separator);
}
.pomodoro-stepper-row--last {
  border-bottom: none;
}
.pomodoro-stepper-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--label-primary);
}
.pomodoro-stepper-label-group {
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.pomodoro-stepper-sublabel {
  font-size: 10px;
  color: var(--label-tertiary);
}

/* ── Stepper control ───────────────────────────────────────────── */
.pomodoro-stepper {
  display: flex;
  align-items: center;
  border: 1px solid var(--separator);
  border-radius: 8px;
  overflow: hidden;
  background: var(--bg-tertiary);
}
.pomodoro-stepper-btn {
  width: 30px;
  height: 30px;
  border: none;
  background: transparent;
  color: var(--label-secondary);
  font-size: 15px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.1s, color 0.1s;
}
.pomodoro-stepper-btn:hover:not(:disabled) {
  background: var(--bg-hover);
  color: var(--label-primary);
}
.pomodoro-stepper-btn:active:not(:disabled) {
  background: color-mix(in srgb, var(--accent) 15%, transparent);
  color: var(--accent);
}
.pomodoro-stepper-btn:disabled {
  opacity: 0.3;
  cursor: default;
}
.pomodoro-stepper-value {
  width: 42px;
  text-align: center;
  font-family: "JetBrains Mono", "JetBrainsMonoNerdFont", monospace;
  font-size: 13px;
  font-weight: 600;
  color: var(--label-primary);
  border-left: 1px solid var(--separator);
  border-right: 1px solid var(--separator);
  line-height: 30px;
  transition: opacity 0.15s;
}
.pomodoro-stepper-unit {
  font-size: 10px;
  font-weight: 400;
  color: var(--label-tertiary);
}
```

- [ ] **Step 5: Commit**

```bash
git add src/components/AlarmPanel/PomodoroSection.tsx src/components/AlarmPanel/AlarmPanel.css
git commit -m "feat: redesign Pomodoro settings with stepper controls

- Settings hidden by default, toggled via gear icon
- Stepper controls replace raw number inputs
- Inputs disabled during active sessions with 'Reset to edit' hint
- Proper cog SVG icon replaces sun-like icon"
```

---

## Chunk 3: Timer Preset Grid & Card Polish

### Task 4: Replace Timer Presets and Polish Cards

**Files:**
- Modify: `src/components/AlarmPanel/TimerSection.tsx`
- Modify: `src/components/AlarmPanel/AlarmPanel.css`

- [ ] **Step 1: Replace presets and remove custom input in TimerSection.tsx**

Replace the entire `TimerSection` component with:
```typescript
interface PresetDef {
  minutes: number;
  label: string;
}

const PRESETS: PresetDef[] = [
  { minutes: 1, label: "1m" },
  { minutes: 3, label: "3m" },
  { minutes: 5, label: "5m" },
  { minutes: 10, label: "10m" },
  { minutes: 15, label: "15m" },
  { minutes: 20, label: "20m" },
  { minutes: 25, label: "25m" },
  { minutes: 30, label: "30m" },
  { minutes: 45, label: "45m" },
  { minutes: 60, label: "1h" },
  { minutes: 90, label: "1.5h" },
  { minutes: 120, label: "2h" },
];

export function TimerSection() {
  const timers = useAlarmStore((s) => s.timers);
  const { addTimer, removeTimer, pauseTimer, resumeTimer, clearFinishedTimers } = useAlarmStore();

  const finishedCount = timers.filter((t) => t.status === "finished").length;

  const handleAddPreset = (preset: PresetDef) => {
    addTimer(preset.label, preset.minutes * 60_000);
  };

  return (
    <div className="timer-section">
      {/* Preset grid */}
      <div className="timer-preset-grid">
        {PRESETS.map((p) => (
          <button
            key={p.minutes}
            className="timer-preset-btn"
            onClick={() => handleAddPreset(p)}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Timer list */}
      {timers.length > 0 && (
        <>
          <div className="timer-list-header">
            <span className="timer-list-title">Active Timers</span>
            {finishedCount > 0 && (
              <button
                className="timer-clear-btn"
                onClick={clearFinishedTimers}
                title="Clear finished timers"
              >
                Clear Done
              </button>
            )}
          </div>
          <div className="timer-list">
            {timers.map((timer) => (
              <TimerItem
                key={timer.id}
                timer={timer}
                onPause={pauseTimer}
                onResume={resumeTimer}
                onRemove={removeTimer}
              />
            ))}
          </div>
        </>
      )}

      {timers.length === 0 && (
        <div className="timer-empty">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <span>Select a preset to start a timer</span>
        </div>
      )}
    </div>
  );
}
```

Remove the `useState` import if no longer needed (check if `TimerItem` uses it — it doesn't). Remove `import { useState } from "react";` from the top.

- [ ] **Step 2: Update formatDuration for consistency**

Update the `formatDuration` function:
```typescript
function formatDuration(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  if (minutes >= 120) return `${minutes / 60}h`;
  if (minutes >= 60 && minutes % 60 === 0) return `${minutes / 60}h`;
  if (minutes > 60) return `${(minutes / 60).toFixed(1)}h`;
  return `${minutes}m`;
}
```

- [ ] **Step 3: Update CSS for preset grid**

In `AlarmPanel.css`, replace the existing `.timer-presets` and `.timer-preset-btn` rules, and delete `.timer-custom-row`, `.timer-custom-input`, `.timer-custom-label`, `.timer-custom-minutes`, `.timer-custom-minutes::-webkit-*`, `.timer-add-btn`, `.timer-add-btn:hover:not(:disabled)`, `.timer-add-btn:disabled` rules.

New preset CSS:
```css
/* ── Preset grid ───────────────────────────────────────────────── */
.timer-preset-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
  margin-bottom: 12px;
}

.timer-preset-btn {
  padding: 8px 0;
  border: 1px solid var(--separator);
  border-radius: 8px;
  background: var(--bg-tertiary);
  color: var(--label-primary);
  font-size: 12px;
  font-weight: 500;
  font-family: "JetBrains Mono", "JetBrainsMonoNerdFont", monospace;
  text-align: center;
  cursor: pointer;
  transition: background 0.1s, border-color 0.1s;
}
.timer-preset-btn:hover {
  background: var(--bg-hover);
  border-color: var(--label-tertiary);
}
.timer-preset-btn:active {
  background: color-mix(in srgb, var(--accent) 15%, transparent);
  border-color: var(--accent);
  color: var(--accent);
}
```

- [ ] **Step 4: Update timer card CSS**

Update existing card rules in `AlarmPanel.css`:

```css
.timer-item {
  position: relative;
  border-radius: 8px;
  overflow: hidden;
  background: var(--bg-terminal);
  border: 1px solid var(--separator);
  margin-bottom: 6px;
}

.timer-item-progress {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background: color-mix(in srgb, var(--accent) 14%, transparent);
  border-radius: 8px;
  transition: width 1s linear;
  pointer-events: none;
}

.timer-item-content {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 42px;
  padding: 6px 10px;
}

.timer-play-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  flex-shrink: 0;
  border: none;
  background: rgba(255, 255, 255, 0.05);
  padding: 0;
  cursor: pointer;
  color: var(--label-secondary);
  border-radius: 6px;
  transition: color 0.12s, background 0.12s;
}

.timer-label {
  flex: 1;
  font-size: 13px;
  font-weight: 500;
  font-family: "Pretendard", sans-serif;
  color: var(--label-primary);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.timer-time {
  font-size: 13px;
  font-weight: 600;
  font-family: "JetBrains Mono", "JetBrainsMonoNerdFont", monospace;
  color: var(--label-primary);
  flex-shrink: 0;
}

.timer-done-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  flex-shrink: 0;
}
```

- [ ] **Step 5: Commit**

```bash
git add src/components/AlarmPanel/TimerSection.tsx src/components/AlarmPanel/AlarmPanel.css
git commit -m "feat: redesign timer with 4x3 preset grid and polished cards

- Replace 5-preset row + custom input with 12-preset grid (1m to 2h)
- Timer cards: larger (42px), more padding, stronger progress bar
- Pass preset label text as timer label for consistency
- Update formatDuration to handle hour formatting"
```

---

## Chunk 4: Settings Modal

### Task 5: Create Settings Modal with Appearance + Terminal Tabs

This is the largest task. It has several subtasks.

**Files:**
- Create: `src/store/terminalConfigStore.ts`
- Create: `src/components/SettingsModal/SettingsModal.tsx`
- Create: `src/components/SettingsModal/SettingsModal.css`
- Create: `src/styles/fonts.css`
- Modify: `src/main.tsx` (import fonts.css)
- Modify: `src/App.tsx` (add Settings modal state, command palette entry, remove old font store refs)
- Modify: `src/components/SplitToolbar/SplitToolbar.tsx` (replace Appearance with Settings)
- Modify: `src/components/TerminalPane/TerminalPane.tsx` (use new config store)
- Delete: `src/store/terminalFontStore.ts` (replaced by terminalConfigStore)

#### Subtask 5a: Create terminalConfigStore

- [ ] **Step 1: Create the consolidated config store**

Create `src/store/terminalConfigStore.ts`:
```typescript
import { create } from "zustand";

const STORAGE_KEY = "v-terminal:terminal-config";
const LEGACY_FONT_SIZE_KEY = "v-terminal:terminal-font-size";

export const MIN_FONT_SIZE = 10;
export const MAX_FONT_SIZE = 24;
export const DEFAULT_FONT_SIZE = 14;

export type CursorStyle = "block" | "underline" | "bar";

export interface TerminalConfig {
  fontSize: number;
  fontFamily: string;
  cursorStyle: CursorStyle;
  cursorBlink: boolean;
  lineHeight: number;
  scrollback: number;
}

const DEFAULTS: TerminalConfig = {
  fontSize: DEFAULT_FONT_SIZE,
  fontFamily: "JetBrainsMonoNerdFont",
  cursorStyle: "block",
  cursorBlink: true,
  lineHeight: 1.2,
  scrollback: 5000,
};

function loadConfig(): TerminalConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULTS, ...parsed };
    }
    // Migrate legacy font size key
    const legacySize = localStorage.getItem(LEGACY_FONT_SIZE_KEY);
    if (legacySize) {
      const size = Number(legacySize);
      if (size >= MIN_FONT_SIZE && size <= MAX_FONT_SIZE) {
        const config = { ...DEFAULTS, fontSize: size };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
        localStorage.removeItem(LEGACY_FONT_SIZE_KEY);
        return config;
      }
    }
  } catch {}
  return { ...DEFAULTS };
}

function saveConfig(config: TerminalConfig) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {}
}

interface TerminalConfigStore extends TerminalConfig {
  setFontSize: (size: number) => void;
  setFontFamily: (family: string) => void;
  setCursorStyle: (style: CursorStyle) => void;
  setCursorBlink: (blink: boolean) => void;
  setLineHeight: (height: number) => void;
  setScrollback: (lines: number) => void;
  increaseFontSize: () => void;
  decreaseFontSize: () => void;
  resetFontSize: () => void;
}

export const useTerminalConfigStore = create<TerminalConfigStore>((set, get) => ({
  ...loadConfig(),

  setFontSize: (size) => {
    const clamped = Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, size));
    set({ fontSize: clamped });
    saveConfig({ ...get(), fontSize: clamped });
  },
  setFontFamily: (family) => {
    set({ fontFamily: family });
    saveConfig({ ...get(), fontFamily: family });
  },
  setCursorStyle: (style) => {
    set({ cursorStyle: style });
    saveConfig({ ...get(), cursorStyle: style });
  },
  setCursorBlink: (blink) => {
    set({ cursorBlink: blink });
    saveConfig({ ...get(), cursorBlink: blink });
  },
  setLineHeight: (height) => {
    const clamped = Math.max(1.0, Math.min(1.6, Math.round(height * 10) / 10));
    set({ lineHeight: clamped });
    saveConfig({ ...get(), lineHeight: clamped });
  },
  setScrollback: (lines) => {
    const clamped = Math.max(1000, Math.min(10000, Math.round(lines / 1000) * 1000));
    set({ scrollback: clamped });
    saveConfig({ ...get(), scrollback: clamped });
  },
  increaseFontSize: () => get().setFontSize(get().fontSize + 1),
  decreaseFontSize: () => get().setFontSize(get().fontSize - 1),
  resetFontSize: () => get().setFontSize(DEFAULT_FONT_SIZE),
}));
```

- [ ] **Step 2: Commit store**

```bash
git add src/store/terminalConfigStore.ts
git commit -m "feat: create consolidated terminalConfigStore

Single store for all terminal config (font, cursor, display).
Migrates legacy v-terminal:terminal-font-size key on first load."
```

#### Subtask 5b: Create fonts.css

- [ ] **Step 3: Create fonts.css with @font-face declarations**

Create `src/styles/fonts.css`. For now, declare the font families that will be bundled. The actual .woff2 files will be added separately (font files are large binary assets that should be downloaded/copied manually).

```css
/* ── Bundled Terminal Fonts ─────────────────────────────────────── */
/* Font files should be placed in src/assets/fonts/<family>/ */

/* JetBrains Mono is already loaded via existing fontLoader.ts */

/* Fira Code */
@font-face {
  font-family: "Fira Code";
  src: url("../assets/fonts/fira-code/FiraCode-Regular.woff2") format("woff2");
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: "Fira Code";
  src: url("../assets/fonts/fira-code/FiraCode-Bold.woff2") format("woff2");
  font-weight: 700;
  font-style: normal;
  font-display: swap;
}

/* Cascadia Code */
@font-face {
  font-family: "Cascadia Code";
  src: url("../assets/fonts/cascadia-code/CascadiaCode-Regular.woff2") format("woff2");
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: "Cascadia Code";
  src: url("../assets/fonts/cascadia-code/CascadiaCode-Bold.woff2") format("woff2");
  font-weight: 700;
  font-style: normal;
  font-display: swap;
}

/* Source Code Pro */
@font-face {
  font-family: "Source Code Pro";
  src: url("../assets/fonts/source-code-pro/SourceCodePro-Regular.woff2") format("woff2");
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: "Source Code Pro";
  src: url("../assets/fonts/source-code-pro/SourceCodePro-Bold.woff2") format("woff2");
  font-weight: 700;
  font-style: normal;
  font-display: swap;
}

/* IBM Plex Mono */
@font-face {
  font-family: "IBM Plex Mono";
  src: url("../assets/fonts/ibm-plex-mono/IBMPlexMono-Regular.woff2") format("woff2");
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: "IBM Plex Mono";
  src: url("../assets/fonts/ibm-plex-mono/IBMPlexMono-Bold.woff2") format("woff2");
  font-weight: 700;
  font-style: normal;
  font-display: swap;
}

/* Hack */
@font-face {
  font-family: "Hack";
  src: url("../assets/fonts/hack/Hack-Regular.woff2") format("woff2");
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: "Hack";
  src: url("../assets/fonts/hack/Hack-Bold.woff2") format("woff2");
  font-weight: 700;
  font-style: normal;
  font-display: swap;
}

/* Inconsolata */
@font-face {
  font-family: "Inconsolata";
  src: url("../assets/fonts/inconsolata/Inconsolata-Regular.woff2") format("woff2");
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: "Inconsolata";
  src: url("../assets/fonts/inconsolata/Inconsolata-Bold.woff2") format("woff2");
  font-weight: 700;
  font-style: normal;
  font-display: swap;
}

/* Monaspace Neon (GitHub) */
@font-face {
  font-family: "Monaspace Neon";
  src: url("../assets/fonts/monaspace/MonaspaceNeon-Regular.woff2") format("woff2");
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: "Monaspace Neon";
  src: url("../assets/fonts/monaspace/MonaspaceNeon-Bold.woff2") format("woff2");
  font-weight: 700;
  font-style: normal;
  font-display: swap;
}

/* Sarasa Mono K */
@font-face {
  font-family: "Sarasa Mono K";
  src: url("../assets/fonts/sarasa-mono-k/SarasaMonoK-Regular.woff2") format("woff2");
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: "Sarasa Mono K";
  src: url("../assets/fonts/sarasa-mono-k/SarasaMonoK-Bold.woff2") format("woff2");
  font-weight: 700;
  font-style: normal;
  font-display: swap;
}
```

Import in `src/main.tsx`:
```typescript
import "./styles/fonts.css";
```

- [ ] **Step 4: Commit fonts.css**

```bash
git add src/styles/fonts.css src/main.tsx
git commit -m "feat: add @font-face declarations for bundled terminal fonts

8 additional font families (Fira Code, Cascadia Code, Source Code Pro,
IBM Plex Mono, Hack, Inconsolata, Monaspace Neon, Sarasa Mono K).
Font woff2 files to be added in src/assets/fonts/."
```

#### Subtask 5c: Create SettingsModal component

- [ ] **Step 5: Create SettingsModal.tsx**

Create `src/components/SettingsModal/SettingsModal.tsx`. This is a large component — see the spec for layout details. The component should:
- Two-column layout: left nav (Appearance/Terminal) + right content
- Appearance tab: font family dropdown with live preview, font size stepper, theme grid with Auto + 15 themes
- Terminal tab: cursor style dropdown, cursor blink toggle, line height input, scrollback input
- Use `useTerminalConfigStore` for all terminal config
- Use `useThemeStore` for theme selection
- Portal to document.body, ESC/click-outside to close

- [ ] **Step 6: Create SettingsModal.css**

Matching the SSH Profiles modal styling pattern. 640px width, 170px left nav, scrollable right content.

- [ ] **Step 7: Commit SettingsModal**

```bash
git add src/components/SettingsModal/
git commit -m "feat: create Settings modal with Appearance and Terminal tabs

Two-column layout matching SSH Profiles pattern.
Appearance: font family (9 bundled), font size, theme grid.
Terminal: cursor style/blink, line height, scrollback."
```

#### Subtask 5d: Wire up Settings modal and replace old Appearance menu

- [ ] **Step 8: Update App.tsx**

- Add `settingsModalOpen` state
- Replace `useTerminalFontStore` with `useTerminalConfigStore` everywhere
- Add Settings modal render
- Add "Settings" entry to command palette sections

- [ ] **Step 9: Update SplitToolbar.tsx**

- Replace Appearance drill-down with "Settings" menu item
- Remove the entire `view === "appearance"` branch
- Remove `view` state (no longer needed)
- Remove `useTerminalFontStore` and `useThemeStore` imports (no longer needed here)
- Add `onOpenSettings` prop

- [ ] **Step 10: Update TerminalPane.tsx**

- Replace `useTerminalFontStore` with `useTerminalConfigStore`
- Read `fontFamily`, `cursorStyle`, `cursorBlink`, `lineHeight`, `scrollback` from store
- Apply config values in Terminal constructor options
- Add useEffect for each new config property with appropriate propagation (see spec for per-property strategy)

- [ ] **Step 11: Delete old terminalFontStore.ts**

```bash
git rm src/store/terminalFontStore.ts
```

Update any remaining imports across the codebase.

- [ ] **Step 12: Commit wiring**

```bash
git add -A
git commit -m "feat: wire Settings modal, replace Appearance menu

- Settings modal accessible from More menu and command palette
- Appearance drill-down removed from More menu
- TerminalPane uses consolidated terminalConfigStore
- Delete legacy terminalFontStore.ts"
```

---

## Verification

After all tasks, manually verify:
1. Command palette: no Recent section, Tab jumps categories correctly, footer shows `> Tabs` and `@ SSH`
2. Pomodoro: gear icon toggles settings, steppers work, disabled during running
3. Timer: 4x3 preset grid, cards have better spacing, labels match
4. Settings modal: opens from More menu and command palette, theme/font/terminal settings all persist and apply to open terminals
