import { create } from "zustand";
import { v4 as uuidv4 } from "uuid";

const STORAGE_KEY = "v-terminal:tab-notes";
const OLD_STORAGE_KEY = "v-terminal:note-content";
const SAVE_DEBOUNCE_MS = 300;

export interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
}

export interface TabNote {
  markdown: string;
  todos: TodoItem[];
}

interface NoteStore {
  notes: Record<string, TabNote>;

  // Memo
  setMarkdown: (tabId: string, markdown: string) => void;

  // Todos
  addTodo: (tabId: string, text: string) => void;
  toggleTodo: (tabId: string, todoId: string) => void;
  removeTodo: (tabId: string, todoId: string) => void;
  updateTodoText: (tabId: string, todoId: string, text: string) => void;
  clearCompleted: (tabId: string) => void;

  // Cleanup
  removeTabNotes: (tabId: string) => void;

  // Migration (call once on startup with the first active tab id)
  migrateOldNote: (tabId: string) => void;
}

function load(): Record<string, TabNote> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, TabNote>) : {};
  } catch {
    return {};
  }
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

function save(notes: Record<string, TabNote>) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
    } catch {}
  }, SAVE_DEBOUNCE_MS);
}

function ensureTab(notes: Record<string, TabNote>, tabId: string): TabNote {
  return notes[tabId] ?? { markdown: "", todos: [] };
}

export const useNoteStore = create<NoteStore>((set) => ({
  notes: load(),

  setMarkdown: (tabId, markdown) =>
    set((s) => {
      const note = ensureTab(s.notes, tabId);
      const notes = { ...s.notes, [tabId]: { ...note, markdown } };
      save(notes);
      return { notes };
    }),

  addTodo: (tabId, text) =>
    set((s) => {
      const note = ensureTab(s.notes, tabId);
      const todo: TodoItem = { id: uuidv4(), text, completed: false };
      const notes = {
        ...s.notes,
        [tabId]: { ...note, todos: [...note.todos, todo] },
      };
      save(notes);
      return { notes };
    }),

  toggleTodo: (tabId, todoId) =>
    set((s) => {
      const note = ensureTab(s.notes, tabId);
      const notes = {
        ...s.notes,
        [tabId]: {
          ...note,
          todos: note.todos.map((t) =>
            t.id === todoId ? { ...t, completed: !t.completed } : t
          ),
        },
      };
      save(notes);
      return { notes };
    }),

  removeTodo: (tabId, todoId) =>
    set((s) => {
      const note = ensureTab(s.notes, tabId);
      const notes = {
        ...s.notes,
        [tabId]: {
          ...note,
          todos: note.todos.filter((t) => t.id !== todoId),
        },
      };
      save(notes);
      return { notes };
    }),

  updateTodoText: (tabId, todoId, text) =>
    set((s) => {
      const note = ensureTab(s.notes, tabId);
      const notes = {
        ...s.notes,
        [tabId]: {
          ...note,
          todos: note.todos.map((t) =>
            t.id === todoId ? { ...t, text } : t
          ),
        },
      };
      save(notes);
      return { notes };
    }),

  clearCompleted: (tabId) =>
    set((s) => {
      const note = ensureTab(s.notes, tabId);
      const notes = {
        ...s.notes,
        [tabId]: {
          ...note,
          todos: note.todos.filter((t) => !t.completed),
        },
      };
      save(notes);
      return { notes };
    }),

  removeTabNotes: (tabId) =>
    set((s) => {
      const { [tabId]: _, ...rest } = s.notes;
      save(rest);
      return { notes: rest };
    }),

  migrateOldNote: (tabId) =>
    set((s) => {
      const old = localStorage.getItem(OLD_STORAGE_KEY);
      if (!old) return s;
      localStorage.removeItem(OLD_STORAGE_KEY);
      const note = ensureTab(s.notes, tabId);
      const notes = {
        ...s.notes,
        [tabId]: { ...note, markdown: old },
      };
      save(notes);
      return { notes };
    }),
}));
