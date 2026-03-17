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
