import { create } from "zustand";

const STORAGE_KEY = "v-terminal:terminal-font-size";
const DEFAULT_SIZE = 14;
const MIN_SIZE = 10;
const MAX_SIZE = 24;

function loadFontSize(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const n = Number(raw);
      if (n >= MIN_SIZE && n <= MAX_SIZE) return n;
    }
  } catch {}
  return DEFAULT_SIZE;
}

interface TerminalFontStore {
  fontSize: number;
  setFontSize: (size: number) => void;
  increase: () => void;
  decrease: () => void;
  reset: () => void;
}

export const useTerminalFontStore = create<TerminalFontStore>((set, get) => ({
  fontSize: loadFontSize(),
  setFontSize: (size) => {
    const clamped = Math.max(MIN_SIZE, Math.min(MAX_SIZE, size));
    try { localStorage.setItem(STORAGE_KEY, String(clamped)); } catch {}
    set({ fontSize: clamped });
  },
  increase: () => get().setFontSize(get().fontSize + 1),
  decrease: () => get().setFontSize(get().fontSize - 1),
  reset: () => get().setFontSize(DEFAULT_SIZE),
}));

export { MIN_SIZE, MAX_SIZE, DEFAULT_SIZE };
