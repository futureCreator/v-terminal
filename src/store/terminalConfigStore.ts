import { create } from "zustand";

const STORAGE_KEY = "v-terminal:terminal-config";
const LEGACY_FONT_SIZE_KEY = "v-terminal:terminal-font-size";

export const MIN_FONT_SIZE = 10;
export const MAX_FONT_SIZE = 24;
export const DEFAULT_FONT_SIZE = 14;

export type CursorStyle = "block" | "underline" | "bar";

export interface TerminalConfig {
  fontSize: number;
  fontFamily: string;
  cursorStyle: CursorStyle;
  cursorBlink: boolean;
  lineHeight: number;
  scrollback: number;
}

const DEFAULTS: TerminalConfig = {
  fontSize: DEFAULT_FONT_SIZE,
  fontFamily: "JetBrains Mono",
  cursorStyle: "block",
  cursorBlink: true,
  lineHeight: 1.2,
  scrollback: 5000,
};

function loadConfig(): TerminalConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULTS, ...parsed };
    }
    // Migrate legacy font size key
    const legacySize = localStorage.getItem(LEGACY_FONT_SIZE_KEY);
    if (legacySize) {
      const size = Number(legacySize);
      if (size >= MIN_FONT_SIZE && size <= MAX_FONT_SIZE) {
        const config = { ...DEFAULTS, fontSize: size };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
        localStorage.removeItem(LEGACY_FONT_SIZE_KEY);
        return config;
      }
    }
  } catch {}
  return { ...DEFAULTS };
}

function saveConfig(config: TerminalConfig) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {}
}

interface TerminalConfigStore extends TerminalConfig {
  setFontSize: (size: number) => void;
  setFontFamily: (family: string) => void;
  setCursorStyle: (style: CursorStyle) => void;
  setCursorBlink: (blink: boolean) => void;
  setLineHeight: (height: number) => void;
  setScrollback: (lines: number) => void;
  increaseFontSize: () => void;
  decreaseFontSize: () => void;
  resetFontSize: () => void;
}

export const useTerminalConfigStore = create<TerminalConfigStore>((set, get) => ({
  ...loadConfig(),

  setFontSize: (size) => {
    const clamped = Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, size));
    set({ fontSize: clamped });
    saveConfig({ ...get(), fontSize: clamped });
  },
  setFontFamily: (family) => {
    set({ fontFamily: family });
    saveConfig({ ...get(), fontFamily: family });
  },
  setCursorStyle: (style) => {
    set({ cursorStyle: style });
    saveConfig({ ...get(), cursorStyle: style });
  },
  setCursorBlink: (blink) => {
    set({ cursorBlink: blink });
    saveConfig({ ...get(), cursorBlink: blink });
  },
  setLineHeight: (height) => {
    const clamped = Math.max(1.0, Math.min(1.6, Math.round(height * 10) / 10));
    set({ lineHeight: clamped });
    saveConfig({ ...get(), lineHeight: clamped });
  },
  setScrollback: (lines) => {
    const clamped = Math.max(1000, Math.min(10000, Math.round(lines / 1000) * 1000));
    set({ scrollback: clamped });
    saveConfig({ ...get(), scrollback: clamped });
  },
  increaseFontSize: () => get().setFontSize(get().fontSize + 1),
  decreaseFontSize: () => get().setFontSize(get().fontSize - 1),
  resetFontSize: () => get().setFontSize(DEFAULT_FONT_SIZE),
}));
