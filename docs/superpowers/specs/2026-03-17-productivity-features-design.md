# Productivity Features: Command Palette Redesign, Clipboard History, Cheatsheet System

## Overview

Replace the failed browser/webview approach with three integrated productivity features that reduce context-switching without leaving the terminal. The command palette becomes the central hub for all interactions, redesigned in a Raycast-inspired style.

## Motivation

Users frequently switch away from the terminal to search references, copy commands, and look up syntax. A browser webview was attempted but failed. These three features address the most common context-switching scenarios for developers using the terminal.

## Feature 1: Command Palette Redesign (Raycast Style)

### Visual Overhaul

- **Width:** 540px (existing), constrained by `max-width: calc(100vw - 40px)` for small windows
- **Max height:** 480px with internal scroll
- **Animation open:** `scale(0.98) + opacity(0)` → `scale(1) + opacity(1)`, 150ms ease-out
- **Animation close:** `opacity(1)` → `opacity(0)`, 100ms ease-in
- **Backdrop:** `blur(4px)` + semi-transparent overlay

### Search Bar

- Left: magnifying glass icon (kept)
- Prefix mode: colored badge (e.g., typing `!` shows "Clipboard" badge)
- Right: ESC key hint (kept)

### Result Items

- Layout: `[icon 16x16] [label Pretendard 14px]  ···  [shortcut/meta as kbd keycaps]`
- Hover/active: smooth `background-color` transition (120ms)
- Selected item: system accent color-based highlight

### Category Headers

- Thin divider + category label (uppercase, 11px, muted color)
- Clear visual separation between categories

### Footer

- Prefix hints only (no Navigate/Execute — those are obvious):
  - `> Tabs` `@ Background` `# Connect` `% Layout` `! Clipboard` `? Cheatsheet`

### Prefix Reassignment

| Prefix | Mode | Status |
|--------|------|--------|
| `>` | Tabs | Unchanged |
| `#` | Connection | Unchanged |
| `@` | Background | Unchanged |
| `%` | Layout | Changed from `!` |
| `!` | Clipboard History | **New** |
| `?` | Cheatsheet | **New** |

**Migration:** The `!` prefix changes from Layout to Clipboard History. Code locations to update: `parsePrefix()` in `CommandPalette.tsx`, footer hints, and search bar placeholder text. No user migration needed — this app is pre-1.0 and prefix assignments are not user-configurable.

## Feature 2: Clipboard History

### Entry Point

- `Ctrl+K` → type `!` → clipboard mode
- No dedicated shortcut — command palette is the single entry point

### Data Collection

- Poll system clipboard every 1 second using Tauri window focus events (`appWindow.onFocusChanged()`) to gate polling
- Detect changes by comparing with the previous value
- Add new entries to the history on change
- **Text only** — non-text clipboard content (images, files) is ignored silently
- On clipboard read failure (e.g., clipboard locked by another app), skip silently and retry on next interval

### Storage

- Maximum 50 items, FIFO (oldest removed first)
- Persisted via Zustand `persist` middleware (consistent with existing stores)
- "Clear History" action available in the `!` mode footer

### Display (in Command Palette `!` mode)

- Item: `[clipboard icon] [first 80 chars preview]  ···  [relative time, e.g. "2m ago"]`
- Multi-line text: show first line only
- Fuzzy search supported (reuses existing palette search logic)

### Action

- `Enter` → copy selected item to system clipboard + close palette
- User pastes manually with `Ctrl+V`

### Dependencies

- **Rust:** add `tauri-plugin-clipboard-manager` to `src-tauri/Cargo.toml`
- **npm:** add `@tauri-apps/plugin-clipboard-manager` to `package.json`
- **Tauri config:** register plugin in `src-tauri/src/lib.rs` via `Builder::plugin()`
- **Permissions:** add clipboard read/write permissions in `src-tauri/capabilities/`

## Feature 3: Cheatsheet System

### Bundled Topics (v1)

1. **Vim** — modes, navigation, editing, search, macros
2. **Git** — branching, staging, rebasing, log, remote
3. **Docker** — containers, images, volumes, compose
4. **kubectl** — pods, deployments, services, logs, config

### Data Structure

```typescript
interface CheatsheetItem {
  command: string;      // e.g., "git checkout -b <name>"
  description: string;  // e.g., "Create and switch to new branch"
}

interface CheatsheetCategory {
  name: string;         // e.g., "Branching"
  items: CheatsheetItem[];
}

interface CheatsheetTopic {
  id: string;           // e.g., "git"
  name: string;         // e.g., "Git"
  icon: string;         // SVG icon reference
  categories: CheatsheetCategory[];
}
```

- Stored as TypeScript modules in `src/data/cheatsheets/` (e.g., `git.ts`, `vim.ts`)
- Imported statically — no runtime file loading needed
- Adding a new topic = adding one file + registering in index

### Command Palette (`?` mode) — Drill-down

1. Type `?` → shows 4 topic entries (Vim / Git / Docker / kubectl)
2. Select a topic → palette repopulates with that topic's items, grouped by category
3. **Back navigation:** Backspace when query is empty returns to topic list; ESC closes palette entirely
4. **Direct search:** typing after `?` without selecting a topic (e.g., `?rebase`) fuzzy-filters across all topics
5. **Scoped search:** after selecting a topic, typing filters within that topic only
6. Item display: `[topic icon] [command (JetBrains Mono)]  ···  [description]`
7. `Enter` → copy command to clipboard + close palette

### Side Panel (Cheatsheet Tab)

- New tab added alongside existing Notes / Timers tabs
- `SidebarTab` type extended to `"notes" | "timers" | "cheatsheet"`
- Tab icon: book or document icon (SVG, consistent with existing tab icons)
- Top: topic selector tabs (Vim / Git / Docker / kubectl)
- Body: collapsible sections per category
- Item: command in code style (JetBrains Mono) + description
- Click item → copy command to clipboard + in-app toast "Copied!" (lightweight custom toast component, not OS-level notification)

### Extensibility

- New topics added by creating a new TypeScript file in `src/data/cheatsheets/`
- User-custom cheatsheets: out of scope for v1

## Technical Considerations

### Clipboard Access

- Use Tauri's clipboard plugin (`tauri-plugin-clipboard-manager`) for cross-platform clipboard read/write
- Polling gated by Tauri `appWindow.onFocusChanged()` — starts on focus, stops on blur
- Clipboard changes made while app is unfocused are not captured (acknowledged limitation)

### State Management

- **Clipboard history:** new Zustand store (`clipboardStore.ts`) with `persist` middleware (cleaner alternative to the manual localStorage pattern used in existing stores)
- **Cheatsheet data:** static TypeScript imports, no store needed
- **Command palette prefix state:** extend existing `parsePrefix` function

### Performance

- Cheatsheet data is small (~50KB total for 4 topics), loaded eagerly via static imports
- Clipboard polling at 1s interval has negligible performance impact
- Fuzzy search reuses existing `fuzzyMatch` implementation

## Out of Scope

- Browser/webview integration
- User-custom cheatsheets
- Clipboard history sync across devices
- Dedicated keyboard shortcuts for clipboard/cheatsheet (command palette is the single entry point)
- Web search integration
- GitHub CLI integration
- Capturing clipboard changes while app is unfocused
