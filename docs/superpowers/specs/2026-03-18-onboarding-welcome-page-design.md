# Onboarding Welcome Page Design

**Date:** 2026-03-18
**Version:** v0.10.0 (target)

## Overview

Add a full-screen Welcome Page that appears on first launch only. It introduces power users (switching from other terminals) to v-terminal's key differentiators through 3 slides. After viewing, users proceed to the existing SessionPicker flow. The Welcome Page can be re-accessed from Settings.

## Target User

Power users migrating from other terminals (Windows Terminal, iTerm, etc.) who need to quickly understand what makes v-terminal different.

## Flow

```
App launch → check localStorage "v-terminal:onboarding-done"
  ├─ not set → render WelcomePage (3 slides)
  │              └─ "Get Started" click → set flag → transition to SessionPicker
  └─ set     → existing flow (SessionPicker directly)
```

Re-access: Settings modal → "Show Welcome Page" button → resets flag → next new tab shows WelcomePage.

## Slide Content

### Slide 1: Command Palette

- **Headline:** "Everything at your fingertips"
- **Description:** "Press Ctrl+K to access tabs, layouts, clipboard history, cheatsheets, and more. No mouse needed."
- **Visual:** CSS illustration of command palette UI (search bar + item list)
- **Shortcut badge:** `Ctrl` + `K`

### Slide 2: Claude Code Panel

- **Headline:** "Built for Claude Code users"
- **Description:** "Edit CLAUDE.md files, view git diffs, and track your token usage — all without leaving the terminal."
- **Visual:** CSS illustration of left sidebar with CLAUDE.md editor / Git / Dashboard tabs
- **Shortcut badge:** `Ctrl` + `Shift` + `L`

### Slide 3: Productivity Tools

- **Headline:** "Stay focused, stay in flow"
- **Description:** "Notes, Pomodoro timers, and cheatsheets live in your sidebar. No app switching needed."
- **Visual:** CSS illustration of right sidebar with Notes / Timers tabs
- **Shortcut badge:** `Ctrl` + `Shift` + `N`

## UI Design

### Layout

- Full-screen, centered content
- Content area max-width: ~800px
- Each slide: visual area on top, text below
- Dark/light theme support (follows system theme via existing themeStore)

### Navigation

- **Bottom center:** Dot indicator (3 dots), active dot highlighted
- **Bottom right:** "Next" button → changes to "Get Started" on last slide
- **Bottom left:** "Skip" text button (hidden on last slide)
- **Keyboard:** Left/Right arrows to navigate, Enter for Next/Get Started

### Transitions

- Horizontal slide animation between slides (300ms ease-out)
- Visual elements: fade-in + subtle upward motion (Apple style)

### Visual Style

- CSS-only UI illustrations (no screenshots — maintainable, theme-adaptive)
- Shortcut keys displayed as keycap-style badges (rounded rect with subtle shadow, like physical keyboard keys)
- Pretendard font for UI text, JetBrains Mono for shortcut badges
- Consistent with existing app design language (frosted glass, rounded corners)

## Component Architecture

### New Files

- `src/components/WelcomePage/WelcomePage.tsx` — Main component with slide state, navigation, keyboard handling
- `src/components/WelcomePage/WelcomePage.css` — Styles including slide animations, illustrations, theme variants
- `src/components/WelcomePage/slides.ts` — Slide content data (headline, description, shortcut)

### Modified Files

- `src/App.tsx` — Conditional rendering: WelcomePage when `pendingSessionPick && !onboardingDone`
- `src/components/SettingsModal/SettingsModal.tsx` — Add "Show Welcome Page" button

### State Management

- `localStorage` key: `v-terminal:onboarding-done` (string `"true"`)
- No Zustand store needed — simple flag read/write via localStorage
- `App.tsx` reads flag on mount with `useState(() => localStorage.getItem(...))`

## Interaction Details

### First Launch

1. App starts → `onboardingDone` is `false`
2. WelcomePage renders (slide 1 visible)
3. User navigates slides via Next button, arrow keys, or dot clicks
4. On "Get Started" click (or Skip at any point):
   - `localStorage.setItem("v-terminal:onboarding-done", "true")`
   - WelcomePage unmounts with fade-out
   - SessionPicker appears

### Re-access from Settings

1. User opens Settings modal
2. Clicks "Show Welcome Page" button
3. `localStorage.removeItem("v-terminal:onboarding-done")`
4. Toast notification: "Welcome page will show on next new tab"
5. Next tab with `pendingSessionPick` will show WelcomePage instead of SessionPicker

### Keyboard Navigation

| Key | Action |
|-----|--------|
| `→` or `ArrowRight` | Next slide |
| `←` or `ArrowLeft` | Previous slide |
| `Enter` | Next / Get Started |
| `Escape` | Skip (same as clicking Skip) |

## Accessibility

- Dot indicators have `aria-label` ("Slide 1 of 3", etc.)
- Buttons are focusable with visible focus rings
- Slide transitions respect `prefers-reduced-motion` (instant switch instead of animation)
- All text meets WCAG AA contrast ratio in both themes

## Edge Cases

- **Window resize during Welcome:** CSS layout adapts (max-width + centered)
- **Multiple tabs:** Only the first tab with `pendingSessionPick` shows Welcome. Subsequent new tabs go straight to SessionPicker since flag is already set.
- **Settings reset:** Removing `v-terminal:onboarding-done` from localStorage or clicking "Show Welcome Page" in Settings brings it back.

## Out of Scope

- Interactive tutorial / step-by-step walkthrough
- Video content or animated GIFs
- SSH feature introduction
- Multi-panel layout introduction
- Analytics / tracking of slide views
