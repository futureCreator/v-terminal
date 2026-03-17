# Productivity Features Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add clipboard history, cheatsheet system, and Raycast-style command palette redesign to reduce context-switching out of the terminal.

**Architecture:** The command palette is the central hub — clipboard history (`!` prefix) and cheatsheet (`?` prefix) are accessed through it. Cheatsheet also has a dedicated SidePanel tab for full browsing. Clipboard polling uses Tauri's clipboard plugin gated by window focus events.

**Tech Stack:** Tauri 2, React 18, Zustand 4, tauri-plugin-clipboard-manager, TypeScript

**Spec:** `docs/superpowers/specs/2026-03-17-productivity-features-design.md`

---

## Chunk 1: Infrastructure & Prefix Reassignment

### Task 1: Add Tauri Clipboard Plugin

**Files:**
- Modify: `src-tauri/Cargo.toml:26` (add dependency)
- Modify: `src-tauri/src/lib.rs:183` (register plugin)
- Modify: `src-tauri/capabilities/default.json:27` (add permissions)
- Modify: `package.json` (add npm dependency)

- [ ] **Step 1: Add Rust dependency**

In `src-tauri/Cargo.toml`, add after line 26 (`tauri-plugin-notification = "2"`):

```toml
tauri-plugin-clipboard-manager = "2"
```

- [ ] **Step 2: Register plugin in Tauri builder**

In `src-tauri/src/lib.rs`, add after line 183 (`.plugin(tauri_plugin_notification::init())`):

```rust
.plugin(tauri_plugin_clipboard_manager::init())
```

- [ ] **Step 3: Add clipboard permissions**

In `src-tauri/capabilities/default.json`, add to the `permissions` array:

```json
"clipboard-manager:allow-read-text",
"clipboard-manager:allow-write-text"
```

- [ ] **Step 4: Install npm package**

Run:
```bash
pnpm add @tauri-apps/plugin-clipboard-manager
```

- [ ] **Step 5: Verify build compiles**

Run:
```bash
pnpm tauri build --debug 2>&1 | tail -20
```
Expected: Build succeeds without errors.

- [ ] **Step 6: Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/src/lib.rs src-tauri/capabilities/default.json package.json pnpm-lock.yaml
git commit -m "feat: add tauri clipboard manager plugin"
```

---

### Task 2: Reassign Command Palette Prefixes

**Files:**
- Modify: `src/components/CommandPalette/CommandPalette.tsx:100-119` (parsePrefix)
- Modify: `src/components/CommandPalette/CommandPalette.tsx:431` (modeLabel)
- Modify: `src/components/CommandPalette/CommandPalette.tsx:452-454` (placeholder)
- Modify: `src/components/CommandPalette/CommandPalette.tsx:483-489` (footer)

- [ ] **Step 1: Update PrefixMode type and parsePrefix function**

In `CommandPalette.tsx`, replace lines 102-119:

```typescript
type PrefixMode = "all" | "tabs" | "layout" | "connection" | "background" | "clipboard" | "cheatsheet";

function parsePrefix(raw: string): { mode: PrefixMode; query: string } {
  const trimmed = raw.trimStart();
  if (trimmed.startsWith(">")) {
    return { mode: "tabs", query: trimmed.slice(1).trimStart() };
  }
  if (trimmed.startsWith("#")) {
    return { mode: "connection", query: trimmed.slice(1).trimStart() };
  }
  if (trimmed.startsWith("%")) {
    return { mode: "layout", query: trimmed.slice(1).trimStart() };
  }
  if (trimmed.startsWith("@")) {
    return { mode: "background", query: trimmed.slice(1).trimStart() };
  }
  if (trimmed.startsWith("!")) {
    return { mode: "clipboard", query: trimmed.slice(1).trimStart() };
  }
  if (trimmed.startsWith("?")) {
    return { mode: "cheatsheet", query: trimmed.slice(1).trimStart() };
  }
  return { mode: "all", query: trimmed };
}
```

- [ ] **Step 2: Update filtered logic for new modes**

In the `filtered` useMemo (around line 155), add cases for new modes. For now, add empty filters (clipboard and cheatsheet sections will be added in later tasks):

```typescript
} else if (mode === "clipboard") {
  pool = pool.filter((c) => c.category === "Clipboard");
} else if (mode === "cheatsheet") {
  // When query is empty, show only topic entries (drill-down entry points)
  // When query is typed, show all cheatsheet items for cross-topic search
  if (!q) {
    pool = pool.filter((c) => c.category === "Cheatsheet Topics" || c.category === "Cheatsheet");
    // Further filter: if "Cheatsheet Topics" category, only show topic entries (id starts with "cheatsheet-topic:")
    pool = pool.filter((c) => c.category === "Cheatsheet" || c.id.startsWith("cheatsheet-topic:"));
  } else {
    pool = pool.filter((c) => c.category === "Cheatsheet Topics" || c.category === "Cheatsheet");
    // Exclude topic entries from search results — only show actual cheatsheet items
    pool = pool.filter((c) => !c.id.startsWith("cheatsheet-topic:"));
  }
}
```

- [ ] **Step 3: Update modeLabel**

Replace the modeLabel line (around line 431):

```typescript
const modeLabel = mode === "tabs" ? "Tabs" : mode === "connection" ? "Connection" : mode === "layout" ? "Layout" : mode === "background" ? "Background" : mode === "clipboard" ? "Clipboard" : mode === "cheatsheet" ? "Cheatsheet" : null;
```

- [ ] **Step 4: Update placeholder text**

Update the input placeholder (around line 454):

```typescript
placeholder={mode === "tabs" ? "Switch to tab..." : mode === "connection" ? "Switch connection..." : mode === "layout" ? "Change layout..." : mode === "background" ? "Restore background tab..." : mode === "clipboard" ? "Search clipboard history..." : mode === "cheatsheet" ? "Search cheatsheets..." : "Search commands..."}
```

- [ ] **Step 5: Update footer hints**

Replace the footer section (around lines 483-489):

```tsx
<div className="cp-footer">
  <span className="cp-hint"><kbd>&gt;</kbd> Tabs</span>
  <span className="cp-hint"><kbd>@</kbd> Background</span>
  <span className="cp-hint"><kbd>#</kbd> Connect</span>
  <span className="cp-hint"><kbd>%</kbd> Layout</span>
  <span className="cp-hint"><kbd>!</kbd> Clipboard</span>
  <span className="cp-hint"><kbd>?</kbd> Cheatsheet</span>
</div>
```

- [ ] **Step 6: Verify — open app, press Ctrl+K**

Run: `pnpm tauri dev`
Expected:
- Footer shows 6 prefix hints: `> Tabs`, `@ Background`, `# Connect`, `% Layout`, `! Clipboard`, `? Cheatsheet`
- Typing `%` shows "Layout" badge and layout options
- Typing `!` shows "Clipboard" badge (empty list for now)
- Typing `?` shows "Cheatsheet" badge (empty list for now)

- [ ] **Step 7: Commit**

```bash
git add src/components/CommandPalette/CommandPalette.tsx
git commit -m "refactor: reassign command palette prefixes (! clipboard, ? cheatsheet, % layout)"
```

---

## Chunk 2: Clipboard History

### Task 3: Create Clipboard Store

**Files:**
- Create: `src/store/clipboardStore.ts`

- [ ] **Step 1: Create the clipboard store**

Create `src/store/clipboardStore.ts`. Follow the existing manual localStorage pattern used by all other stores in this codebase:

```typescript
import { create } from "zustand";

const STORAGE_KEY = "v-terminal:clipboard-history";
const MAX_ITEMS = 50;

export interface ClipboardEntry {
  id: string;
  text: string;
  copiedAt: number; // Date.now()
}

interface ClipboardStore {
  entries: ClipboardEntry[];
  addEntry: (text: string) => void;
  clearHistory: () => void;
}

function load(): ClipboardEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

function save(entries: ClipboardEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // silently ignore
  }
}

let nextId = 1;

export const useClipboardStore = create<ClipboardStore>((set, get) => ({
  entries: load(),

  addEntry: (text: string) => {
    const { entries } = get();
    // Skip if identical to most recent entry
    if (entries.length > 0 && entries[0].text === text) return;
    // Remove duplicate if exists elsewhere
    const filtered = entries.filter((e) => e.text !== text);
    const newEntry: ClipboardEntry = {
      id: `clip-${Date.now()}-${nextId++}`,
      text,
      copiedAt: Date.now(),
    };
    const updated = [newEntry, ...filtered].slice(0, MAX_ITEMS);
    save(updated);
    set({ entries: updated });
  },

  clearHistory: () => {
    save([]);
    set({ entries: [] });
  },
}));
```

- [ ] **Step 2: Commit**

```bash
git add src/store/clipboardStore.ts
git commit -m "feat: add clipboard history store with localStorage persistence"
```

---

### Task 4: Create Clipboard Polling Hook

**Files:**
- Create: `src/hooks/useClipboardPolling.ts`

- [ ] **Step 1: Create the polling hook**

Create `src/hooks/useClipboardPolling.ts`:

```typescript
import { useEffect, useRef } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { readText } from "@tauri-apps/plugin-clipboard-manager";
import { useClipboardStore } from "../store/clipboardStore";

const POLL_INTERVAL_MS = 1000;

export function useClipboardPolling() {
  const addEntry = useClipboardStore((s) => s.addEntry);
  const lastTextRef = useRef<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const appWindow = getCurrentWindow();

    const poll = async () => {
      try {
        const text = await readText();
        if (text && text !== lastTextRef.current) {
          lastTextRef.current = text;
          addEntry(text);
        }
      } catch {
        // clipboard read failed (locked, non-text content, etc.) — skip silently
      }
    };

    const startPolling = () => {
      if (intervalRef.current) return;
      // Poll immediately on focus
      poll();
      intervalRef.current = setInterval(poll, POLL_INTERVAL_MS);
    };

    const stopPolling = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    // Start polling if window is already focused
    startPolling();

    const unlisten = appWindow.onFocusChanged(({ payload: focused }) => {
      if (focused) startPolling();
      else stopPolling();
    });

    return () => {
      stopPolling();
      unlisten.then((fn) => fn());
    };
  }, [addEntry]);
}
```

- [ ] **Step 2: Wire the hook into App.tsx**

In `src/App.tsx`, add import at top:

```typescript
import { useClipboardPolling } from "./hooks/useClipboardPolling";
```

Inside the `App()` function body, add the hook call (after the existing `useAlarmTick()` call):

```typescript
useClipboardPolling();
```

- [ ] **Step 3: Verify — copy text, check console**

Run: `pnpm tauri dev`
- Copy some text to clipboard externally
- Open DevTools, check that no errors appear
- The clipboard store should now have entries (verify via DevTools → Application → Local Storage → `v-terminal:clipboard-history`)

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useClipboardPolling.ts src/App.tsx
git commit -m "feat: add clipboard polling hook with window focus gating"
```

---

### Task 5: Integrate Clipboard History into Command Palette

**Files:**
- Modify: `src/App.tsx` (add clipboardPaletteSection, pass to CommandPalette)

- [ ] **Step 1: Add clipboard palette section in App.tsx**

In `src/App.tsx`, add import:

```typescript
import { useClipboardStore } from "./store/clipboardStore";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
```

After the `backgroundTabsPaletteSection` useMemo (around line 602), add:

```typescript
const clipboardEntries = useClipboardStore((s) => s.entries);
const clearClipboardHistory = useClipboardStore((s) => s.clearHistory);

const clipboardPaletteSection = useMemo<PaletteSection>(() => {
  const formatRelativeTime = (timestamp: number): string => {
    const diff = Date.now() - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (seconds < 60) return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const commands = clipboardEntries.map((entry) => {
    const preview = entry.text.split("\n")[0].slice(0, 80);
    return {
      id: `clip:${entry.id}`,
      label: preview,
      meta: formatRelativeTime(entry.copiedAt),
      icon: (
        <span className="cp-cmd-icon">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <rect x="3" y="1" width="8" height="2" rx="1" stroke="currentColor" strokeWidth="1.1" />
            <rect x="2" y="2.5" width="10" height="10.5" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        </span>
      ),
      action: async () => {
        try {
          await writeText(entry.text);
        } catch {
          // write failed — silently ignore
        }
      },
    };
  });

  // Add "Clear History" action at the end if there are entries
  if (clipboardEntries.length > 0) {
    commands.push({
      id: "clip:clear",
      label: "Clear Clipboard History",
      meta: "",
      icon: (
        <span className="cp-cmd-icon">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3 4h8M5.5 4V3h3v1M4 4v7.5a1 1 0 001 1h4a1 1 0 001-1V4" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      ),
      action: () => { clearClipboardHistory(); },
    });
  }

  return { category: "Clipboard", commands };
}, [clipboardEntries, clearClipboardHistory]); // reactive to clipboard changes
```

- [ ] **Step 2: Pass clipboard section to CommandPalette**

Update the `extraSections` prop on `<CommandPalette>` (around line 840):

```tsx
extraSections={[
  tabPaletteSection,
  tabListPaletteSection,
  ...(switchConnectionPaletteSection ? [switchConnectionPaletteSection] : []),
  ...(backgroundTabsPaletteSection ? [backgroundTabsPaletteSection] : []),
  layoutPaletteSection,
  clipboardPaletteSection,
]}
```

- [ ] **Step 3: Verify — Ctrl+K → type `!`**

Run: `pnpm tauri dev`
- Copy several texts to clipboard
- Press Ctrl+K, type `!`
- Expected: "Clipboard" badge appears, clipboard entries show with preview text and relative time
- Select an entry, press Enter → text is copied to clipboard

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat: integrate clipboard history into command palette with ! prefix"
```

---

## Chunk 3: Command Palette Visual Redesign

### Task 6: Raycast-Style CSS Refresh

**Files:**
- Modify: `src/components/CommandPalette/CommandPalette.css` (visual overhaul)

- [ ] **Step 1: Update item styling for Raycast look**

In `CommandPalette.css`, update `.cp-item` (line 203) to increase density and polish:

```css
.cp-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 10px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  user-select: none;
  transition: background 0.12s ease;
  color: var(--label-secondary);
  min-height: 36px;
}

.cp-item--highlighted {
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  color: var(--label-primary);
}
```

- [ ] **Step 2: Style meta as kbd keycaps**

Update `.cp-item-meta` (line 255):

```css
.cp-item-meta {
  font-family: "Pretendard", sans-serif;
  font-size: 11px;
  font-weight: 500;
  color: var(--label-tertiary);
  background: var(--bg-tertiary);
  border: 1px solid var(--separator-strong);
  border-radius: var(--radius-xs);
  padding: 2px 6px;
  white-space: nowrap;
  flex-shrink: 0;
  line-height: 1.5;
}
```

- [ ] **Step 3: Refine animation timing**

Update the panel-in animation (line 53):

```css
@keyframes cp-panel-in {
  from { opacity: 0; transform: scale(0.98) translateY(-8px); }
  to   { opacity: 1; transform: scale(1)    translateY(0); }
}
```

- [ ] **Step 4: Verify visual changes**

Run: `pnpm tauri dev`
- Press Ctrl+K
- Check: items have subtle accent-tinted highlight on hover/select
- Check: meta text (like "Ctrl+Shift+T") renders as keycap-style badge
- Check: animation feels snappier with scale(0.98)

- [ ] **Step 5: Commit**

```bash
git add src/components/CommandPalette/CommandPalette.css
git commit -m "style: refine command palette to Raycast-inspired visual design"
```

---

## Chunk 4: Cheatsheet System

### Task 7: Create Cheatsheet Data Files

**Files:**
- Create: `src/data/cheatsheets/vim.ts`
- Create: `src/data/cheatsheets/git.ts`
- Create: `src/data/cheatsheets/docker.ts`
- Create: `src/data/cheatsheets/kubectl.ts`
- Create: `src/data/cheatsheets/index.ts`
- Create: `src/data/cheatsheets/types.ts`

- [ ] **Step 1: Create types file**

Create `src/data/cheatsheets/types.ts`:

```typescript
export interface CheatsheetItem {
  command: string;
  description: string;
}

export interface CheatsheetCategory {
  name: string;
  items: CheatsheetItem[];
}

export interface CheatsheetTopic {
  id: string;
  name: string;
  categories: CheatsheetCategory[];
}
```

- [ ] **Step 2: Create vim.ts**

Create `src/data/cheatsheets/vim.ts`:

```typescript
import type { CheatsheetTopic } from "./types";

export const vim: CheatsheetTopic = {
  id: "vim",
  name: "Vim",
  categories: [
    {
      name: "Modes",
      items: [
        { command: "i", description: "Insert mode before cursor" },
        { command: "a", description: "Insert mode after cursor" },
        { command: "o", description: "New line below and insert" },
        { command: "O", description: "New line above and insert" },
        { command: "v", description: "Visual mode" },
        { command: "V", description: "Visual line mode" },
        { command: "Ctrl+v", description: "Visual block mode" },
        { command: "Esc", description: "Return to normal mode" },
        { command: ":", description: "Command mode" },
      ],
    },
    {
      name: "Navigation",
      items: [
        { command: "h / j / k / l", description: "Left / down / up / right" },
        { command: "w / b", description: "Next / previous word" },
        { command: "e", description: "End of word" },
        { command: "0 / $", description: "Start / end of line" },
        { command: "^", description: "First non-blank char" },
        { command: "gg / G", description: "Top / bottom of file" },
        { command: "{number}G", description: "Go to line number" },
        { command: "Ctrl+d / Ctrl+u", description: "Half page down / up" },
        { command: "Ctrl+f / Ctrl+b", description: "Full page down / up" },
        { command: "%", description: "Jump to matching bracket" },
        { command: "H / M / L", description: "Top / middle / bottom of screen" },
      ],
    },
    {
      name: "Editing",
      items: [
        { command: "x", description: "Delete character under cursor" },
        { command: "dd", description: "Delete line" },
        { command: "dw", description: "Delete word" },
        { command: "d$", description: "Delete to end of line" },
        { command: "yy", description: "Yank (copy) line" },
        { command: "yw", description: "Yank word" },
        { command: "p / P", description: "Paste after / before cursor" },
        { command: "u", description: "Undo" },
        { command: "Ctrl+r", description: "Redo" },
        { command: ".", description: "Repeat last command" },
        { command: ">>  /  <<", description: "Indent / unindent line" },
        { command: "J", description: "Join line below to current" },
        { command: "cc", description: "Change entire line" },
        { command: "cw", description: "Change word" },
        { command: "r{char}", description: "Replace character" },
        { command: "~", description: "Toggle case" },
      ],
    },
    {
      name: "Search & Replace",
      items: [
        { command: "/{pattern}", description: "Search forward" },
        { command: "?{pattern}", description: "Search backward" },
        { command: "n / N", description: "Next / previous match" },
        { command: "*", description: "Search word under cursor" },
        { command: ":%s/old/new/g", description: "Replace all in file" },
        { command: ":%s/old/new/gc", description: "Replace all with confirm" },
        { command: ":noh", description: "Clear search highlight" },
      ],
    },
    {
      name: "Files & Buffers",
      items: [
        { command: ":w", description: "Save file" },
        { command: ":q", description: "Quit" },
        { command: ":wq / ZZ", description: "Save and quit" },
        { command: ":q!", description: "Quit without saving" },
        { command: ":e {file}", description: "Open file" },
        { command: ":bn / :bp", description: "Next / previous buffer" },
        { command: ":ls", description: "List buffers" },
        { command: ":sp / :vsp", description: "Horizontal / vertical split" },
        { command: "Ctrl+w w", description: "Switch between splits" },
        { command: "Ctrl+w q", description: "Close split" },
      ],
    },
    {
      name: "Macros",
      items: [
        { command: "q{register}", description: "Start recording macro" },
        { command: "q", description: "Stop recording macro" },
        { command: "@{register}", description: "Play macro" },
        { command: "@@", description: "Replay last macro" },
        { command: "{count}@{register}", description: "Play macro N times" },
      ],
    },
  ],
};
```

- [ ] **Step 3: Create git.ts**

Create `src/data/cheatsheets/git.ts`:

```typescript
import type { CheatsheetTopic } from "./types";

export const git: CheatsheetTopic = {
  id: "git",
  name: "Git",
  categories: [
    {
      name: "Setup & Init",
      items: [
        { command: "git init", description: "Initialize a new repository" },
        { command: "git clone <url>", description: "Clone a remote repository" },
        { command: "git config --global user.name '<name>'", description: "Set global username" },
        { command: "git config --global user.email '<email>'", description: "Set global email" },
      ],
    },
    {
      name: "Staging & Commits",
      items: [
        { command: "git status", description: "Show working tree status" },
        { command: "git add <file>", description: "Stage file" },
        { command: "git add -A", description: "Stage all changes" },
        { command: "git commit -m '<msg>'", description: "Commit with message" },
        { command: "git commit --amend", description: "Amend last commit" },
        { command: "git reset HEAD <file>", description: "Unstage file" },
        { command: "git diff", description: "Show unstaged changes" },
        { command: "git diff --staged", description: "Show staged changes" },
      ],
    },
    {
      name: "Branching",
      items: [
        { command: "git branch", description: "List branches" },
        { command: "git branch <name>", description: "Create branch" },
        { command: "git checkout -b <name>", description: "Create and switch to branch" },
        { command: "git switch <name>", description: "Switch branch" },
        { command: "git branch -d <name>", description: "Delete branch" },
        { command: "git merge <branch>", description: "Merge branch into current" },
      ],
    },
    {
      name: "Remote",
      items: [
        { command: "git remote -v", description: "List remotes" },
        { command: "git remote add <name> <url>", description: "Add remote" },
        { command: "git fetch", description: "Fetch from remote" },
        { command: "git pull", description: "Fetch and merge" },
        { command: "git push", description: "Push to remote" },
        { command: "git push -u origin <branch>", description: "Push and set upstream" },
        { command: "git push --force-with-lease", description: "Force push safely" },
      ],
    },
    {
      name: "Log & History",
      items: [
        { command: "git log --oneline", description: "Compact log" },
        { command: "git log --graph --oneline", description: "Graph log" },
        { command: "git log -p <file>", description: "File change history" },
        { command: "git blame <file>", description: "Line-by-line author info" },
        { command: "git show <commit>", description: "Show commit details" },
        { command: "git reflog", description: "Reference log (undo helper)" },
      ],
    },
    {
      name: "Rebase & Cherry-pick",
      items: [
        { command: "git rebase <branch>", description: "Rebase onto branch" },
        { command: "git rebase -i HEAD~<n>", description: "Interactive rebase last n commits" },
        { command: "git rebase --continue", description: "Continue after conflict" },
        { command: "git rebase --abort", description: "Abort rebase" },
        { command: "git cherry-pick <commit>", description: "Apply commit to current branch" },
      ],
    },
    {
      name: "Stash",
      items: [
        { command: "git stash", description: "Stash working changes" },
        { command: "git stash pop", description: "Apply and remove last stash" },
        { command: "git stash list", description: "List stashes" },
        { command: "git stash drop", description: "Delete last stash" },
        { command: "git stash apply", description: "Apply without removing" },
      ],
    },
  ],
};
```

- [ ] **Step 4: Create docker.ts**

Create `src/data/cheatsheets/docker.ts`:

```typescript
import type { CheatsheetTopic } from "./types";

export const docker: CheatsheetTopic = {
  id: "docker",
  name: "Docker",
  categories: [
    {
      name: "Containers",
      items: [
        { command: "docker run <image>", description: "Run a container" },
        { command: "docker run -d -p 8080:80 <image>", description: "Run detached with port mapping" },
        { command: "docker run -it <image> /bin/sh", description: "Run interactive shell" },
        { command: "docker ps", description: "List running containers" },
        { command: "docker ps -a", description: "List all containers" },
        { command: "docker stop <container>", description: "Stop container" },
        { command: "docker start <container>", description: "Start stopped container" },
        { command: "docker restart <container>", description: "Restart container" },
        { command: "docker rm <container>", description: "Remove container" },
        { command: "docker logs <container>", description: "View container logs" },
        { command: "docker logs -f <container>", description: "Follow container logs" },
        { command: "docker exec -it <container> /bin/sh", description: "Shell into running container" },
        { command: "docker inspect <container>", description: "Container details as JSON" },
      ],
    },
    {
      name: "Images",
      items: [
        { command: "docker images", description: "List local images" },
        { command: "docker pull <image>", description: "Pull image from registry" },
        { command: "docker build -t <name> .", description: "Build image from Dockerfile" },
        { command: "docker rmi <image>", description: "Remove image" },
        { command: "docker tag <src> <dest>", description: "Tag image" },
        { command: "docker push <image>", description: "Push image to registry" },
        { command: "docker image prune", description: "Remove dangling images" },
      ],
    },
    {
      name: "Volumes & Networks",
      items: [
        { command: "docker volume ls", description: "List volumes" },
        { command: "docker volume create <name>", description: "Create volume" },
        { command: "docker volume rm <name>", description: "Remove volume" },
        { command: "docker network ls", description: "List networks" },
        { command: "docker network create <name>", description: "Create network" },
        { command: "docker network connect <net> <ctr>", description: "Connect container to network" },
      ],
    },
    {
      name: "Compose",
      items: [
        { command: "docker compose up", description: "Start services" },
        { command: "docker compose up -d", description: "Start services in background" },
        { command: "docker compose down", description: "Stop and remove services" },
        { command: "docker compose build", description: "Build or rebuild services" },
        { command: "docker compose logs -f", description: "Follow service logs" },
        { command: "docker compose ps", description: "List running services" },
        { command: "docker compose exec <svc> sh", description: "Shell into service" },
      ],
    },
    {
      name: "System",
      items: [
        { command: "docker system df", description: "Show disk usage" },
        { command: "docker system prune", description: "Remove unused data" },
        { command: "docker stats", description: "Live container resource usage" },
      ],
    },
  ],
};
```

- [ ] **Step 5: Create kubectl.ts**

Create `src/data/cheatsheets/kubectl.ts`:

```typescript
import type { CheatsheetTopic } from "./types";

export const kubectl: CheatsheetTopic = {
  id: "kubectl",
  name: "kubectl",
  categories: [
    {
      name: "Cluster & Context",
      items: [
        { command: "kubectl cluster-info", description: "Display cluster info" },
        { command: "kubectl config get-contexts", description: "List contexts" },
        { command: "kubectl config use-context <ctx>", description: "Switch context" },
        { command: "kubectl config current-context", description: "Show current context" },
        { command: "kubectl get namespaces", description: "List namespaces" },
      ],
    },
    {
      name: "Pods",
      items: [
        { command: "kubectl get pods", description: "List pods in current namespace" },
        { command: "kubectl get pods -A", description: "List pods in all namespaces" },
        { command: "kubectl get pods -o wide", description: "List pods with node info" },
        { command: "kubectl describe pod <name>", description: "Detailed pod info" },
        { command: "kubectl logs <pod>", description: "View pod logs" },
        { command: "kubectl logs -f <pod>", description: "Follow pod logs" },
        { command: "kubectl logs <pod> -c <container>", description: "Logs from specific container" },
        { command: "kubectl exec -it <pod> -- /bin/sh", description: "Shell into pod" },
        { command: "kubectl delete pod <name>", description: "Delete pod" },
        { command: "kubectl top pods", description: "Pod resource usage" },
      ],
    },
    {
      name: "Deployments",
      items: [
        { command: "kubectl get deployments", description: "List deployments" },
        { command: "kubectl describe deployment <name>", description: "Deployment details" },
        { command: "kubectl scale deployment <name> --replicas=<n>", description: "Scale deployment" },
        { command: "kubectl rollout status deployment <name>", description: "Rollout status" },
        { command: "kubectl rollout restart deployment <name>", description: "Rolling restart" },
        { command: "kubectl rollout undo deployment <name>", description: "Rollback deployment" },
        { command: "kubectl set image deployment/<name> <c>=<img>", description: "Update container image" },
      ],
    },
    {
      name: "Services & Networking",
      items: [
        { command: "kubectl get services", description: "List services" },
        { command: "kubectl get ingress", description: "List ingress rules" },
        { command: "kubectl expose deployment <name> --port=<p>", description: "Expose deployment" },
        { command: "kubectl port-forward <pod> <local>:<remote>", description: "Port forward to pod" },
        { command: "kubectl port-forward svc/<svc> <local>:<remote>", description: "Port forward to service" },
      ],
    },
    {
      name: "Config & Secrets",
      items: [
        { command: "kubectl get configmaps", description: "List ConfigMaps" },
        { command: "kubectl get secrets", description: "List secrets" },
        { command: "kubectl create secret generic <name> --from-literal=<k>=<v>", description: "Create secret" },
        { command: "kubectl get secret <name> -o jsonpath='{.data}'", description: "View secret data" },
      ],
    },
    {
      name: "Apply & Delete",
      items: [
        { command: "kubectl apply -f <file.yaml>", description: "Apply manifest" },
        { command: "kubectl apply -f <dir>/", description: "Apply all manifests in dir" },
        { command: "kubectl delete -f <file.yaml>", description: "Delete resources from manifest" },
        { command: "kubectl delete <resource> <name>", description: "Delete specific resource" },
        { command: "kubectl get all", description: "List all resources" },
        { command: "kubectl api-resources", description: "List available resource types" },
      ],
    },
  ],
};
```

- [ ] **Step 6: Create index.ts**

Create `src/data/cheatsheets/index.ts`:

```typescript
export type { CheatsheetTopic, CheatsheetCategory, CheatsheetItem } from "./types";
export { vim } from "./vim";
export { git } from "./git";
export { docker } from "./docker";
export { kubectl } from "./kubectl";

import { vim } from "./vim";
import { git } from "./git";
import { docker } from "./docker";
import { kubectl } from "./kubectl";
import type { CheatsheetTopic } from "./types";

export const allTopics: CheatsheetTopic[] = [vim, git, docker, kubectl];
```

- [ ] **Step 7: Commit**

```bash
git add src/data/cheatsheets/
git commit -m "feat: add cheatsheet data for Vim, Git, Docker, kubectl"
```

---

### Task 8: Integrate Cheatsheet into Command Palette (Drill-down)

**Files:**
- Modify: `src/App.tsx` (add cheatsheetPaletteSection)
- Modify: `src/components/CommandPalette/CommandPalette.tsx` (drill-down state)

- [ ] **Step 1: Add drill-down state to CommandPalette**

In `CommandPalette.tsx`, add a `selectedTopic` state inside the component (after `listRef`):

```typescript
const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
```

Reset `selectedTopic` when the palette opens (in the `useEffect` for isOpen, after `setActiveIndex(0)`):

```typescript
setSelectedTopic(null);
```

- [ ] **Step 2: Add back navigation with Backspace**

In the `handleKeyDown` function, add a case before the existing `switch`:

```typescript
// Back navigation in cheatsheet drill-down
if (e.key === "Backspace" && mode === "cheatsheet" && selectedTopic && q === "") {
  e.preventDefault();
  setSelectedTopic(null);
  return;
}
```

- [ ] **Step 3: Handle topic selection in execute**

Update the `execute` callback to detect topic selection:

```typescript
const execute = useCallback(async (cmd: Command) => {
  // Cheatsheet topic selection → drill into topic
  if (cmd.id.startsWith("cheatsheet-topic:")) {
    const topicId = cmd.id.replace("cheatsheet-topic:", "");
    setSelectedTopic(topicId);
    setActiveIndex(0);
    return;
  }
  await cmd.action();
  onClose();
}, [onClose]);
```

- [ ] **Step 4: Expose selectedTopic via onQueryChange**

The `CommandPalette` needs to communicate `selectedTopic` to `App.tsx` so it can filter cheatsheet commands. Add a new prop:

```typescript
interface Props {
  isOpen: boolean;
  onClose: () => void;
  extraSections?: PaletteSection[];
  onQueryChange?: (query: string) => void;
  onCheatsheetTopicChange?: (topicId: string | null) => void;
  initialQuery?: string;
}
```

Call `onCheatsheetTopicChange` whenever `selectedTopic` changes:

```typescript
useEffect(() => {
  onCheatsheetTopicChange?.(selectedTopic);
}, [selectedTopic, onCheatsheetTopicChange]);
```

- [ ] **Step 5: Build cheatsheet palette section in App.tsx**

In `src/App.tsx`, add imports:

```typescript
import { allTopics } from "./data/cheatsheets";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
```

Note: `writeText` import may already exist from clipboard history (Task 5). If so, skip the duplicate.

Add state for tracking selected cheatsheet topic:

```typescript
const [cheatsheetTopic, setCheatsheetTopic] = useState<string | null>(null);
```

Add the cheatsheet palette section:

```typescript
const cheatsheetPaletteSection = useMemo<PaletteSection>(() => {
  const cheatsheetIcon = (
    <span className="cp-cmd-icon">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <rect x="2" y="1" width="10" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
        <path d="M5 4.5h4M5 7h4M5 9.5h2.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      </svg>
    </span>
  );

  // Topic list (no topic selected yet)
  if (!cheatsheetTopic) {
    // Topic entries for browsing
    const topicCommands = allTopics.map((topic) => ({
      id: `cheatsheet-topic:${topic.id}`,
      label: topic.name,
      description: `Browse ${topic.name} cheatsheet`,
      icon: cheatsheetIcon,
      action: () => {}, // handled by CommandPalette drill-down
    }));

    // Also include ALL items from ALL topics for cross-topic fuzzy search
    // (these only appear when user types a query like `?rebase`)
    const allItems = allTopics.flatMap((topic) =>
      topic.categories.flatMap((cat) =>
        cat.items.map((item) => ({
          id: `cheatsheet:${topic.id}:${cat.name}:${item.command}`,
          label: item.command,
          description: item.description,
          meta: `${topic.name} — ${cat.name}`,
          icon: cheatsheetIcon,
          action: async () => {
            try { await writeText(item.command); } catch {}
          },
        }))
      )
    );

    return {
      category: "Cheatsheet Topics",
      commands: [...topicCommands, ...allItems],
    };
  }

  // Specific topic selected — show all items grouped by category
  const topic = allTopics.find((t) => t.id === cheatsheetTopic);
  if (!topic) return { category: "Cheatsheet", commands: [] };

  const commands = topic.categories.flatMap((cat) =>
    cat.items.map((item) => ({
      id: `cheatsheet:${topic.id}:${cat.name}:${item.command}`,
      label: item.command,
      description: item.description,
      meta: cat.name,
      icon: (
        <span className="cp-cmd-icon">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <rect x="2" y="1" width="10" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
            <path d="M5 4.5h4M5 7h4M5 9.5h2.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
          </svg>
        </span>
      ),
      action: async () => {
        try {
          await writeText(item.command);
        } catch {
          // write failed
        }
      },
    }))
  );

  return { category: "Cheatsheet", commands };
}, [cheatsheetTopic]);
```

- [ ] **Step 6: Wire cheatsheet section and callback to CommandPalette**

Update the `<CommandPalette>` in App.tsx:

```tsx
<CommandPalette
  isOpen={paletteOpen}
  onClose={handlePaletteClose}
  onCheatsheetTopicChange={setCheatsheetTopic}
  extraSections={[
    tabPaletteSection,
    tabListPaletteSection,
    ...(switchConnectionPaletteSection ? [switchConnectionPaletteSection] : []),
    ...(backgroundTabsPaletteSection ? [backgroundTabsPaletteSection] : []),
    layoutPaletteSection,
    clipboardPaletteSection,
    cheatsheetPaletteSection,
  ]}
/>
```

- [ ] **Step 7: Verify cheatsheet drill-down flow**

Run: `pnpm tauri dev`
- Press Ctrl+K, type `?`
- Expected: 4 topic entries show (Vim, Git, Docker, kubectl)
- Select "Git" → entries repopulate with Git commands grouped by category
- Press Backspace → returns to topic list
- Type `?rebase` → filters across all topics for "rebase"
- Select a command → copied to clipboard

- [ ] **Step 8: Commit**

```bash
git add src/components/CommandPalette/CommandPalette.tsx src/App.tsx
git commit -m "feat: integrate cheatsheet into command palette with drill-down navigation"
```

---

## Chunk 5: Cheatsheet Side Panel & Toast

### Task 9: Create Toast Component

**Files:**
- Create: `src/components/Toast/Toast.tsx`
- Create: `src/components/Toast/Toast.css`

- [ ] **Step 1: Create Toast component**

Create `src/components/Toast/Toast.tsx`:

```typescript
import { useEffect, useState } from "react";
import "./Toast.css";

interface ToastProps {
  message: string;
  visible: boolean;
  onHide: () => void;
  duration?: number;
}

export function Toast({ message, visible, onHide, duration = 1500 }: ToastProps) {
  const [phase, setPhase] = useState<"in" | "out" | null>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (visible) {
      setShow(true);
      setPhase("in");
      let dismissTimer: ReturnType<typeof setTimeout>;
      const timer = setTimeout(() => {
        setPhase("out");
        dismissTimer = setTimeout(() => {
          setShow(false);
          setPhase(null);
          onHide();
        }, 150);
      }, duration);
      return () => {
        clearTimeout(timer);
        clearTimeout(dismissTimer);
      };
    }
  }, [visible, duration, onHide]);

  if (!show) return null;

  return (
    <div className={`toast${phase === "out" ? " toast--out" : ""}`}>
      {message}
    </div>
  );
}
```

- [ ] **Step 2: Create Toast CSS**

Create `src/components/Toast/Toast.css`:

```css
.toast {
  position: fixed;
  bottom: 32px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--bg-elevated);
  color: var(--label-primary);
  font-family: "Pretendard", sans-serif;
  font-size: 13px;
  font-weight: 500;
  padding: 8px 18px;
  border-radius: var(--radius-md);
  border: 1px solid var(--separator-strong);
  box-shadow: var(--shadow-md);
  z-index: 3000;
  animation: toast-in 0.15s ease;
  pointer-events: none;
  user-select: none;
}

.toast--out {
  animation: toast-out 0.15s ease forwards;
}

@keyframes toast-in {
  from { opacity: 0; transform: translateX(-50%) translateY(8px); }
  to   { opacity: 1; transform: translateX(-50%) translateY(0); }
}

@keyframes toast-out {
  from { opacity: 1; transform: translateX(-50%) translateY(0); }
  to   { opacity: 0; transform: translateX(-50%) translateY(8px); }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/Toast/
git commit -m "feat: add lightweight toast notification component"
```

---

### Task 10: Create Cheatsheet Panel for SidePanel

**Files:**
- Create: `src/components/SidePanel/CheatsheetPanel.tsx`
- Create: `src/components/SidePanel/CheatsheetPanel.css`
- Modify: `src/components/SidePanel/SidePanel.tsx` (add cheatsheet tab)
- Modify: `src/App.tsx` (update SidebarTab state)

- [ ] **Step 1: Create CheatsheetPanel component**

Create `src/components/SidePanel/CheatsheetPanel.tsx`:

```typescript
import { useState, useCallback } from "react";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { allTopics } from "../../data/cheatsheets";
import { Toast } from "../Toast/Toast";
import "./CheatsheetPanel.css";

export function CheatsheetPanel() {
  const [activeTopic, setActiveTopic] = useState(allTopics[0].id);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(
    allTopics[0].categories.map((c) => c.name)
  ));
  const [toastVisible, setToastVisible] = useState(false);

  const topic = allTopics.find((t) => t.id === activeTopic) ?? allTopics[0];

  const toggleCategory = (name: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const handleTopicChange = (topicId: string) => {
    setActiveTopic(topicId);
    const t = allTopics.find((tp) => tp.id === topicId);
    if (t) setExpandedCategories(new Set(t.categories.map((c) => c.name)));
  };

  const handleCopy = useCallback(async (command: string) => {
    try {
      await writeText(command);
      setToastVisible(true);
    } catch {
      // write failed
    }
  }, []);

  const handleToastHide = useCallback(() => setToastVisible(false), []);

  return (
    <div className="cheatsheet-panel">
      <div className="cheatsheet-topics">
        {allTopics.map((t) => (
          <button
            key={t.id}
            className={`cheatsheet-topic-btn${t.id === activeTopic ? " cheatsheet-topic-btn--active" : ""}`}
            onClick={() => handleTopicChange(t.id)}
          >
            {t.name}
          </button>
        ))}
      </div>

      <div className="cheatsheet-body">
        {topic.categories.map((cat) => {
          const isExpanded = expandedCategories.has(cat.name);
          return (
            <div key={cat.name} className="collapsible-section">
              <button className="collapsible-header" onClick={() => toggleCategory(cat.name)}>
                <svg
                  className={`collapsible-chevron${isExpanded ? " collapsible-chevron--open" : ""}`}
                  width="8" height="8" viewBox="0 0 8 8" fill="none"
                >
                  <path d="M2 1.5L5.5 4 2 6.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="collapsible-label">{cat.name}</span>
                <span className="collapsible-status"><span className="collapsible-status-text">{cat.items.length}</span></span>
              </button>
              {isExpanded && (
                <div className="collapsible-body">
                  {cat.items.map((item) => (
                    <button
                      key={item.command}
                      className="cheatsheet-item"
                      onClick={() => handleCopy(item.command)}
                      title="Click to copy"
                    >
                      <code className="cheatsheet-command">{item.command}</code>
                      <span className="cheatsheet-desc">{item.description}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Toast message="Copied!" visible={toastVisible} onHide={handleToastHide} />
    </div>
  );
}
```

- [ ] **Step 2: Create CheatsheetPanel CSS**

Create `src/components/SidePanel/CheatsheetPanel.css`:

```css
.cheatsheet-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.cheatsheet-topics {
  display: flex;
  gap: 2px;
  padding: 6px 8px;
  border-bottom: 1px solid var(--separator);
  flex-shrink: 0;
}

.cheatsheet-topic-btn {
  flex: 1;
  background: transparent;
  border: none;
  border-radius: var(--radius-xs);
  color: var(--label-tertiary);
  font-family: "Pretendard", sans-serif;
  font-size: 11px;
  font-weight: 500;
  padding: 4px 0;
  cursor: pointer;
  transition: background 0.1s, color 0.1s;
  user-select: none;
}

.cheatsheet-topic-btn:hover {
  background: var(--bg-tertiary);
  color: var(--label-secondary);
}

.cheatsheet-topic-btn--active {
  background: color-mix(in srgb, var(--accent) 15%, transparent);
  color: var(--accent);
}

.cheatsheet-body {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
  scrollbar-width: thin;
  scrollbar-color: var(--separator-strong) transparent;
}

.cheatsheet-body::-webkit-scrollbar {
  width: 4px;
}

.cheatsheet-body::-webkit-scrollbar-thumb {
  background: var(--separator-strong);
  border-radius: 2px;
}

.cheatsheet-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 100%;
  padding: 5px 12px 5px 22px;
  background: transparent;
  border: none;
  text-align: left;
  cursor: pointer;
  transition: background 0.08s;
  font-family: inherit;
}

.cheatsheet-item:hover {
  background: var(--bg-tertiary);
}

.cheatsheet-command {
  font-family: "JetBrains Mono", monospace;
  font-size: 12px;
  font-weight: 500;
  color: var(--label-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cheatsheet-desc {
  font-family: "Pretendard", sans-serif;
  font-size: 11px;
  font-weight: 400;
  color: var(--label-tertiary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
```

- [ ] **Step 3: Update SidePanel to include Cheatsheet tab**

In `src/components/SidePanel/SidePanel.tsx`:

Update the type:
```typescript
export type SidebarTab = "notes" | "timers" | "cheatsheet";
```

Add import:
```typescript
import { CheatsheetPanel } from "./CheatsheetPanel";
```

Add the cheatsheet tab button after the timers button (before the closing `</div>` of `side-panel-tabs`):

```tsx
<button
  className={`side-panel-tab${activeTab === "cheatsheet" ? " side-panel-tab--active" : ""}`}
  onClick={() => onTabChange("cheatsheet")}
  title="Cheatsheet"
>
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
    <rect x="2.5" y="1" width="10" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
    <path d="M5 4.5h5M5 7h5M5 9.5h3" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
  </svg>
</button>
```

Add the cheatsheet body in the `side-panel-body`:
```tsx
{activeTab === "cheatsheet" && <CheatsheetPanel />}
```

- [ ] **Step 4: Update App.tsx sidebar tab state**

In `src/App.tsx`, update the `sidebarTab` state initializer (around line 50-58) to accept `"cheatsheet"`:

```typescript
const [sidebarTab, setSidebarTab] = useState<SidebarTab>(() => {
  const stored = localStorage.getItem("v-terminal:sidebar-tab");
  if (stored === "notes" || stored === "timers" || stored === "cheatsheet") return stored;
  // Migrate legacy values
  if (stored === "pomodoro" || stored === "timer" || stored === "recurring" || stored === "alerts") {
    localStorage.setItem("v-terminal:sidebar-tab", "timers");
    return "timers";
  }
  return localStorage.getItem("v-terminal:alarm-open") === "true" ? "timers" : "notes";
});
```

- [ ] **Step 5: Verify cheatsheet side panel**

Run: `pnpm tauri dev`
- Press Ctrl+Shift+N to open side panel
- 3 tabs should appear: Notes (document icon), Timers (clock icon), Cheatsheet (book icon)
- Click Cheatsheet tab → see 4 topic buttons (Vim, Git, Docker, kubectl)
- Click a topic → see collapsible categories with commands
- Click a command → "Copied!" toast appears at bottom center
- Verify Ctrl+V pastes the copied command

- [ ] **Step 6: Commit**

```bash
git add src/components/SidePanel/ src/components/Toast/ src/App.tsx
git commit -m "feat: add cheatsheet panel to side panel with copy-to-clipboard"
```

---

## Final Verification

- [ ] **Full integration test**

1. `pnpm tauri dev`
2. Ctrl+K → verify Raycast-style visual (accent-tinted selection, keycap meta)
3. Ctrl+K → `%` → verify layout options appear
4. Copy several texts → Ctrl+K → `!` → verify clipboard entries with time
5. Select a clipboard entry → verify it copies to clipboard
6. Ctrl+K → `?` → verify 4 topics → select Git → verify drill-down → Backspace → back to topics
7. Ctrl+K → `?rebase` → verify cross-topic search
8. Ctrl+Shift+N → Cheatsheet tab → browse, click to copy, verify toast
9. Verify footer shows 6 prefix hints correctly
