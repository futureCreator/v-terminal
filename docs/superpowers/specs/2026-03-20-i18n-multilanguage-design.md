# i18n Multilanguage Support Design

**Date:** 2026-03-20
**Status:** Approved
**Scope:** Add internationalization (i18n) support with English and Korean

---

## Overview

Add multilanguage support to v-terminal using react-i18next. The app will auto-detect the OS language on first launch and allow users to change the language from the Appearance settings tab. Initial supported languages: English (en) and Korean (ko).

---

## Architecture

### Library Choice

- **react-i18next** + **i18next** — industry standard for React i18n
- Provides: variable interpolation, pluralization, reactive re-rendering on language change
- No need for custom hooks or reinventing the wheel

### Translation File Structure

Single-file-per-language approach (no namespaces):

```
src/
  locales/
    en.json      # English (fallback language)
    ko.json      # Korean
  i18n.ts        # i18next initialization
```

Keys use dot notation for categorization:
- `settings.appearance.font` — Settings labels
- `command.newTab` — Command palette entries
- `welcome.slide1.title` — Welcome page slides
- `ssh.authTitle` — SSH dialogs
- `toast.welcomePageReset` — Toast notifications
- `common.save` — Shared terms

Estimated total: ~150-180 translation keys.

### Language Detection and Storage

**No separate Zustand store.** Use i18next's built-in language state + manual localStorage persistence:

- On init: read `localStorage.getItem("v-terminal:locale")`, fallback to `navigator.language` detection, fallback to `'en'`
- On change: `i18next.changeLanguage(lng)` + `localStorage.setItem("v-terminal:locale", lng)`
- `useTranslation()` hook from react-i18next already provides reactivity — a Zustand store would be a redundant second source of truth
- The settings UI reads `i18n.language` and calls a `changeLanguage` helper that handles both i18next and localStorage

**Initial language resolution order:**
1. Saved value in localStorage (user's previous choice)
2. OS language via `navigator.language` (ko/ko-KR → `ko`, everything else → `en`)
3. Fallback: `en`

### Initialization Flow

1. `main.tsx` imports `src/i18n.ts`
2. `i18n.ts` checks localStorage for saved locale
3. If none, detects OS language via `navigator.language`
4. Calls `i18next.init({ lng: detectedLocale, fallbackLng: 'en' })`
5. React app renders with correct language from the start

---

## Settings UI

**Location:** Appearance tab in SettingsModal, **top of the tab** (above Theme).

**Control:** Dropdown or segment control with two options:
- `English`
- `한국어`

**Behavior:**
- Selection applies immediately — no restart required
- react-i18next triggers re-render of all components using `t()`
- Selection is persisted to localStorage

---

## Translation Scope

All user-facing text in the app will be translated:

### settings.*
- Tab names: Appearance, Terminal, Browser
- Labels: Font, Font Size, Theme, Cursor Style, Cursor Blink, Line Height, Scrollback Lines, Home Page, Language
- Values: Auto, Block, Underline, Bar
- Onboarding: Show Welcome Page
- Warning: "Font not available — using fallback"

### command.*
- Command names: New Tab, Close Current Tab, Enable Broadcast, Disable Broadcast, Previous Tab, Next Tab, Show Toolkit, Hide Toolkit, Show Browser, Hide Browser, SSH Profiles, Settings, Zoom Current Panel, Previous Panel, Next Panel
- Layout options: 1 Panel, 2 Panels, 3 Panels, etc.
- Command descriptions: "Open a new terminal tab", "Close the active tab", "Split the current tab into {{layout}}", etc.
- **Dynamic/toggle labels:** Use separate keys for each state (e.g., `command.enableBroadcast` / `command.disableBroadcast`), selected via ternary in the command builder
- **Interpolated descriptions:** Use i18next interpolation syntax: `t('command.splitLayout', { layout: '2 panels' })`

### commandPalette.*
- Placeholder texts: "Search commands...", "Switch to tab...", "Switch connection...", "Change layout...", "Restore background tab...", "Search clipboard history..."
- Empty state: "No results for \"{{query}}\"", "Try"
- Footer hints: "> Tabs", "@ Background", "# Connect", "% Layout", "! Clipboard"
- Mode badges: "Tabs", "Connection", "Layout", "Background", "Clipboard"

### welcome.*
- Slide titles and descriptions (4 slides)
- Keyboard shortcut labels
- **Conversion strategy:** `slides.ts` will export an array of translation key identifiers (not raw strings). The consuming `WelcomePage.tsx` component calls `t()` with these keys to get localized text. Example: `slides` exports `{ headlineKey: 'welcome.slide1.title', descriptionKey: 'welcome.slide1.description' }`, and `WelcomePage.tsx` renders `t(slide.headlineKey)`.

### session.*
- "Layout", "Connection", "All Same", "Per Panel"
- "Local Shell", "PowerShell", "Note", "Markdown editor"
- "Panel {{n}}", "Open"

### ssh.*
- "SSH Authentication"
- "No SSH key found for this host. Enter the password for the remote server."
- "Authentication failed. Please try again."
- "SSH Profiles", "Saved Servers", "Add Server"
- "No saved servers", "Click + to add your first server"
- "Name", "Host", "Port", "Username", "Identity File", "(optional)"
- "Command Preview"

### wsl.*
- "WSL Authentication"

### browser.*
- "Browser", "Back", "Forward", "Reload", "Home"
- "Enter URL...", "Retry"

### tab.*
- "Close Tab"

### window.*
- "Minimize", "Maximize", "Zoom", "Close"

### toast.*
- "Welcome page will show on next new tab"

### timer.*
- "Focus", "Break", "Long Break"
- "Start", "Pause", "Resume", "Reset", "Settings"
- "Active Timers", "Clear Done", "Done", "Remove"
- "Select a preset to start a timer"
- "{{count}} sessions", "before long break", "Sessions"

### alarm.*
- Weekday labels: "Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"
- "No alarms set", "New Alarm", "Add Alarm"
- "Label (optional)"

### todo.*
- Todo panel labels and actions

### note.*
- Note panel labels
- Placeholder: "Type your markdown note here..."

### connection.*
- "Connection lost", "Click to reconnect", "Connecting..."
- "Password", "Connect", "Cancel", "New Session"

### common.*
- Save, Cancel, Delete, Confirm, Close, Open, etc.

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/i18n.ts` | i18next initialization and configuration |
| `src/locales/en.json` | English translations |
| `src/locales/ko.json` | Korean translations |

## Files to Modify

| File | Change |
|------|--------|
| `src/main.tsx` | Import `i18n.ts` before app render |
| `src/App.tsx` | Replace hardcoded strings with `t()` |
| `src/components/SettingsModal/SettingsModal.tsx` | Add Language selector to Appearance tab, replace strings with `t()` |
| `src/components/SettingsModal/SettingsModal.css` | Style for Language selector |
| `src/components/TitleBar/TitleBar.tsx` | Replace hardcoded strings with `t()` |
| `src/components/TabBar/TabBar.tsx` | Replace hardcoded strings with `t()` |
| `src/components/SplitToolbar/SplitToolbar.tsx` | Replace hardcoded strings with `t()` |
| `src/components/TerminalPane/TerminalPane.tsx` | Replace hardcoded strings with `t()` |
| `src/components/PanelContextMenu/PanelContextMenu.tsx` | Replace hardcoded strings with `t()` |
| `src/components/SessionPicker/SessionPicker.tsx` | Replace hardcoded strings with `t()` |
| `src/components/SidePanel/SidePanel.tsx` | Replace hardcoded strings with `t()` |
| `src/components/SidePanel/TimersPanel.tsx` | Replace hardcoded strings with `t()` |
| `src/components/NotePanel/NotePanel.tsx` | Replace hardcoded strings with `t()` |
| `src/components/NotePanel/NoteEditor.tsx` | Replace placeholder text with `t()` |
| `src/components/NotePanel/TodoSection.tsx` | Replace hardcoded strings with `t()` |
| `src/components/CommandPalette/CommandPalette.tsx` | Replace hardcoded strings with `t()` |
| `src/components/WelcomePage/WelcomePage.tsx` | Use `t()` to render slide content |
| `src/components/WelcomePage/slides.ts` | Export translation key identifiers instead of raw strings |
| `src/components/SshManager/SshManagerModal.tsx` | Replace hardcoded strings with `t()` |
| `src/components/LeftBrowserPanel/LeftBrowserPanel.tsx` | Replace hardcoded strings with `t()` |
| `src/components/AlarmPanel/PomodoroSection.tsx` | Replace hardcoded strings with `t()` |
| `src/components/AlarmPanel/TimerSection.tsx` | Replace hardcoded strings with `t()` |
| `src/components/AlarmPanel/RecurringSection.tsx` | Replace hardcoded strings with `t()` |
| `src/lib/paletteCommands.tsx` | Replace hardcoded strings with `t()`, use separate keys for toggle states |
| `src/hooks/usePasswordDialog.ts` | Replace default title string with `t()` |
| `package.json` | Add react-i18next, i18next dependencies |
| `CLAUDE.md` | Update language policy to reflect i18n |

## Files NOT Modified

- `src-tauri/` (Rust backend) — no UI text lives in the backend
- Theme/style files — no text changes needed
- Existing store files — no text in existing stores

---

## CLAUDE.md Update

**Current:**
> 모든 내용은 영어로 표시할 것. 터미널에서 대부분의 작업이 영어이기 때문에 자연스럽게 영어로 입력을 하게하기 위함.

**Updated:**
> UI 텍스트는 react-i18next를 통해 다국어로 제공 (현재 영어/한국어 지원). 번역 키는 `src/locales/` 하위 JSON 파일에서 관리. 새로운 UI 문자열 추가 시 반드시 번역 파일에 등록하고 `t()` 함수를 사용할 것. 하드코딩 금지.

---

## Design Decisions

1. **OS auto-detect for initial language** — reduces friction for Korean users while defaulting to English for everyone else
2. **Single translation file per language** — ~150-180 keys doesn't warrant namespace splitting; YAGNI
3. **react-i18next over custom implementation** — proven library handles edge cases (plurals, interpolation, reactive updates)
4. **Language selector in Appearance tab** — avoids empty General tab; language is a visual/presentation concern
5. **Immediate application** — no restart needed; react-i18next handles reactive re-rendering
6. **English as fallback** — if a Korean translation key is missing, English is shown instead of a blank
7. **No separate Zustand store for locale** — i18next's built-in language state + `useTranslation()` reactivity is sufficient; avoids dual source of truth
8. **Separate keys for toggle commands** — clearer than interpolation for binary states (enable/disable, show/hide)
9. **slides.ts exports key identifiers** — keeps the data structure intact while delegating localization to the rendering component
