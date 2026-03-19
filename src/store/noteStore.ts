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
