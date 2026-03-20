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
