# Note Panel Promotion & Session Restore Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Promote notes to a full panel type (switchable like Local/SSH/WSL), make todos global, and persist tab/layout/panel state across app restarts.

**Architecture:** Three changes: (1) Add `'note'` to `PanelConnection.type` so any panel can render a CodeMirror editor instead of xterm.js, (2) extract todos into a global `todoStore` and give them a dedicated side panel tab, (3) persist workspace state (tabs, layouts, panel types, connections) to localStorage for restore on app restart.

**Tech Stack:** React 18, TypeScript, Zustand, CodeMirror 6, Tauri 2, localStorage

**Spec:** `docs/superpowers/specs/2026-03-19-note-panel-and-session-restore-design.md`

---

## File Map

### New Files
- `src/store/todoStore.ts` — global todo store (extracted from noteStore)

### Modified Files
- `src/types/terminal.ts` — add `'note'` to `PanelConnection.type`
- `src/store/noteStore.ts` — key by panel ID, remove todo logic, new storage key
- `src/store/tabStore.ts` — workspace persistence (save/restore tabs to localStorage), layout expansion fallback for note panels
- `src/components/NotePanel/NotePanel.tsx` — accept `panelId` prop instead of `tabId`, remove close button, remove TodoSection
- `src/components/NotePanel/NoteEditor.tsx` — accept `panelId` prop instead of `tabId`
- `src/components/NotePanel/TodoSection.tsx` — use global `todoStore` instead of `noteStore`, remove `tabId` prop
- `src/components/SidePanel/SidePanel.tsx` — replace Notes tab with Todos tab, update icon, remove NoteEditor
- `src/components/PanelGrid/PanelGrid.tsx` — render NotePanel for `connection.type === 'note'`, note cleanup on connection switch
- `src/components/PanelContextMenu/PanelContextMenu.tsx` — add "Note" option
- `src/components/SessionPicker/SessionPicker.tsx` — add "Note" as connection option, add icon, add `.sp-dot--note` CSS
- `src/components/SessionPicker/SessionPicker.css` — add `.sp-dot--note` color
- `src/App.tsx` — tab close cleanup, layout expansion note cleanup, sidebar tab migration, Note in command palette connection switching

---

## Task 1: Extend PanelConnection Type

**Files:**
- Modify: `src/types/terminal.ts:29-36`

- [ ] **Step 1: Add `'note'` to PanelConnection.type union**

In `src/types/terminal.ts`, change line 30:

```typescript
// Before
type: 'local' | 'ssh' | 'wsl';

// After
type: 'local' | 'ssh' | 'wsl' | 'note';
```

- [ ] **Step 2: Verify build**

Run: `cd /Users/handongho/.openclaw/workspace/projects/v-terminal && npx tsc --noEmit`
Expected: No errors (existing code handles `type` via string comparison, not exhaustive switches)

- [ ] **Step 3: Commit**

```bash
git add src/types/terminal.ts
git commit -m "feat: add 'note' to PanelConnection type"
```

---

## Task 2: Create Global todoStore

**Files:**
- Create: `src/store/todoStore.ts`

- [ ] **Step 1: Create the global todo store**

Create `src/store/todoStore.ts`:

```typescript
import { create } from "zustand";
import { v4 as uuidv4 } from "uuid";

const STORAGE_KEY = "v-terminal:todos";
const SAVE_DEBOUNCE_MS = 300;

export interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
}

interface TodoStore {
  todos: TodoItem[];

  addTodo: (text: string) => void;
  toggleTodo: (todoId: string) => void;
  removeTodo: (todoId: string) => void;
  updateTodoText: (todoId: string, text: string) => void;
  clearCompleted: () => void;
}

function load(): TodoItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as TodoItem[]) : [];
  } catch {
    return [];
  }
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

function save(todos: TodoItem[]) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
    } catch {}
  }, SAVE_DEBOUNCE_MS);
}

export const useTodoStore = create<TodoStore>((set) => ({
  todos: load(),

  addTodo: (text) =>
    set((s) => {
      const todo: TodoItem = { id: uuidv4(), text, completed: false };
      const todos = [...s.todos, todo];
      save(todos);
      return { todos };
    }),

  toggleTodo: (todoId) =>
    set((s) => {
      const todos = s.todos.map((t) =>
        t.id === todoId ? { ...t, completed: !t.completed } : t
      );
      save(todos);
      return { todos };
    }),

  removeTodo: (todoId) =>
    set((s) => {
      const todos = s.todos.filter((t) => t.id !== todoId);
      save(todos);
      return { todos };
    }),

  updateTodoText: (todoId, text) =>
    set((s) => {
      const todos = s.todos.map((t) =>
        t.id === todoId ? { ...t, text } : t
      );
      save(todos);
      return { todos };
    }),

  clearCompleted: () =>
    set((s) => {
      const todos = s.todos.filter((t) => !t.completed);
      save(todos);
      return { todos };
    }),
}));
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/store/todoStore.ts
git commit -m "feat: create global todoStore"
```

---

## Task 3: Refactor noteStore — Panel-based Keys, Remove Todos

**Files:**
- Modify: `src/store/noteStore.ts`

- [ ] **Step 1: Rewrite noteStore for panel-based notes only**

Replace the entire content of `src/store/noteStore.ts`:

```typescript
import { create } from "zustand";

const STORAGE_KEY = "v-terminal:panel-notes";
const SAVE_DEBOUNCE_MS = 300;

interface NoteStore {
  notes: Record<string, string>; // panelId → markdown content

  setMarkdown: (panelId: string, markdown: string) => void;
  removeNote: (panelId: string) => void;
  removeNotes: (panelIds: string[]) => void;
}

function load(): Record<string, string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

function save(notes: Record<string, string>) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
    } catch {}
  }, SAVE_DEBOUNCE_MS);
}

export const useNoteStore = create<NoteStore>((set) => ({
  notes: load(),

  setMarkdown: (panelId, markdown) =>
    set((s) => {
      const notes = { ...s.notes, [panelId]: markdown };
      save(notes);
      return { notes };
    }),

  removeNote: (panelId) =>
    set((s) => {
      const { [panelId]: _, ...rest } = s.notes;
      save(rest);
      return { notes: rest };
    }),

  removeNotes: (panelIds) =>
    set((s) => {
      const notes = { ...s.notes };
      for (const id of panelIds) delete notes[id];
      save(notes);
      return { notes };
    }),
}));
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: Errors in files that still import old noteStore API (NoteEditor, TodoSection, SidePanel, NotePanel). These will be fixed in subsequent tasks.

- [ ] **Step 3: Commit**

```bash
git add src/store/noteStore.ts
git commit -m "refactor: noteStore keyed by panelId, remove todo logic"
```

---

## Task 4: Update TodoSection to Use Global todoStore

**Files:**
- Modify: `src/components/NotePanel/TodoSection.tsx`

- [ ] **Step 1: Rewrite TodoSection to use global todoStore**

Replace the entire content of `src/components/NotePanel/TodoSection.tsx`:

```typescript
import { useState, useRef, useCallback } from "react";
import { useTodoStore } from "../../store/todoStore";

export function TodoSection() {
  const [collapsed, setCollapsed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const todos = useTodoStore((s) => s.todos);
  const { addTodo, toggleTodo, removeTodo, updateTodoText, clearCompleted } =
    useTodoStore();

  const completed = todos.filter((t) => t.completed).length;
  const total = todos.length;

  const handleAdd = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key !== "Enter") return;
      const text = (e.target as HTMLInputElement).value.trim();
      if (!text) return;
      addTodo(text);
      (e.target as HTMLInputElement).value = "";
    },
    [addTodo],
  );

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

  return (
    <div className="todo-section">
      <button
        className="todo-header"
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
      >
        <svg
          className={`todo-chevron ${collapsed ? "" : "todo-chevron--open"}`}
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
        <span className="todo-header-label">TODO</span>
        {total > 0 && (
          <span className="todo-header-count">
            {completed}/{total}
          </span>
        )}
        {completed > 0 && (
          <button
            className="todo-clear-btn"
            onClick={(e) => {
              e.stopPropagation();
              clearCompleted();
            }}
            aria-label="Clear completed"
            title="Clear completed"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path
                d="M2.5 3h7M4.5 3V2a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 .5.5v1M5 5.5v3M7 5.5v3M3.5 3l.5 7a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1l.5-7"
                stroke="currentColor"
                strokeWidth="1"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}
      </button>

      {!collapsed && (
        <div className="todo-body">
          <div className="todo-list">
            {todos.map((todo) => (
              <div
                key={todo.id}
                className={`todo-item ${todo.completed ? "todo-item--done" : ""}`}
              >
                <button
                  className="todo-checkbox"
                  onClick={() => toggleTodo(todo.id)}
                  aria-label={todo.completed ? "Mark incomplete" : "Mark complete"}
                >
                  {todo.completed ? (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <rect
                        x="1"
                        y="1"
                        width="12"
                        height="12"
                        rx="3"
                        fill="var(--accent)"
                      />
                      <path
                        d="M4 7.2L6 9.2 10 4.8"
                        stroke="white"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <rect
                        x="1.5"
                        y="1.5"
                        width="11"
                        height="11"
                        rx="2.5"
                        stroke="var(--label-tertiary)"
                        strokeWidth="1.2"
                      />
                    </svg>
                  )}
                </button>
                <span
                  className="todo-text"
                  contentEditable
                  suppressContentEditableWarning
                  spellCheck={false}
                  onBlur={(e) =>
                    handleBlurEdit(todo.id, e.currentTarget.textContent ?? "")
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      e.currentTarget.blur();
                    }
                  }}
                >
                  {todo.text}
                </span>
                <button
                  className="todo-delete"
                  onClick={() => removeTodo(todo.id)}
                  aria-label="Delete"
                  title="Delete"
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
          <div className="todo-input-wrap">
            <input
              ref={inputRef}
              className="todo-input"
              type="text"
              placeholder="Add a task..."
              onKeyDown={handleAdd}
            />
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: Errors may remain in SidePanel/NotePanel (they still pass `tabId` to TodoSection). Fixed in next tasks.

- [ ] **Step 3: Commit**

```bash
git add src/components/NotePanel/TodoSection.tsx
git commit -m "refactor: TodoSection uses global todoStore"
```

---

## Task 5: Update NoteEditor and NotePanel for Panel-Based Usage

**Files:**
- Modify: `src/components/NotePanel/NoteEditor.tsx`
- Modify: `src/components/NotePanel/NotePanel.tsx`

- [ ] **Step 1: Update NoteEditor to accept panelId instead of tabId**

Replace the entire content of `src/components/NotePanel/NoteEditor.tsx`:

```typescript
import { useEffect, useRef } from "react";
import { EditorState, Compartment } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { baseMarkdownExtensions, buildFontSizeTheme } from "../../lib/codemirrorSetup";
import { useNoteStore } from "../../store/noteStore";
import { useTerminalConfigStore } from "../../store/terminalConfigStore";

interface NoteEditorProps {
  panelId: string;
}

export function NoteEditor({ panelId }: NoteEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const panelIdRef = useRef(panelId);
  const suppressRef = useRef(false);
  const fontSizeCompartment = useRef(new Compartment());

  const setMarkdown = useNoteStore((s) => s.setMarkdown);
  const terminalFontSize = useTerminalConfigStore((s) => s.fontSize);

  // Create editor once on mount
  useEffect(() => {
    if (!containerRef.current) return;

    const content =
      useNoteStore.getState().notes[panelId] ?? "";

    const initialFontSize = useTerminalConfigStore.getState().fontSize;

    const updateListener = EditorView.updateListener.of((update) => {
      if (suppressRef.current) return;
      if (update.docChanged) {
        const doc = update.state.doc.toString();
        setMarkdown(panelIdRef.current, doc);
      }
    });

    const state = EditorState.create({
      doc: content,
      extensions: [
        ...baseMarkdownExtensions({
          fontSizeCompartment: fontSizeCompartment.current,
          initialFontSize,
          placeholderText: "Type your note here...",
        }),
        updateListener,
      ],
    });

    const view = new EditorView({ state, parent: containerRef.current });
    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync font size with terminal config
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: fontSizeCompartment.current.reconfigure(
        buildFontSizeTheme(terminalFontSize)
      ),
    });
  }, [terminalFontSize]);

  // Swap content when panelId changes
  useEffect(() => {
    panelIdRef.current = panelId;
    const view = viewRef.current;
    if (!view) return;

    const newContent =
      useNoteStore.getState().notes[panelId] ?? "";
    const currentContent = view.state.doc.toString();

    if (newContent !== currentContent) {
      suppressRef.current = true;
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: newContent },
      });
      suppressRef.current = false;
    }
  }, [panelId]);

  return <div ref={containerRef} className="note-cm-container" />;
}
```

- [ ] **Step 2: Update NotePanel for panel-based usage**

Replace the entire content of `src/components/NotePanel/NotePanel.tsx`:

```typescript
import { NoteEditor } from "./NoteEditor";
import "./NotePanel.css";

interface NotePanelProps {
  panelId: string;
}

export function NotePanel({ panelId }: NotePanelProps) {
  return (
    <div className="note-panel note-panel--embedded">
      <div className="note-panel-header">
        <span className="note-panel-title">Note</span>
      </div>
      <div className="note-panel-body">
        <NoteEditor panelId={panelId} />
      </div>
    </div>
  );
}
```

Key changes:
- Accepts `panelId` instead of `tabId`
- No close button (panel lifecycle managed by connection switching)
- No TodoSection (todos are now in the side panel)
- Title changed to "Note" (singular)
- Added `note-panel--embedded` class for styling within PanelGrid

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit`
Expected: SidePanel still has errors (references old NoteEditor/TodoSection API). Fixed in next task.

- [ ] **Step 4: Commit**

```bash
git add src/components/NotePanel/NoteEditor.tsx src/components/NotePanel/NotePanel.tsx
git commit -m "refactor: NotePanel and NoteEditor use panelId, remove todo section"
```

---

## Task 6: Restructure SidePanel — Todos Tab Replaces Notes

**Files:**
- Modify: `src/components/SidePanel/SidePanel.tsx`

- [ ] **Step 1: Replace Notes tab with Todos tab**

Replace the entire content of `src/components/SidePanel/SidePanel.tsx`:

```typescript
import { TodoSection } from "../NotePanel/TodoSection";
import { TimersPanel } from "./TimersPanel";
import { CheatsheetPanel } from "./CheatsheetPanel";
import "../NotePanel/NotePanel.css";
import "./SidePanel.css";

export type SidebarTab = "todos" | "timers" | "cheatsheet";

interface SidePanelProps {
  activeTab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
  onClose: () => void;
}

export function SidePanel({ activeTab, onTabChange, onClose }: SidePanelProps) {
  return (
    <div className="side-panel">
      <div className="side-panel-header">
        <div className="side-panel-tabs">
          <button
            className={`side-panel-tab${activeTab === "todos" ? " side-panel-tab--active" : ""}`}
            onClick={() => onTabChange("todos")}
            title="Todos"
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <rect x="2.5" y="1.5" width="10" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
              <path d="M5 5l1.5 1.5L9 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
              <line x1="5" y1="8.5" x2="10" y2="8.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
              <line x1="5" y1="11" x2="8" y2="11" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
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
          <button
            className={`side-panel-tab${activeTab === "cheatsheet" ? " side-panel-tab--active" : ""}`}
            onClick={() => onTabChange("cheatsheet")}
            title="Cheatsheet"
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <path d="M5.5 3.5L2.5 7.5l3 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M9.5 3.5l3 4-3 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
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
        {activeTab === "todos" && <TodoSection />}
        {activeTab === "timers" && <TimersPanel />}
        {activeTab === "cheatsheet" && <CheatsheetPanel />}
      </div>
    </div>
  );
}
```

Key changes:
- `SidebarTab` type: `"notes"` → `"todos"`
- Removed `tabId` prop (no longer needed — todos are global)
- First tab icon changed to checklist style
- Notes tab and NoteEditor removed entirely
- `TodoSection` rendered without any props (global)
- Removed `useNoteStore` import and migration logic

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: Errors in `App.tsx` where `SidePanel` receives `tabId` prop and `sidebarTab` references `"notes"`. Fixed in Task 10.

- [ ] **Step 3: Commit**

```bash
git add src/components/SidePanel/SidePanel.tsx
git commit -m "refactor: SidePanel replaces Notes tab with global Todos tab"
```

---

## Task 7: Add Note Option to PanelContextMenu

**Files:**
- Modify: `src/components/PanelContextMenu/PanelContextMenu.tsx`

- [ ] **Step 1: Add "Note" option to context menu**

In `src/components/PanelContextMenu/PanelContextMenu.tsx`, add a "Note" section after the SSH profiles block (before the closing `</div>` of the menu, around line 152).

Insert before `</div>,` at line 153:

```typescript
      {/* Note */}
      <div className="panel-ctx-divider" />
      {(() => {
        const isActiveNote = connType === "note";
        return (
          <button
            className={`panel-ctx-item${isActiveNote ? " panel-ctx-item--active" : ""}`}
            onClick={() => !isActiveNote && handleClick({ type: "note" })}
            role="menuitem"
          >
            <svg className="panel-ctx-item-icon" width="14" height="14" viewBox="0 0 16 16" fill="none">
              <rect x="2.5" y="1.5" width="11" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
              <line x1="5.5" y1="5" x2="10.5" y2="5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
              <line x1="5.5" y1="7.5" x2="10.5" y2="7.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
              <line x1="5.5" y1="10" x2="8.5" y2="10" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
            </svg>
            <span className="panel-ctx-item-label">Note</span>
            <span className="panel-ctx-item-meta">Markdown</span>
            {isActiveNote && checkIcon}
          </button>
        );
      })()}
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: No new errors from this file

- [ ] **Step 3: Commit**

```bash
git add src/components/PanelContextMenu/PanelContextMenu.tsx
git commit -m "feat: add Note option to panel context menu"
```

---

## Task 8: Render NotePanel in PanelGrid

**Files:**
- Modify: `src/components/PanelGrid/PanelGrid.tsx`

- [ ] **Step 1: Import NotePanel and add rendering branch**

In `src/components/PanelGrid/PanelGrid.tsx`:

Add import at top (after line 3):
```typescript
import { NotePanel } from "../NotePanel/NotePanel";
```

Replace the panel rendering block (lines 160-189) with a conditional:

```typescript
        return (
          <div
            key={`${panel.id}-${connKey}`}
            className="panel-ctx-wrapper"
            onContextMenu={(e) => handleContextMenu(e, panel.id, panel.connection)}
            style={{
              ...(tab.layout === 3 && index === 0 && !isZoomed ? { gridRow: "1 / 3" } : {}),
              ...(hidden ? { display: "none" } : {}),
            }}
          >
            {panel.connection?.type === "note" ? (
              <NotePanel panelId={panel.id} />
            ) : (
              <TerminalPane
                cwd={tab.cwd}
                isActive={panel.id === activePanelId}
                broadcastEnabled={tab.broadcastEnabled}
                siblingSessionIds={siblingSessionIds}
                connectionType={panel.connection?.type}
                sshHost={sshProfile?.host}
                sshPort={sshProfile?.port}
                sshUsername={sshProfile?.username}
                sshIdentityFile={sshProfile?.identityFile}
                shellProgram={panel.connection?.shellProgram}
                shellArgs={panel.connection?.shellArgs}
                wslDistro={panel.connection?.wslDistro}
                onSessionCreated={(sessionId, connectionId) => handleSessionCreated(panel.id, sessionId, connectionId)}
                onSessionKilled={() => handleSessionKilled(panel.id)}
                onFocus={() => setActivePanelId(panel.id)}
                onNextPanel={handleNextPanel}
                onPrevPanel={handlePrevPanel}
              />
            )}
          </div>
        );
```

- [ ] **Step 2: Exclude note panels from siblingSessionIds**

The existing `siblingSessionIds` already filters on `p.sessionId !== null`. Since note panels have `sessionId: null`, they are automatically excluded from broadcast. No change needed here, but verify this by checking line 115-118:

```typescript
const siblingSessionIds = useMemo(
  () => tab.panels.filter((p) => p.sessionId !== null).map((p) => p.sessionId as string),
  [tab.panels]
);
```

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 4: Commit**

```bash
git add src/components/PanelGrid/PanelGrid.tsx
git commit -m "feat: render NotePanel for note-type panels in PanelGrid"
```

---

## Task 9: Add Note to SessionPicker

**Files:**
- Modify: `src/components/SessionPicker/SessionPicker.tsx`

- [ ] **Step 1: Extend ConnectionOption type and add Note icon**

In `src/components/SessionPicker/SessionPicker.tsx`:

Update `ConnectionOption` interface (line 21-30) — add `'note'` to type:

```typescript
interface ConnectionOption {
  id: string;
  type: "local" | "ssh" | "wsl" | "note";
  name: string;
  subtitle: string;
  sshProfileId?: string;
  shellProgram?: string;
  shellArgs?: string[];
  wslDistro?: string;
}
```

Update `optionToConnection` (line 32-41) — handle `'note'` type:

```typescript
function optionToConnection(opt: ConnectionOption): PanelConnection {
  if (opt.type === "note") {
    return { type: "note" };
  }
  return {
    type: opt.type,
    sshProfileId: opt.sshProfileId,
    shellProgram: opt.shellProgram,
    shellArgs: opt.shellArgs,
    wslDistro: opt.wslDistro,
    label: opt.type === "local" ? undefined : opt.name,
  };
}
```

Add Note icon after the existing icons (around line 74):

```typescript
const IconNote = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <rect x="2.5" y="1.5" width="11" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.25" />
    <line x1="5.5" y1="5" x2="10.5" y2="5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
    <line x1="5.5" y1="7.5" x2="10.5" y2="7.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
    <line x1="5.5" y1="10" x2="8.5" y2="10" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
  </svg>
);
```

- [ ] **Step 2: Add Note to the connection options list**

In the `connectionOptions` useMemo (line 302-325), add the Note option at the end of the `opts` array — after the SSH profiles loop (line 323) and before `return opts;` (line 324):

```typescript
    opts.push({
      id: "note",
      type: "note" as const,
      name: "Note",
      subtitle: "Markdown editor",
    });
    return opts;
```

Update the icon rendering in two places.

**"All Same" mode** (around line 443): Replace the icon conditional:
```typescript
{opt.type === "ssh" ? (
  <IconSsh />
) : opt.type === "wsl" ? (
  <IconLinux />
) : opt.type === "note" ? (
  <IconNote />
) : (
  <IconTerminal />
)}
```

**"Per Panel" dropdown** — find the same icon conditional in the `PanelConfigGrid` component and apply the same change.

- [ ] **Step 3: Add `.sp-dot--note` CSS**

In `src/components/SessionPicker/SessionPicker.css`, add after the existing `.sp-dot--wsl` rule (around line 276):

```css
.sp-dot--note {
  background: var(--accent);
}
```

- [ ] **Step 4: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/components/SessionPicker/SessionPicker.tsx src/components/SessionPicker/SessionPicker.css
git commit -m "feat: add Note as connection option in SessionPicker"
```

---

## Task 10: Add Note to Command Palette Connection Switching

**Files:**
- Modify: `src/App.tsx:688-778`

- [ ] **Step 1: Add Note command to switchConnectionPaletteSection**

In `src/App.tsx`, in the `switchConnectionPaletteSection` useMemo (around line 688), add a Note command to the `commands` array. Insert after the Local Shell command (after line 717) and before the WSL distros spread:

```typescript
      // Note
      {
        id: "conn:note",
        label: "Note",
        description: "Switch to a markdown note editor",
        meta: "Markdown",
        icon: (
          <span className="cp-cmd-icon">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="2" y="1" width="10" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
              <line x1="4.5" y1="4" x2="9.5" y2="4" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
              <line x1="4.5" y1="6.5" x2="9.5" y2="6.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
              <line x1="4.5" y1="9" x2="7.5" y2="9" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
            </svg>
          </span>
        ),
        isActive: connType === "note",
        action: () => {
          if (connType === "note") return;
          switchPanelConnection(activeTab.id, activePanelId, { type: "note" });
        },
      },
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat: add Note to command palette connection switching"
```

---

## Task 11: Workspace Persistence in tabStore

**Files:**
- Modify: `src/store/tabStore.ts`

- [ ] **Step 1: Add workspace save/restore logic to tabStore**

In `src/store/tabStore.ts`, add workspace persistence:

Add constants and types at the top (after line 4):

```typescript
const WORKSPACE_KEY = "v-terminal:workspace";
const WORKSPACE_SAVE_DEBOUNCE_MS = 300;

interface WorkspaceState {
  version: 1;
  tabs: Array<{
    id: string;
    label: string;
    cwd: string;
    layout: Layout;
    broadcastEnabled: boolean;
    panels: Array<{
      id: string;
      connection?: PanelConnection;
    }>;
  }>;
  activeTabId: string;
}
```

Add save/restore functions **after** `nextTabLabel` function (around line 47) — must be placed after `tabCounter` declaration at line 43 to avoid temporal dead zone:

```typescript
let workspaceSaveTimer: ReturnType<typeof setTimeout> | null = null;

function saveWorkspace(tabs: Tab[], activeTabId: string) {
  if (workspaceSaveTimer) clearTimeout(workspaceSaveTimer);
  workspaceSaveTimer = setTimeout(() => {
    try {
      const state: WorkspaceState = {
        version: 1,
        tabs: tabs
          .filter((t) => !t.pendingSessionPick)
          .map((t) => ({
            id: t.id,
            label: t.label,
            cwd: t.cwd,
            layout: t.layout,
            broadcastEnabled: t.broadcastEnabled,
            panels: t.panels.map((p) => ({
              id: p.id,
              connection: p.connection,
            })),
          })),
        activeTabId,
      };
      localStorage.setItem(WORKSPACE_KEY, JSON.stringify(state));
    } catch {}
  }, WORKSPACE_SAVE_DEBOUNCE_MS);
}

function loadWorkspace(): { tabs: Tab[]; activeTabId: string } | null {
  try {
    const raw = localStorage.getItem(WORKSPACE_KEY);
    if (!raw) return null;
    const state = JSON.parse(raw) as WorkspaceState;
    if (state.version !== 1 || !Array.isArray(state.tabs) || state.tabs.length === 0) return null;

    const tabs: Tab[] = state.tabs.map((t) => ({
      id: t.id,
      label: t.label,
      cwd: t.cwd,
      layout: t.layout,
      broadcastEnabled: t.broadcastEnabled,
      pendingSessionPick: false,
      panels: t.panels.map((p) => ({
        id: p.id,
        sessionId: null,
        connection: p.connection,
      })),
    }));

    // Update tabCounter to avoid label collisions
    const maxNum = tabs.reduce((max, t) => {
      const match = t.label.match(/^Terminal (\d+)$/);
      return match ? Math.max(max, parseInt(match[1], 10)) : max;
    }, 0);
    tabCounter = maxNum + 1;

    return { tabs, activeTabId: state.activeTabId };
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Initialize from workspace and add save triggers**

Modify the store initialization. Replace lines 62-67:

```typescript
export const useTabStore = create<TabStore>((set, get) => {
  const restored = loadWorkspace();
  const initialTabs = restored?.tabs ?? [createDefaultTab()];
  const initialActiveTabId = restored?.activeTabId ?? initialTabs[0].id;

  // Ensure activeTabId is valid
  const activeTabId = initialTabs.find((t) => t.id === initialActiveTabId)
    ? initialActiveTabId
    : initialTabs[0].id;

  return {
    tabs: initialTabs,
    activeTabId,
```

**Note on onboarding:** `loadWorkspace` sets `pendingSessionPick: false` on restored tabs, so restored tabs skip the SessionPicker. `saveWorkspace` filters out tabs with `pendingSessionPick: true`, so a tab left on the SessionPicker is not saved and the user gets a fresh default tab on next launch. The `showWelcome` check (`!onboardingDone && tabs.some(t => t.pendingSessionPick)`) still works correctly — if onboarding wasn't completed, the default tab created on fresh launch will have `pendingSessionPick: true`.

Add `saveWorkspace` call at the end of every state-mutating action. The simplest approach: add a Zustand `subscribe` after the store is created. Add at the bottom of the file (before the re-export line):

```typescript
// Persist workspace state on every change
useTabStore.subscribe((state) => {
  saveWorkspace(state.tabs, state.activeTabId);
});
```

- [ ] **Step 3: Add layout expansion fallback for note panels**

In the `setLayout` action (around line 120), modify the `baseConnection` logic. Replace lines 131-139:

```typescript
        // Inherit connection from the first panel so new panels match (e.g. SSH)
        // But if first panel is a note panel, fall back to local — users expect new terminals
        const firstConn = oldPanels[0]?.connection;
        const baseConnection = firstConn?.type === "note" ? undefined : firstConn;
        const extra: Panel[] = Array.from(
          { length: newCount - oldPanels.length },
          () => ({
            id: genId(),
            sessionId: null,
            ...(baseConnection ? { connection: { ...baseConnection } } : {}),
          }),
        );
```

- [ ] **Step 4: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/store/tabStore.ts
git commit -m "feat: workspace persistence in tabStore with layout expansion fallback"
```

---

## Task 12: App.tsx Integration — Cleanup, Sidebar Migration, Restore

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Update SidebarTab type and sidebar initialization**

In `src/App.tsx`:

Update the `SidebarTab` import (line 14):
```typescript
// Already imports from SidePanel — the type change propagates automatically
```

Update sidebar tab initialization (lines 66-75). Replace:

```typescript
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>(() => {
    const stored = localStorage.getItem("v-terminal:sidebar-tab");
    if (stored === "todos" || stored === "timers" || stored === "cheatsheet") return stored;
    // Migrate legacy values
    if (stored === "notes") {
      localStorage.setItem("v-terminal:sidebar-tab", "todos");
      return "todos";
    }
    if (stored === "pomodoro" || stored === "timer" || stored === "recurring" || stored === "alerts") {
      localStorage.setItem("v-terminal:sidebar-tab", "timers");
      return "timers";
    }
    return localStorage.getItem("v-terminal:alarm-open") === "true" ? "timers" : "todos";
  });
```

- [ ] **Step 2: Update SidePanel usage — remove tabId prop**

Find the `<SidePanel>` usage (around line 842). Remove the `tabId` prop:

```typescript
        {sidebarOpen && (
          <SidePanel
            activeTab={sidebarTab}
            onTabChange={handleSidebarTabChange}
            onClose={handleCloseSidebar}
          />
        )}
```

- [ ] **Step 3: Add note cleanup to tab close/kill handlers**

Import `useNoteStore` at the top of `App.tsx`:
```typescript
import { useNoteStore } from "./store/noteStore";
```

Update `handleTabClose` (line 780-782):
```typescript
  const handleTabClose = (tabId: string) => {
    const tab = tabs.find((t) => t.id === tabId);
    if (tab) {
      const notePanelIds = tab.panels
        .filter((p) => p.connection?.type === "note")
        .map((p) => p.id);
      if (notePanelIds.length > 0) {
        useNoteStore.getState().removeNotes(notePanelIds);
      }
    }
    removeTab(tabId);
  };
```

Update `handleTabKill` (line 784-793):
```typescript
  const handleTabKill = (tabId: string) => {
    const tab = tabs.find((t) => t.id === tabId);
    if (tab) {
      tab.panels
        .filter((p) => p.sessionId !== null)
        .forEach((p) => ipc.sessionKill(p.sessionId!).catch(() => {}));
      const notePanelIds = tab.panels
        .filter((p) => p.connection?.type === "note")
        .map((p) => p.id);
      if (notePanelIds.length > 0) {
        useNoteStore.getState().removeNotes(notePanelIds);
      }
    }
    removeTab(tabId);
  };
```

- [ ] **Step 4: Add note cleanup to layout change handler**

Update `handleLayoutChange` (around line 199-206):
```typescript
  const handleLayoutChange = useCallback((layout: Layout) => {
    if (!activeTab) return;
    const { removed } = setLayout(activeTab.id, layout);
    // Kill sessions for removed terminal panels
    removed
      .filter((p) => p.sessionId !== null)
      .forEach((p) => ipc.sessionKill(p.sessionId!).catch(() => {}));
    // Clean up notes for removed note panels
    const removedNotePanelIds = removed
      .filter((p) => p.connection?.type === "note")
      .map((p) => p.id);
    if (removedNotePanelIds.length > 0) {
      useNoteStore.getState().removeNotes(removedNotePanelIds);
    }
  }, [activeTab, setLayout]);
```

- [ ] **Step 5: Add note cleanup when switching away from note panel**

In the `switchConnectionPaletteSection` useMemo, update the Note command action to clean up note data when switching FROM note to something else. Also update every other connection switch action to clean up note data when the current panel is a note panel.

Actually, a simpler approach: add a `useEffect` that watches for panel connection changes and cleans up:

This is already handled by the `switchPanelConnection` flow in `PanelGrid.handleSwitchConnection`. We need to add cleanup there. But since `PanelGrid` doesn't know about noteStore, the cleanest approach is to handle this in `App.tsx`.

Add a cleanup effect for connection switching. In the command palette actions, before switching away from a note panel:

```typescript
        action: () => {
          if (isActiveLocal) return;
          // Clean up note data if switching away from note panel
          if (connType === "note") {
            useNoteStore.getState().removeNote(activePanelId);
          }
          switchPanelConnection(activeTab.id, activePanelId, { type: "local" });
        },
```

Apply the same pattern to all connection switch actions (WSL, SSH, and Note → anything else). The Note action doesn't need cleanup since it's switching TO note.

For the context menu switch in `PanelGrid.tsx`, add the same cleanup in `handleSwitchConnection`:

In `src/components/PanelGrid/PanelGrid.tsx`, update `handleSwitchConnection` (line 55-62):

```typescript
  const handleSwitchConnection = useCallback(
    (connection: PanelConnection) => {
      if (!ctxMenu) return;
      // Clean up note data if switching away from note panel
      // Use getState() to read current panels without adding tab to dependency array
      const currentTab = useTabStore.getState().tabs.find((t) => t.id === tab.id);
      const currentPanel = currentTab?.panels.find((p) => p.id === ctxMenu.panelId);
      if (currentPanel?.connection?.type === "note" && connection.type !== "note") {
        useNoteStore.getState().removeNote(ctxMenu.panelId);
      }
      switchPanelConnection(tab.id, ctxMenu.panelId, connection);
      setCtxMenu(null);
    },
    [ctxMenu, tab.id, switchPanelConnection]
  );
```

And add the imports at the top of `PanelGrid.tsx`:
```typescript
import { useNoteStore } from "../../store/noteStore";
```
(`useTabStore` is already imported in PanelGrid.tsx at line 6)

- [ ] **Step 6: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx src/components/PanelGrid/PanelGrid.tsx
git commit -m "feat: App.tsx integration — sidebar migration, note cleanup, workspace restore"
```

---

## Task 13: Data Migration

**Files:**
- Modify: `src/App.tsx` (add migration on mount)

- [ ] **Step 1: Add migration logic on app startup**

In `src/App.tsx`, add a one-time migration effect. Add near the other startup effects (around line 91):

```typescript
  // One-time migration from old per-tab notes+todos to new format
  useEffect(() => {
    const MIGRATION_KEY = "v-terminal:migration-note-panel-done";
    if (localStorage.getItem(MIGRATION_KEY)) return;

    // Migrate todos from old per-tab noteStore to global todoStore
    const oldNotesRaw = localStorage.getItem("v-terminal:tab-notes");
    if (oldNotesRaw) {
      try {
        const oldNotes = JSON.parse(oldNotesRaw) as Record<string, { markdown: string; todos: Array<{ id: string; text: string; completed: boolean }> }>;
        const allTodos: Array<{ id: string; text: string; completed: boolean }> = [];
        const seenTexts = new Set<string>();

        for (const tabNote of Object.values(oldNotes)) {
          if (tabNote.todos) {
            for (const todo of tabNote.todos) {
              const key = todo.text.trim().toLowerCase();
              if (!seenTexts.has(key)) {
                seenTexts.add(key);
                allTodos.push(todo);
              }
            }
          }
        }

        if (allTodos.length > 0) {
          const existingRaw = localStorage.getItem("v-terminal:todos");
          const existing = existingRaw ? JSON.parse(existingRaw) as Array<{ id: string; text: string; completed: boolean }> : [];
          localStorage.setItem("v-terminal:todos", JSON.stringify([...existing, ...allTodos]));
        }

        // Old notes are discarded — incompatible with panel-based model
        localStorage.removeItem("v-terminal:tab-notes");
      } catch {}
    }

    // Also remove legacy single-note key
    localStorage.removeItem("v-terminal:note-content");

    localStorage.setItem(MIGRATION_KEY, "true");
  }, []);
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat: migrate per-tab notes+todos to new format on startup"
```

---

## Task 14: NotePanel CSS for Embedded Mode

**Files:**
- Modify: `src/components/NotePanel/NotePanel.css`

- [ ] **Step 1: Add base NotePanel styles and embedded mode CSS**

Add to the **top** of `src/components/NotePanel/NotePanel.css` (before the existing `.note-cm-container` rule):

```css
/* ── NotePanel base styles ─────────────────────────────────────── */
.note-panel {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background: var(--bg-primary);
}

.note-panel-header {
  display: flex;
  align-items: center;
  height: 28px;
  padding: 0 10px;
  flex-shrink: 0;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--separator);
}

.note-panel-title {
  font-size: 11px;
  font-weight: 600;
  color: var(--label-tertiary);
  letter-spacing: 0.05em;
  text-transform: uppercase;
  font-family: "Pretendard", sans-serif;
}

.note-panel-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

/* ── Embedded mode — inside PanelGrid ──────────────────────────── */
.note-panel--embedded {
  border: none;
  border-radius: 0;
}

.note-panel--embedded .note-cm-container {
  height: 100%;
  border: none;
  border-radius: 0;
}

.note-panel--embedded .note-cm-container .cm-editor {
  height: 100%;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/NotePanel/NotePanel.css
git commit -m "style: add embedded NotePanel CSS for PanelGrid"
```

---

## Task 15: Final Build Verification

- [ ] **Step 1: Full TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 2: Dev server smoke test**

Run: `npm run dev`
Expected: App starts without console errors

- [ ] **Step 3: Verify key features manually**

Check:
1. Right-click panel → "Note" option appears
2. Clicking "Note" switches panel to markdown editor
3. Command palette → "Note" appears in Switch Connection
4. Side panel shows Todos (not Notes) tab with checklist icon
5. Todos work globally (same list across all tabs)
6. Close and reopen app → tabs, layouts, note panels restored
7. New tab via SessionPicker → "Note" available as connection type
8. Layout expansion from a note panel creates local terminal (not another note)

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: final cleanup for note panel promotion & session restore"
```
