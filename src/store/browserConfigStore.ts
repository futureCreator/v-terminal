import { create } from "zustand";

const STORAGE_KEY = "v-terminal:browser-config";

interface BrowserConfig {
  homePage: string;
}

const DEFAULTS: BrowserConfig = {
  homePage: "",
};

function loadConfig(): BrowserConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULTS };
}

function saveConfig(config: BrowserConfig) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {}
}

interface BrowserConfigStore extends BrowserConfig {
  setHomePage: (url: string) => void;
  getStartUrl: () => string;
}

export const useBrowserConfigStore = create<BrowserConfigStore>((set, get) => ({
  ...loadConfig(),

  setHomePage: (url) => {
    set({ homePage: url });
    saveConfig({ ...get(), homePage: url });
  },

  getStartUrl: () => {
    const hp = get().homePage.trim();
    return hp || "about:blank";
  },
}));
