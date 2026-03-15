# UX Polish Batch — Design Spec

**Date:** 2026-03-15
**Scope:** 5 independent improvements to v-terminal UX and design

---

## 1. Settings Modal (Appearance + Terminal)

### Problem
Appearance settings (theme, font) are buried in a drill-down submenu inside the More (⋯) menu. The UI feels disconnected from the rest of the app and doesn't scale for future settings.

### Solution
A new **Settings modal** with 2-column layout, matching the SSH Profiles modal pattern.

### Layout
- **Header:** Gear icon + "Settings" title + close (×) button
- **Left nav (170px):** Section list — Appearance, Terminal
- **Right content:** Settings for the selected section, scrollable

### Appearance Section

**Font** (top of section):
- **Font family** — dropdown selector with live code preview below
  - Bundled fonts (9 total): JetBrains Mono (default), Fira Code, Cascadia Code, Source Code Pro, IBM Plex Mono, Hack, Inconsolata, Monaspace (GitHub), Sarasa Mono K
  - All fonts bundled via `@font-face` in the app
  - Live preview: ~4 lines of syntax-highlighted code in the selected font
- **Font size** — `[-] 14px [+]` stepper control
  - Sublabel: "Also adjustable with Ctrl +/-"

**Theme** (below font, separated by divider):
- 3-column grid of theme cards
- Each card: background color + 3 colored lines (simulating code) + theme name label
- Active card: blue border highlight
- All 16 existing themes displayed

### Terminal Section

**Cursor:**
- Cursor style — dropdown: Block / Underline / Bar (currently hardcoded: block)
- Cursor blink — iOS-style toggle (currently hardcoded: true)

**Display:**
- Line height — numeric input, range 1.0–1.6 (currently hardcoded: 1.2)
- Scrollback lines — numeric input, range 1,000–10,000 (currently hardcoded: 5000)

### More Menu Changes
- **Remove:** Appearance drill-down (main → appearance submenu)
- **Add:** "Settings" menu item that opens the Settings modal
- **Keep:** Layout buttons, Broadcast toggle, SSH Manager, Help/About

### State Persistence
- Font family: new Zustand store → localStorage (`v-terminal:terminal-font-family`)
- Cursor style, cursor blink, line height, scrollback: new Zustand store → localStorage (`v-terminal:terminal-config`)
- Theme and font size: existing stores unchanged

### Technical Notes
- Modal component: `src/components/SettingsModal/SettingsModal.tsx` + `.css`
- Open/close state managed in `App.tsx` (same pattern as SSH modal)
- Font files bundled in `src/assets/fonts/` or loaded via `@font-face` from a CDN-free local path
- TerminalPane reads new config values from store and applies on change

---

## 2. Command Palette — Footer Hints

### Problem
Users don't know about `>` (tab filter) and `@` (SSH filter) prefix features. No in-UI guidance exists.

### Solution
Update the footer hint bar in the command palette.

### Changes
**Current footer:**
```
↑↓ Navigate  ↵ Execute  Tab Jump  Ctrl K Close
```

**New footer:**
```
↑↓ Navigate  ↵ Execute  Tab Jump  > Tabs  @ SSH
```

- Remove `Ctrl K Close` (redundant — ESC badge already shown in search row)
- Add `> Tabs` and `@ SSH` hints in the same `<kbd>` + label style

### Files
- `src/components/CommandPalette/CommandPalette.tsx` — lines 527-531

---

## 3. Command Palette — Remove Recent Section

### Problem
The Recent section adds visual complexity to an already feature-rich command palette. It also causes a Tab-jump bug: when activeIndex is 0 (first Recent item), pressing Tab jumps within Recent's mixed categories instead of jumping to the next main category.

### Solution
Remove the Recent commands feature entirely.

### Changes
- Delete `RECENT_KEY`, `MAX_RECENT`, `getRecent()`, `pushRecent()` functions
- Remove `recentIds`, `recentCommands` useMemo hooks
- Remove `renderRecent()` function
- Remove Recent rendering from the list (`{renderRecent()}`)
- Update `totalCount` to just `filtered.length`
- Update `resolveCommandAtIndex` — no offset needed
- Update `buildFlatList` — no recent items
- Simplify `jumpCategory` — no mixed-source items
- Clean up localStorage: remove `v-terminal:cp-recent` key handling

### Files
- `src/components/CommandPalette/CommandPalette.tsx`

---

## 4. Pomodoro — Settings UX

### Problem
Pomodoro settings (focus/break/long break durations, sessions count) are always visible and editable, even during a running session. Editing values mid-session causes unexpected behavior.

### Solution
Hide settings by default; disable editing during active sessions.

### Changes

**Gear toggle button:**
- Add a gear icon button (proper cog SVG) next to Pause/Reset controls
- Clicking toggles the settings panel visibility
- Button highlights (accent color) when settings are open

**Settings visibility:**
- Default: hidden
- Toggle: click gear icon to show/hide
- Animation: fade-in with translateY(-4px), 0.15s ease

**Disabled state during active session:**
- When `phase !== "idle"`: all inputs disabled, opacity 0.3
- Show hint text: "Reset to edit" (right-aligned, italic, small)
- When `phase === "idle"`: inputs enabled, hint hidden

**Gear icon fix:**
- Replace current sun-like icon (circle + radiating lines) with proper cog/gear SVG path

### Files
- `src/components/AlarmPanel/PomodoroSection.tsx`
- `src/components/AlarmPanel/AlarmPanel.css`

---

## 5. Timer Section — Preset Grid & Card Polish

### Problem
Timer presets are 5 tiny buttons in a single row. Custom input (label + minutes + add button) adds unnecessary complexity. Timer cards feel tight with cramped spacing.

### Solution
Replace presets + custom input with a spacious preset grid. Polish timer cards.

### Preset Grid Changes

**Remove:**
- Custom input row (label input + minutes input + add button)
- `customLabel` and `customMinutes` state
- `handleAddCustom()` function

**Replace with 4×3 grid (12 presets):**
```
 1m    3m    5m   10m
15m   20m   25m   30m
45m    1h  1.5h    2h
```

- Grid: `grid-template-columns: repeat(4, 1fr)`, gap 6px
- Buttons: 8px vertical padding, border-radius 8px, JetBrains Mono font
- Hover: background lighten, border-color lighten
- Active: accent-tinted background

### Timer Card Changes

| Property | Current | Improved |
|----------|---------|----------|
| min-height | 36px | 42px |
| padding | 4px 8px | 6px 10px |
| gap | 6px | 8px |
| margin-bottom | 4px | 6px |
| border-radius | 6px (var) | 8px |
| progress opacity | 8% | 14% |
| play button bg | none | rgba(255,255,255,0.05) |
| play button size | 24px | 26px |
| time font-size | 12px | 13px |
| time color | label-secondary | label-primary |
| label font-weight | normal | 500 |

### Files
- `src/components/AlarmPanel/TimerSection.tsx`
- `src/components/AlarmPanel/AlarmPanel.css`

---

## Items Deferred

- **Close animation:** Already implemented (`cp-panel-out`). No changes needed.
- **TUI scroll bug:** Intermittent, reproduction unclear. Needs separate debugging session.

---

## Implementation Order (suggested)

Each item is independent and can be implemented in any order.

1. **Command Palette — Remove Recent** (smallest, fixes Tab bug)
2. **Command Palette — Footer Hints** (one-line change)
3. **Pomodoro — Settings UX** (contained to one component)
4. **Timer — Preset Grid & Card Polish** (contained to one component + CSS)
5. **Settings Modal** (largest — new component, store changes, More menu refactor)
