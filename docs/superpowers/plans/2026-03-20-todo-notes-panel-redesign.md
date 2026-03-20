# Todo Tab & Notes Panel Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the Todo tab to Reminders-style (remove collapsible, circular checkboxes, completed section) and improve the Notes panel with elevated background, increased padding, and selectable background patterns.

**Architecture:** Three independent changes: (1) TodoSection.tsx rewrite with new CSS, (2) NotePanel/NoteEditor background & padding changes driven by a new noteConfigStore, (3) Settings UI for note background selection. Changes are additive — existing store interfaces unchanged.

**Tech Stack:** React, Zustand, CodeMirror 6, CSS custom properties, react-i18next

**Spec:** `docs/superpowers/specs/2026-03-20-todo-notes-panel-redesign.md`

---

## File Structure

| File | Responsibility |
|------|---------------|
| `src/store/noteConfigStore.ts` | **CREATE** — Zustand store for note background style preference |
| `src/locales/en.json` | **MODIFY** — Add new i18n keys for todo + settings |
| `src/locales/ko.json` | **MODIFY** — Add Korean translations for new keys |
| `src/components/NotePanel/NotePanel.css` | **MODIFY** — Rewrite todo styles, add note background/padding styles |
| `src/components/NotePanel/TodoSection.tsx` | **MODIFY** — Full rewrite: remove collapsible, add Reminders-style UI |
| `src/components/NotePanel/NotePanel.tsx` | **MODIFY** — Apply background pattern from noteConfigStore |
| `src/components/NotePanel/NoteEditor.tsx` | **MODIFY** — Apply elevated background + padding to CodeMirror |
| `src/components/SettingsModal/SettingsModal.tsx` | **MODIFY** — Add Notes section to AppearanceTab |

---

### Task 1: Create noteConfigStore

**Files:**
- Create: `src/store/noteConfigStore.ts`

- [ ] **Step 1: Create the store file**

Follow `src/store/browserConfigStore.ts` pattern exactly:

```ts
import { create } from "zustand";

const STORAGE_KEY = "v-terminal:note-config";

export type NoteBackgroundStyle = "none" | "ruled" | "grid" | "dots";

interface NoteConfig {
  backgroundStyle: NoteBackgroundStyle;
}

const DEFAULTS: NoteConfig = {
  backgroundStyle: "grid",
};

function loadConfig(): NoteConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULTS };
}

function saveConfig(config: NoteConfig) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {}
}

interface NoteConfigStore extends NoteConfig {
  setBackgroundStyle: (style: NoteBackgroundStyle) => void;
}

export const useNoteConfigStore = create<NoteConfigStore>((set, get) => ({
  ...loadConfig(),

  setBackgroundStyle: (style) => {
    set({ backgroundStyle: style });
    saveConfig({ ...get(), backgroundStyle: style });
  },
}));
```

- [ ] **Step 2: Verify import resolves**

Run: `npx tsc --noEmit src/store/noteConfigStore.ts 2>&1 | head -20`
Expected: No errors (or only unrelated errors from other files)

- [ ] **Step 3: Commit**

```bash
git add src/store/noteConfigStore.ts
git commit -m "feat: add noteConfigStore for note background style preference"
```

---

### Task 2: Add i18n keys

**Files:**
- Modify: `src/locales/en.json` (lines 190-197, todo section + add settings keys)
- Modify: `src/locales/ko.json` (same sections)

- [ ] **Step 1: Add English translation keys**

In `src/locales/en.json`, replace the `"todo"` block (lines 190-197) with:

```json
  "todo": {
    "title": "TODO",
    "addTask": "Add a task...",
    "clearCompleted": "Clear completed",
    "markComplete": "Mark complete",
    "markIncomplete": "Mark incomplete",
    "delete": "Delete",
    "remaining": "{{count}} remaining",
    "empty": "No tasks yet",
    "completedSection": "Completed",
    "clearAll": "Clear All",
    "newTodo": "New Todo"
  },
```

Also add settings keys inside the `"settings"` block, after the `"showWelcomeDesc"` line (line 26):

```json
    "notes": "Notes",
    "notesBgStyle": "Background Style",
    "notesBgNone": "None",
    "notesBgRuled": "Ruled",
    "notesBgGrid": "Grid",
    "notesBgDots": "Dots"
```

- [ ] **Step 2: Add Korean translation keys**

In `src/locales/ko.json`, replace the `"todo"` block with:

```json
  "todo": {
    "title": "할 일",
    "addTask": "할 일 추가...",
    "clearCompleted": "완료 항목 삭제",
    "markComplete": "완료로 표시",
    "markIncomplete": "미완료로 표시",
    "delete": "삭제",
    "remaining": "{{count}}개 남음",
    "empty": "할 일이 없습니다",
    "completedSection": "완료됨",
    "clearAll": "모두 삭제",
    "newTodo": "새 할 일"
  },
```

Also add Korean settings keys after `"showWelcomeDesc"`:

```json
    "notes": "노트",
    "notesBgStyle": "배경 스타일",
    "notesBgNone": "없음",
    "notesBgRuled": "줄 노트",
    "notesBgGrid": "격자",
    "notesBgDots": "점 격자"
```

- [ ] **Step 3: Commit**

```bash
git add src/locales/en.json src/locales/ko.json
git commit -m "feat(i18n): add translation keys for todo redesign and note settings"
```

---

### Task 3: Rewrite TodoSection CSS

**Files:**
- Modify: `src/components/NotePanel/NotePanel.css` (lines 44-257, todo section styles)

- [ ] **Step 1: Update note-panel base styles (lines 12 and 39)**

Before rewriting the todo styles, first update two background values in the base styles:

In `.note-panel--embedded` (line 12), change `background: var(--bg-terminal)` to `background: var(--bg-elevated)`.

In `.note-cm-container` (line 39), change `background: var(--bg-terminal)` to `background: var(--bg-elevated)`.

- [ ] **Step 2: Replace todo CSS styles**

Replace everything from line 44 (`/* ── Todo Section */`) through end of file (line 257) with new styles. Keep the rest of lines 1-43 unchanged.

New todo styles to write:

```css
/* ── Todo Section (Reminders-style, full panel) ────────────────── */
.todo-section {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

/* ── Counter bar ───────────────────────────────────────────────── */
.todo-counter-bar {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding: 10px 14px 6px;
  flex-shrink: 0;
}

.todo-counter-remaining {
  font-size: 11px;
  color: var(--label-tertiary);
  letter-spacing: 0.3px;
  font-family: "Pretendard", sans-serif;
}

.todo-counter-fraction {
  font-size: 11px;
  color: var(--label-disabled);
  font-family: "JetBrains Mono", monospace;
}

/* ── Empty state ───────────────────────────────────────────────── */
.todo-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--label-tertiary);
}

.todo-empty-icon {
  color: var(--label-tertiary);
}

.todo-empty-text {
  font-size: 13px;
  font-family: "Pretendard", sans-serif;
}

/* ── Todo list (scrollable) ────────────────────────────────────── */
.todo-list {
  flex: 1;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--bg-tertiary) transparent;
  padding: 4px 0;
}

.todo-list::-webkit-scrollbar {
  width: 4px;
}

.todo-list::-webkit-scrollbar-track {
  background: transparent;
}

.todo-list::-webkit-scrollbar-thumb {
  background: var(--bg-tertiary);
  border-radius: 2px;
}

/* ── Todo item ─────────────────────────────────────────────────── */
.todo-item {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 32px;
  padding: 3px 14px;
  position: relative;
}

.todo-item:hover .todo-delete {
  opacity: 1;
}

/* fade-out animation when checking */
.todo-item--fading {
  opacity: 0.4;
  transition: opacity 0.3s ease;
}

/* ── Circular checkbox (Reminders-style) ───────────────────────── */
.todo-checkbox {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  border: none;
  background: none;
  padding: 0;
  cursor: pointer;
  color: var(--label-tertiary);
  transition: color 0.12s;
}

.todo-checkbox:hover {
  color: var(--accent);
}

/* ── Todo text ─────────────────────────────────────────────────── */
.todo-text {
  flex: 1;
  font-size: 13px;
  font-family: "Pretendard", sans-serif;
  line-height: 1.5;
  color: var(--label-primary);
  outline: none;
  word-break: break-word;
  min-width: 0;
  cursor: text;
  border-radius: var(--radius-xs);
  padding: 0 2px;
}

.todo-text:focus {
  background: var(--bg-tertiary);
}

.todo-item--done .todo-text {
  color: var(--label-tertiary);
  text-decoration: line-through;
}

/* ── Delete button ─────────────────────────────────────────────── */
.todo-delete {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  border: none;
  background: none;
  padding: 0;
  cursor: pointer;
  color: var(--label-tertiary);
  opacity: 0;
  transition: opacity 0.12s, color 0.12s;
  border-radius: var(--radius-xs);
}

.todo-delete:hover {
  color: var(--destructive);
  background: var(--bg-tertiary);
}

/* ── Completed section ─────────────────────────────────────────── */
.todo-completed-section {
  flex-shrink: 0;
  border-top: 1px solid var(--separator);
}

.todo-completed-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 6px 14px;
  border: none;
  background: none;
  cursor: pointer;
  user-select: none;
}

.todo-completed-toggle:hover {
  background: var(--bg-tertiary);
}

.todo-completed-chevron {
  color: var(--label-tertiary);
  transition: transform 0.15s ease;
  flex-shrink: 0;
}

.todo-completed-chevron--open {
  transform: rotate(90deg);
}

.todo-completed-label {
  font-size: 11px;
  color: var(--label-tertiary);
  font-family: "Pretendard", sans-serif;
}

.todo-clear-all {
  margin-left: auto;
  font-size: 10px;
  color: var(--label-disabled);
  border: none;
  background: none;
  cursor: pointer;
  padding: 0;
  font-family: "Pretendard", sans-serif;
}

.todo-clear-all:hover {
  color: var(--destructive);
}

.todo-completed-list {
  padding: 0 0 6px;
}

.todo-completed-list .todo-item {
  opacity: 0.4;
}

/* ── New Todo button (bottom-anchored) ─────────────────────────── */
.todo-new-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border: none;
  border-top: 1px solid var(--separator);
  background: none;
  cursor: pointer;
  flex-shrink: 0;
  width: 100%;
}

.todo-new-btn:hover {
  background: var(--bg-tertiary);
}

.todo-new-btn-text {
  font-size: 13px;
  color: var(--accent);
  font-family: "Pretendard", sans-serif;
}
```

- [ ] **Step 3: Add note background pattern CSS classes**

Append to `NotePanel.css` after the todo styles:

```css
/* ── Note panel background patterns ────────────────────────────── */
/* Note: pattern values use hardcoded rgba(255,255,255,...) for dark theme only.
   Light theme support will require CSS variable alternatives. */

.note-panel--bg-ruled .note-cm-container,
.note-panel--bg-ruled .cm-editor {
  background-image: repeating-linear-gradient(
    transparent, transparent 22px,
    rgba(255,255,255,0.04) 22px, rgba(255,255,255,0.04) 23px
  );
}

.note-panel--bg-grid .note-cm-container,
.note-panel--bg-grid .cm-editor {
  background-image:
    linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
  background-size: 20px 20px;
}

.note-panel--bg-dots .note-cm-container,
.note-panel--bg-dots .cm-editor {
  background-image: radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px);
  background-size: 16px 16px;
}

/* ── Note panel padding override ───────────────────────────────── */
.note-panel--embedded .cm-editor .cm-content {
  padding: 20px 24px;
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/NotePanel/NotePanel.css
git commit -m "feat: rewrite todo CSS to Reminders-style and add note background patterns"
```

---

### Task 4: Rewrite TodoSection component

**Files:**
- Modify: `src/components/NotePanel/TodoSection.tsx` (full rewrite, 189 lines → ~220 lines)

- [ ] **Step 1: Rewrite TodoSection.tsx**

Replace entire file contents with:

```tsx
import { useState, useRef, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useTodoStore } from "../../store/todoStore";
import { useTerminalConfigStore } from "../../store/terminalConfigStore";

export function TodoSection() {
  const { t } = useTranslation();
  const [completedCollapsed, setCompletedCollapsed] = useState(true);
  const [fadingId, setFadingId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const todos = useTodoStore((s) => s.todos);
  const { addTodo, toggleTodo, removeTodo, updateTodoText, clearCompleted } =
    useTodoStore();
  const fontSize = useTerminalConfigStore((s) => s.fontSize);

  const activeTodos = todos.filter((t) => !t.completed);
  const completedTodos = todos.filter((t) => t.completed);
  const total = todos.length;
  const completed = completedTodos.length;
  const remaining = activeTodos.length;

  const handleBlurEdit = useCallback(
    (todoId: string, text: string) => {
      const trimmed = text.trim();
      if (trimmed) {
        updateTodoText(todoId, trimmed);
      } else {
        removeTodo(todoId);
      }
    },
    [updateTodoText, removeTodo],
  );

  const handleCheck = useCallback(
    (todoId: string) => {
      const todo = todos.find((t) => t.id === todoId);
      if (todo && !todo.completed) {
        setFadingId(todoId);
        setTimeout(() => {
          toggleTodo(todoId);
          setFadingId(null);
        }, 300);
      } else {
        toggleTodo(todoId);
      }
    },
    [todos, toggleTodo],
  );

  const [pendingFocus, setPendingFocus] = useState(false);

  const handleNewTodo = useCallback(() => {
    addTodo("");
    setPendingFocus(true);
  }, [addTodo]);

  // Focus the last todo text after React renders the new item
  useEffect(() => {
    if (!pendingFocus || !listRef.current) return;
    setPendingFocus(false);
    const items = listRef.current.querySelectorAll(".todo-text");
    const lastItem = items[items.length - 1] as HTMLElement;
    if (lastItem) lastItem.focus();
  }, [pendingFocus, todos]);

  const handleKeyDown = useCallback(
    (todoId: string, e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        (e.currentTarget as HTMLElement).blur();
        // After committing current edit, create a new todo for rapid entry
        handleNewTodo();
      }
    },
    [handleNewTodo],
  );

  return (
    <div className="todo-section">
      {/* Counter bar — hidden when empty */}
      {total > 0 && (
        <div className="todo-counter-bar">
          <span className="todo-counter-remaining">
            {t('todo.remaining', { count: remaining })}
          </span>
          <span className="todo-counter-fraction">
            {completed}/{total}
          </span>
        </div>
      )}

      {/* Empty state */}
      {total === 0 && (
        <div className="todo-empty">
          <svg className="todo-empty-icon" width="24" height="24" viewBox="0 0 24 24" fill="none">
            <rect x="4" y="3" width="16" height="18" rx="2" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M8 9l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <line x1="8" y1="15" x2="16" y2="15" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            <line x1="8" y1="18" x2="13" y2="18" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
          <span className="todo-empty-text">{t('todo.empty')}</span>
        </div>
      )}

      {/* Active todo list */}
      {activeTodos.length > 0 && (
        <div className="todo-list" ref={listRef}>
          {activeTodos.map((todo) => (
            <div
              key={todo.id}
              className={`todo-item${fadingId === todo.id ? " todo-item--fading" : ""}`}
            >
              <button
                className="todo-checkbox"
                onClick={() => handleCheck(todo.id)}
                aria-label={t('todo.markComplete')}
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <circle cx="9" cy="9" r="8" stroke="currentColor" strokeWidth="1.5"/>
                </svg>
              </button>
              <span
                className="todo-text"
                contentEditable
                suppressContentEditableWarning
                spellCheck={false}
                style={{ fontSize: `${fontSize}px` }}
                onBlur={(e) =>
                  handleBlurEdit(todo.id, e.currentTarget.textContent ?? "")
                }
                onKeyDown={(e) => handleKeyDown(todo.id, e)}
              >
                {todo.text}
              </span>
              <button
                className="todo-delete"
                onClick={() => removeTodo(todo.id)}
                aria-label={t('todo.delete')}
                title={t('todo.delete')}
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path
                    d="M2 2l6 6M8 2l-6 6"
                    stroke="currentColor"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Completed section — progressive disclosure */}
      {completed > 0 && (
        <div className="todo-completed-section">
          <button
            className="todo-completed-toggle"
            onClick={() => setCompletedCollapsed((c) => !c)}
            aria-expanded={!completedCollapsed}
          >
            <svg
              className={`todo-completed-chevron${completedCollapsed ? "" : " todo-completed-chevron--open"}`}
              width="8"
              height="8"
              viewBox="0 0 8 8"
              fill="none"
            >
              <path
                d="M2 1.5L5.5 4 2 6.5"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="todo-completed-label">
              {t('todo.completedSection')}
            </span>
            <button
              className="todo-clear-all"
              onClick={(e) => {
                e.stopPropagation();
                clearCompleted();
              }}
            >
              {t('todo.clearAll')}
            </button>
          </button>

          {!completedCollapsed && (
            <div className="todo-completed-list">
              {completedTodos.map((todo) => (
                <div key={todo.id} className="todo-item todo-item--done">
                  <button
                    className="todo-checkbox"
                    onClick={() => toggleTodo(todo.id)}
                    aria-label={t('todo.markIncomplete')}
                  >
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                      <circle cx="9" cy="9" r="8" fill="var(--accent)"/>
                      <path
                        d="M5.5 9.5L8 12 12.5 6.5"
                        stroke="white"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                  <span
                    className="todo-text"
                    contentEditable
                    suppressContentEditableWarning
                    spellCheck={false}
                    style={{ fontSize: `${fontSize}px` }}
                    onBlur={(e) =>
                      handleBlurEdit(todo.id, e.currentTarget.textContent ?? "")
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        (e.currentTarget as HTMLElement).blur();
                      }
                    }}
                  >
                    {todo.text}
                  </span>
                  <button
                    className="todo-delete"
                    onClick={() => removeTodo(todo.id)}
                    aria-label={t('todo.delete')}
                    title={t('todo.delete')}
                  >
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path
                        d="M2 2l6 6M8 2l-6 6"
                        stroke="currentColor"
                        strokeWidth="1.2"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Bottom: + New Todo button */}
      <button className="todo-new-btn" onClick={handleNewTodo}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="7" fill="var(--accent)"/>
          <path d="M8 5v6M5 8h6" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        <span className="todo-new-btn-text">{t('todo.newTodo')}</span>
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Verify the component compiles**

Run: `npx tsc --noEmit 2>&1 | grep -i "TodoSection\|error" | head -20`
Expected: No errors related to TodoSection

- [ ] **Step 3: Commit**

```bash
git add src/components/NotePanel/TodoSection.tsx
git commit -m "feat: rewrite TodoSection to Reminders-style with circular checkboxes and progressive disclosure"
```

---

### Task 5: Update NotePanel and NoteEditor for background patterns

**Files:**
- Modify: `src/components/NotePanel/NotePanel.tsx` (21 lines → ~30 lines)
- Modify: `src/components/NotePanel/NoteEditor.tsx` (line 86, className update)

- [ ] **Step 1: Update NotePanel.tsx to apply background pattern class**

Replace entire `NotePanel.tsx` with:

```tsx
import { NoteEditor } from "./NoteEditor";
import { useNoteConfigStore } from "../../store/noteConfigStore";
import "./NotePanel.css";

interface NotePanelProps {
  panelId: string;
  isActive?: boolean;
  onFocus?: () => void;
}

export function NotePanel({ panelId, isActive, onFocus }: NotePanelProps) {
  const bgStyle = useNoteConfigStore((s) => s.backgroundStyle);

  const bgClass = bgStyle !== "none" ? ` note-panel--bg-${bgStyle}` : "";

  return (
    <div
      className={`note-panel note-panel--embedded${isActive ? " note-panel--active" : ""}${bgClass}`}
      onFocus={onFocus}
      onMouseDown={onFocus}
    >
      <NoteEditor panelId={panelId} />
    </div>
  );
}
```

- [ ] **Step 2: Verify — no NoteEditor.tsx changes needed**

The background pattern and elevated background are applied via parent CSS classes (`.note-panel--elevated`, `.note-panel--bg-*`) which cascade down to `.note-cm-container` and `.cm-editor`. The `--bg-terminal` to `--bg-elevated` CSS edits were already made in Task 3 Step 1. No changes to `NoteEditor.tsx` are needed.

Specifically, edit line 12 to change `--bg-terminal` → `--bg-elevated`:
```css
.note-panel--embedded {
  background: var(--bg-elevated);
```

And edit line 39:
```css
.note-cm-container {
  ...
  background: var(--bg-elevated);
```

- [ ] **Step 3: Commit**

```bash
git add src/components/NotePanel/NotePanel.tsx src/components/NotePanel/NotePanel.css
git commit -m "feat: apply note background patterns and elevated background"
```

---

### Task 6: Add Notes section to Settings modal

**Files:**
- Modify: `src/components/SettingsModal/SettingsModal.tsx` (add ~50 lines inside AppearanceTab function)

- [ ] **Step 1: Add import for noteConfigStore**

At the top of `SettingsModal.tsx`, add import:

```ts
import { useNoteConfigStore, type NoteBackgroundStyle } from "../../store/noteConfigStore";
```

- [ ] **Step 2: Add Notes section inside AppearanceTab**

In the `AppearanceTab` function, between the Theme section closing `</div>` (line 397) and the `<div className="settings-divider" />` (line 400), insert a new Notes section.

First, inside the `AppearanceTab` function body (after the `useState` for `fontLoaded`), add:

```tsx
  const noteConfig = useNoteConfigStore();
```

Then, before the Onboarding section (before line 400's `<div className="settings-divider" />`), add:

```tsx
      {/* Notes Section */}
      <div className="settings-section">
        <div className="settings-section-label">{t('settings.notes')}</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '13px', color: 'var(--label-primary)' }}>
            {t('settings.notesBgStyle')}
          </span>
          <div style={{ display: 'flex', gap: '6px' }}>
            {([
              { value: "none", label: t('settings.notesBgNone') },
              { value: "ruled", label: t('settings.notesBgRuled') },
              { value: "grid", label: t('settings.notesBgGrid') },
              { value: "dots", label: t('settings.notesBgDots') },
            ] as { value: NoteBackgroundStyle; label: string }[]).map((opt) => (
              <button
                key={opt.value}
                onClick={() => noteConfig.setBackgroundStyle(opt.value)}
                title={opt.label}
                style={{
                  width: '40px',
                  height: '32px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-elevated)',
                  border: noteConfig.backgroundStyle === opt.value
                    ? '2px solid var(--accent)'
                    : '1px solid var(--bg-panel-border)',
                  cursor: 'pointer',
                  padding: 0,
                  backgroundImage:
                    opt.value === "ruled"
                      ? 'repeating-linear-gradient(transparent, transparent 6px, rgba(255,255,255,0.04) 6px, rgba(255,255,255,0.04) 7px)'
                      : opt.value === "grid"
                      ? 'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)'
                      : opt.value === "dots"
                      ? 'radial-gradient(circle, rgba(255,255,255,0.08) 1px, transparent 1px)'
                      : 'none',
                  backgroundSize:
                    opt.value === "grid" ? '8px 8px'
                    : opt.value === "dots" ? '6px 6px'
                    : undefined,
                }}
              />
            ))}
          </div>
        </div>
        <div style={{
          fontSize: '11px',
          color: 'var(--label-disabled)',
          textAlign: 'right',
          marginTop: '4px',
        }}>
          {t('settings.notesBgNone')} · {t('settings.notesBgRuled')} · {t('settings.notesBgGrid')} · {t('settings.notesBgDots')}
        </div>
      </div>

      <div className="settings-divider" />
```

- [ ] **Step 3: Commit**

```bash
git add src/components/SettingsModal/SettingsModal.tsx
git commit -m "feat: add Notes background style selector to Settings modal"
```

---

### Task 7: Manual visual verification

- [ ] **Step 1: Start dev server and verify Todo tab**

Run: `npm run dev` (or `pnpm dev`)

Check in browser:
1. Open the side panel → Todo tab
2. Verify: no collapsible header, counter bar shows at top
3. Verify: circular checkboxes
4. Add a few todos, check some → verify they move to Completed section with 300ms fade
5. Verify: "+ New Todo" button at bottom, creates inline editable item
6. Verify: "Clear All" in Completed section works
7. Verify: empty state shows when all todos removed

- [ ] **Step 2: Verify Notes panel**

1. Create a note panel (switch a pane to note)
2. Verify: elevated background (slightly lighter than terminal)
3. Verify: grid pattern visible on the background
4. Verify: generous padding (20px 24px)

- [ ] **Step 3: Verify Settings**

1. Open Settings → Appearance tab
2. Scroll to Notes section
3. Click each of the 4 background preview buttons
4. Verify: note panel background updates in real-time
5. Verify: selected button has blue (accent) border

- [ ] **Step 4: Verify i18n**

1. Switch language to Korean in Settings
2. Verify: Todo tab labels in Korean ("3개 남음", "완료됨", "모두 삭제", "새 할 일")
3. Verify: Settings Notes section in Korean ("노트", "배경 스타일")

- [ ] **Step 5: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: visual adjustments from manual verification"
```
