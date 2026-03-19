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
