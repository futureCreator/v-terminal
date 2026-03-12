import { create } from "zustand";
import { THEMES, type ThemeDefinition } from "../themes/definitions";

export type ThemeId = string; // "auto" | theme id from definitions

const THEME_KEY = "v-terminal:theme";

function loadThemeId(): ThemeId {
  try {
    const raw = localStorage.getItem(THEME_KEY);
    if (raw && (raw === "auto" || raw in THEMES)) return raw;
  } catch {}
  return "auto";
}

export function getSystemTheme(): "dark" | "light" {
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function resolveThemeDefinition(themeId: ThemeId): ThemeDefinition {
  if (themeId === "auto") {
    return THEMES[getSystemTheme()];
  }
  return THEMES[themeId] ?? THEMES["dark"];
}

interface ThemeStore {
  themeId: ThemeId;
  setThemeId: (id: ThemeId) => void;
}

export const useThemeStore = create<ThemeStore>((set) => ({
  themeId: loadThemeId(),
  setThemeId: (id) => {
    try { localStorage.setItem(THEME_KEY, id); } catch {}
    set({ themeId: id });
  },
}));
