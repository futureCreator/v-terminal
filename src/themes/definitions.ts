import type { ITheme } from "@xterm/xterm";

export interface ThemeDefinition {
  id: string;
  name: string;
  isDark: boolean;
  cssVars: Record<string, string>;
  xterm: ITheme;
  /** [bg, color1, color2, color3, color4] for swatch preview */
  swatch: [string, string, string, string, string];
}

export interface ThemeGroup {
  label: string;
  themes: ThemeDefinition[];
}

// ─────────────────────────────────────────────────────────────────
// Apple
// ─────────────────────────────────────────────────────────────────

export const dark: ThemeDefinition = {
  id: "dark", name: "Dark", isDark: true,
  swatch: ["#1c1c1e", "#ff453a", "#30d158", "#0a84ff", "#bf5af2"],
  cssVars: {
    "--bg-primary": "#1c1c1e", "--bg-secondary": "#2c2c2e", "--bg-tertiary": "#3a3a3c",
    "--bg-elevated": "#242426", "--bg-terminal": "#1c1c1e", "--bg-panel-border": "#3a3a3c",
    "--bg-titlebar": "rgba(36,36,38,0.9)", "--bg-topbar": "rgba(44,44,46,0.88)",
    "--label-primary": "rgba(255,255,255,0.85)", "--label-secondary": "rgba(255,255,255,0.55)",
    "--label-tertiary": "rgba(255,255,255,0.25)", "--label-disabled": "rgba(255,255,255,0.15)",
    "--accent": "#0a84ff", "--accent-hover": "#409cff", "--accent-pressed": "#0070d8",
    "--destructive": "#ff453a", "--warning": "#ffd60a",
    "--broadcast": "#ff9f0a", "--broadcast-dim": "rgba(255,159,10,0.15)", "--success": "#30d158",
    "--shadow-sm": "0 1px 3px rgba(0,0,0,0.4),0 1px 2px rgba(0,0,0,0.3)",
    "--shadow-md": "0 4px 12px rgba(0,0,0,0.5),0 2px 4px rgba(0,0,0,0.4)",
    "--separator": "rgba(255,255,255,0.08)", "--separator-strong": "rgba(255,255,255,0.15)",
  },
  xterm: {
    background: "#1c1c1e", foreground: "rgba(255,255,255,0.85)",
    cursor: "#0a84ff", cursorAccent: "#1c1c1e",
    selectionBackground: "rgba(10,132,255,0.3)", selectionInactiveBackground: "rgba(255,255,255,0.1)",
    black: "#1c1c1e", red: "#ff453a", green: "#30d158", yellow: "#ffd60a",
    blue: "#0a84ff", magenta: "#bf5af2", cyan: "#5ac8f5", white: "rgba(255,255,255,0.85)",
    brightBlack: "#636366", brightRed: "#ff6961", brightGreen: "#34c759", brightYellow: "#ffd60a",
    brightBlue: "#409cff", brightMagenta: "#da8fff", brightCyan: "#70d7ff", brightWhite: "#ffffff",
  },
};

export const light: ThemeDefinition = {
  id: "light", name: "Light", isDark: false,
  swatch: ["#f2f2f7", "#ff3b30", "#34c759", "#007aff", "#bf5af2"],
  cssVars: {
    "--bg-primary": "#f2f2f7", "--bg-secondary": "#ffffff", "--bg-tertiary": "#e5e5ea",
    "--bg-elevated": "#f9f9f9", "--bg-terminal": "#f9f9f9", "--bg-panel-border": "#c6c6c8",
    "--bg-titlebar": "rgba(242,242,247,0.9)", "--bg-topbar": "rgba(255,255,255,0.88)",
    "--label-primary": "rgba(0,0,0,0.85)", "--label-secondary": "rgba(0,0,0,0.55)",
    "--label-tertiary": "rgba(0,0,0,0.30)", "--label-disabled": "rgba(0,0,0,0.18)",
    "--accent": "#007aff", "--accent-hover": "#3395ff", "--accent-pressed": "#0062cc",
    "--destructive": "#ff3b30", "--warning": "#ff9500",
    "--broadcast": "#ff9500", "--broadcast-dim": "rgba(255,149,0,0.12)", "--success": "#34c759",
    "--shadow-sm": "0 1px 3px rgba(0,0,0,0.12),0 1px 2px rgba(0,0,0,0.08)",
    "--shadow-md": "0 4px 12px rgba(0,0,0,0.15),0 2px 4px rgba(0,0,0,0.10)",
    "--separator": "rgba(0,0,0,0.10)", "--separator-strong": "rgba(0,0,0,0.18)",
  },
  xterm: {
    background: "#f9f9f9", foreground: "rgba(0,0,0,0.85)",
    cursor: "#007aff", cursorAccent: "#f9f9f9",
    selectionBackground: "rgba(0,122,255,0.25)", selectionInactiveBackground: "rgba(0,0,0,0.1)",
    black: "#1c1c1e", red: "#c41a16", green: "#007c15", yellow: "#946a00",
    blue: "#0431fa", magenta: "#9a2eae", cyan: "#1b7ea0", white: "rgba(0,0,0,0.75)",
    brightBlack: "#6c6c70", brightRed: "#ff3b30", brightGreen: "#34c759", brightYellow: "#ff9500",
    brightBlue: "#007aff", brightMagenta: "#bf5af2", brightCyan: "#5ac8f5", brightWhite: "#1c1c1e",
  },
};

// ─────────────────────────────────────────────────────────────────
// Popular
// ─────────────────────────────────────────────────────────────────

export const dracula: ThemeDefinition = {
  id: "dracula", name: "Dracula", isDark: true,
  swatch: ["#282a36", "#ff5555", "#50fa7b", "#bd93f9", "#ff79c6"],
  cssVars: {
    "--bg-primary": "#21222c", "--bg-secondary": "#282a36", "--bg-tertiary": "#44475a",
    "--bg-elevated": "#1e1f29", "--bg-terminal": "#282a36", "--bg-panel-border": "#44475a",
    "--bg-titlebar": "rgba(30,31,41,0.92)", "--bg-topbar": "rgba(33,34,44,0.92)",
    "--label-primary": "#f8f8f2", "--label-secondary": "rgba(248,248,242,0.65)",
    "--label-tertiary": "rgba(248,248,242,0.35)", "--label-disabled": "rgba(248,248,242,0.2)",
    "--accent": "#bd93f9", "--accent-hover": "#caa5fb", "--accent-pressed": "#9c6ef6",
    "--destructive": "#ff5555", "--warning": "#f1fa8c",
    "--broadcast": "#ffb86c", "--broadcast-dim": "rgba(255,184,108,0.15)", "--success": "#50fa7b",
    "--shadow-sm": "0 1px 3px rgba(0,0,0,0.5),0 1px 2px rgba(0,0,0,0.4)",
    "--shadow-md": "0 4px 12px rgba(0,0,0,0.6),0 2px 4px rgba(0,0,0,0.5)",
    "--separator": "rgba(255,255,255,0.08)", "--separator-strong": "rgba(255,255,255,0.14)",
  },
  xterm: {
    background: "#282a36", foreground: "#f8f8f2",
    cursor: "#bd93f9", cursorAccent: "#282a36",
    selectionBackground: "rgba(189,147,249,0.3)", selectionInactiveBackground: "rgba(255,255,255,0.1)",
    black: "#21222c", red: "#ff5555", green: "#50fa7b", yellow: "#f1fa8c",
    blue: "#bd93f9", magenta: "#ff79c6", cyan: "#8be9fd", white: "#f8f8f2",
    brightBlack: "#6272a4", brightRed: "#ff6e6e", brightGreen: "#69ff94", brightYellow: "#ffffa5",
    brightBlue: "#d6acff", brightMagenta: "#ff92df", brightCyan: "#a4ffff", brightWhite: "#ffffff",
  },
};

export const monokai: ThemeDefinition = {
  id: "monokai", name: "Monokai", isDark: true,
  swatch: ["#272822", "#f92672", "#a6e22e", "#66d9e8", "#ae81ff"],
  cssVars: {
    "--bg-primary": "#1e1f1c", "--bg-secondary": "#272822", "--bg-tertiary": "#3e3d32",
    "--bg-elevated": "#1a1b17", "--bg-terminal": "#272822", "--bg-panel-border": "#3e3d32",
    "--bg-titlebar": "rgba(26,27,23,0.92)", "--bg-topbar": "rgba(30,31,28,0.92)",
    "--label-primary": "#f8f8f2", "--label-secondary": "rgba(248,248,242,0.65)",
    "--label-tertiary": "rgba(248,248,242,0.35)", "--label-disabled": "rgba(248,248,242,0.2)",
    "--accent": "#a6e22e", "--accent-hover": "#bbf04b", "--accent-pressed": "#8ec920",
    "--destructive": "#f92672", "--warning": "#f4bf75",
    "--broadcast": "#fd971f", "--broadcast-dim": "rgba(253,151,31,0.15)", "--success": "#a6e22e",
    "--shadow-sm": "0 1px 3px rgba(0,0,0,0.5),0 1px 2px rgba(0,0,0,0.4)",
    "--shadow-md": "0 4px 12px rgba(0,0,0,0.6),0 2px 4px rgba(0,0,0,0.5)",
    "--separator": "rgba(255,255,255,0.08)", "--separator-strong": "rgba(255,255,255,0.14)",
  },
  xterm: {
    background: "#272822", foreground: "#f8f8f2",
    cursor: "#f8f8f2", cursorAccent: "#272822",
    selectionBackground: "rgba(73,72,62,0.8)", selectionInactiveBackground: "rgba(255,255,255,0.1)",
    black: "#272822", red: "#f92672", green: "#a6e22e", yellow: "#f4bf75",
    blue: "#66d9e8", magenta: "#ae81ff", cyan: "#a1efe4", white: "#f8f8f2",
    brightBlack: "#75715e", brightRed: "#f92672", brightGreen: "#a6e22e", brightYellow: "#f4bf75",
    brightBlue: "#66d9e8", brightMagenta: "#ae81ff", brightCyan: "#a1efe4", brightWhite: "#f9f8f5",
  },
};

export const tokyoNight: ThemeDefinition = {
  id: "tokyo-night", name: "Tokyo Night", isDark: true,
  swatch: ["#1a1b26", "#f7768e", "#9ece6a", "#7aa2f7", "#bb9af7"],
  cssVars: {
    "--bg-primary": "#1a1b26", "--bg-secondary": "#24283b", "--bg-tertiary": "#2f3549",
    "--bg-elevated": "#16171f", "--bg-terminal": "#1a1b26", "--bg-panel-border": "#3b4261",
    "--bg-titlebar": "rgba(22,23,31,0.92)", "--bg-topbar": "rgba(26,27,38,0.92)",
    "--label-primary": "#c0caf5", "--label-secondary": "rgba(192,202,245,0.65)",
    "--label-tertiary": "rgba(192,202,245,0.35)", "--label-disabled": "rgba(192,202,245,0.2)",
    "--accent": "#7aa2f7", "--accent-hover": "#8fb3f8", "--accent-pressed": "#5f87e6",
    "--destructive": "#f7768e", "--warning": "#e0af68",
    "--broadcast": "#ff9e64", "--broadcast-dim": "rgba(255,158,100,0.15)", "--success": "#9ece6a",
    "--shadow-sm": "0 1px 3px rgba(0,0,0,0.5),0 1px 2px rgba(0,0,0,0.4)",
    "--shadow-md": "0 4px 12px rgba(0,0,0,0.6),0 2px 4px rgba(0,0,0,0.5)",
    "--separator": "rgba(255,255,255,0.08)", "--separator-strong": "rgba(255,255,255,0.14)",
  },
  xterm: {
    background: "#1a1b26", foreground: "#c0caf5",
    cursor: "#7aa2f7", cursorAccent: "#1a1b26",
    selectionBackground: "rgba(122,162,247,0.3)", selectionInactiveBackground: "rgba(255,255,255,0.1)",
    black: "#1d202f", red: "#f7768e", green: "#9ece6a", yellow: "#e0af68",
    blue: "#7aa2f7", magenta: "#bb9af7", cyan: "#7dcfff", white: "#a9b1d6",
    brightBlack: "#414868", brightRed: "#f7768e", brightGreen: "#9ece6a", brightYellow: "#e0af68",
    brightBlue: "#7aa2f7", brightMagenta: "#bb9af7", brightCyan: "#7dcfff", brightWhite: "#c0caf5",
  },
};

export const oneDark: ThemeDefinition = {
  id: "one-dark", name: "One Dark", isDark: true,
  swatch: ["#282c34", "#e06c75", "#98c379", "#61afef", "#c678dd"],
  cssVars: {
    "--bg-primary": "#21252b", "--bg-secondary": "#282c34", "--bg-tertiary": "#2c313a",
    "--bg-elevated": "#1d2025", "--bg-terminal": "#282c34", "--bg-panel-border": "#3e4451",
    "--bg-titlebar": "rgba(29,32,37,0.92)", "--bg-topbar": "rgba(33,37,43,0.92)",
    "--label-primary": "#abb2bf", "--label-secondary": "rgba(171,178,191,0.65)",
    "--label-tertiary": "rgba(171,178,191,0.35)", "--label-disabled": "rgba(171,178,191,0.2)",
    "--accent": "#61afef", "--accent-hover": "#7bbff4", "--accent-pressed": "#4a9ee0",
    "--destructive": "#e06c75", "--warning": "#e5c07b",
    "--broadcast": "#d19a66", "--broadcast-dim": "rgba(209,154,102,0.15)", "--success": "#98c379",
    "--shadow-sm": "0 1px 3px rgba(0,0,0,0.5),0 1px 2px rgba(0,0,0,0.4)",
    "--shadow-md": "0 4px 12px rgba(0,0,0,0.6),0 2px 4px rgba(0,0,0,0.5)",
    "--separator": "rgba(255,255,255,0.07)", "--separator-strong": "rgba(255,255,255,0.13)",
  },
  xterm: {
    background: "#282c34", foreground: "#abb2bf",
    cursor: "#61afef", cursorAccent: "#282c34",
    selectionBackground: "rgba(97,175,239,0.3)", selectionInactiveBackground: "rgba(255,255,255,0.1)",
    black: "#282c34", red: "#e06c75", green: "#98c379", yellow: "#e5c07b",
    blue: "#61afef", magenta: "#c678dd", cyan: "#56b6c2", white: "#abb2bf",
    brightBlack: "#5c6370", brightRed: "#e06c75", brightGreen: "#98c379", brightYellow: "#e5c07b",
    brightBlue: "#61afef", brightMagenta: "#c678dd", brightCyan: "#56b6c2", brightWhite: "#ffffff",
  },
};

export const ayu: ThemeDefinition = {
  id: "ayu", name: "Ayu", isDark: true,
  swatch: ["#1f2430", "#f28779", "#bae67e", "#5ccfe6", "#d4bfff"],
  cssVars: {
    "--bg-primary": "#1a1f29", "--bg-secondary": "#1f2430", "--bg-tertiary": "#2d3347",
    "--bg-elevated": "#161b24", "--bg-terminal": "#1f2430", "--bg-panel-border": "#2d3347",
    "--bg-titlebar": "rgba(22,27,36,0.92)", "--bg-topbar": "rgba(26,31,41,0.92)",
    "--label-primary": "#cbccc6", "--label-secondary": "rgba(203,204,198,0.65)",
    "--label-tertiary": "rgba(203,204,198,0.35)", "--label-disabled": "rgba(203,204,198,0.2)",
    "--accent": "#ffcc66", "--accent-hover": "#ffd480", "--accent-pressed": "#f0bb44",
    "--destructive": "#ff3333", "--warning": "#ffd580",
    "--broadcast": "#f28779", "--broadcast-dim": "rgba(242,135,121,0.15)", "--success": "#bae67e",
    "--shadow-sm": "0 1px 3px rgba(0,0,0,0.5),0 1px 2px rgba(0,0,0,0.4)",
    "--shadow-md": "0 4px 12px rgba(0,0,0,0.6),0 2px 4px rgba(0,0,0,0.5)",
    "--separator": "rgba(255,255,255,0.08)", "--separator-strong": "rgba(255,255,255,0.14)",
  },
  xterm: {
    background: "#1f2430", foreground: "#cbccc6",
    cursor: "#ffcc66", cursorAccent: "#1f2430",
    selectionBackground: "rgba(255,204,102,0.25)", selectionInactiveBackground: "rgba(255,255,255,0.1)",
    black: "#191e2a", red: "#f28779", green: "#bae67e", yellow: "#ffd580",
    blue: "#5ccfe6", magenta: "#d4bfff", cyan: "#95e6cb", white: "#c7c7c7",
    brightBlack: "#707a8c", brightRed: "#f28779", brightGreen: "#bae67e", brightYellow: "#ffd580",
    brightBlue: "#5ccfe6", brightMagenta: "#d4bfff", brightCyan: "#95e6cb", brightWhite: "#ffffff",
  },
};

export const nord: ThemeDefinition = {
  id: "nord", name: "Nord", isDark: true,
  swatch: ["#2e3440", "#bf616a", "#a3be8c", "#88c0d0", "#b48ead"],
  cssVars: {
    "--bg-primary": "#2e3440", "--bg-secondary": "#3b4252", "--bg-tertiary": "#434c5e",
    "--bg-elevated": "#292e39", "--bg-terminal": "#2e3440", "--bg-panel-border": "#4c566a",
    "--bg-titlebar": "rgba(41,46,57,0.92)", "--bg-topbar": "rgba(46,52,64,0.92)",
    "--label-primary": "#eceff4", "--label-secondary": "rgba(236,239,244,0.65)",
    "--label-tertiary": "rgba(236,239,244,0.35)", "--label-disabled": "rgba(236,239,244,0.2)",
    "--accent": "#88c0d0", "--accent-hover": "#9ecfde", "--accent-pressed": "#6daebd",
    "--destructive": "#bf616a", "--warning": "#ebcb8b",
    "--broadcast": "#d08770", "--broadcast-dim": "rgba(208,135,112,0.15)", "--success": "#a3be8c",
    "--shadow-sm": "0 1px 3px rgba(0,0,0,0.4),0 1px 2px rgba(0,0,0,0.3)",
    "--shadow-md": "0 4px 12px rgba(0,0,0,0.5),0 2px 4px rgba(0,0,0,0.4)",
    "--separator": "rgba(236,239,244,0.08)", "--separator-strong": "rgba(236,239,244,0.14)",
  },
  xterm: {
    background: "#2e3440", foreground: "#eceff4",
    cursor: "#88c0d0", cursorAccent: "#2e3440",
    selectionBackground: "rgba(136,192,208,0.3)", selectionInactiveBackground: "rgba(255,255,255,0.1)",
    black: "#3b4252", red: "#bf616a", green: "#a3be8c", yellow: "#ebcb8b",
    blue: "#81a1c1", magenta: "#b48ead", cyan: "#88c0d0", white: "#e5e9f0",
    brightBlack: "#4c566a", brightRed: "#bf616a", brightGreen: "#a3be8c", brightYellow: "#ebcb8b",
    brightBlue: "#81a1c1", brightMagenta: "#b48ead", brightCyan: "#8fbcbb", brightWhite: "#eceff4",
  },
};

// ─────────────────────────────────────────────────────────────────
// Catppuccin
// ─────────────────────────────────────────────────────────────────

export const catppuccinLatte: ThemeDefinition = {
  id: "catppuccin-latte", name: "Latte", isDark: false,
  swatch: ["#eff1f5", "#d20f39", "#40a02b", "#1e66f5", "#8839ef"],
  cssVars: {
    "--bg-primary": "#eff1f5", "--bg-secondary": "#e6e9ef", "--bg-tertiary": "#dce0e8",
    "--bg-elevated": "#f5f5f5", "--bg-terminal": "#eff1f5", "--bg-panel-border": "#ccd0da",
    "--bg-titlebar": "rgba(230,233,239,0.9)", "--bg-topbar": "rgba(239,241,245,0.88)",
    "--label-primary": "rgba(76,79,105,0.9)", "--label-secondary": "rgba(76,79,105,0.60)",
    "--label-tertiary": "rgba(76,79,105,0.38)", "--label-disabled": "rgba(76,79,105,0.22)",
    "--accent": "#1e66f5", "--accent-hover": "#3d7ef7", "--accent-pressed": "#0952d9",
    "--destructive": "#d20f39", "--warning": "#df8e1d",
    "--broadcast": "#fe640b", "--broadcast-dim": "rgba(254,100,11,0.12)", "--success": "#40a02b",
    "--shadow-sm": "0 1px 3px rgba(0,0,0,0.12),0 1px 2px rgba(0,0,0,0.08)",
    "--shadow-md": "0 4px 12px rgba(0,0,0,0.15),0 2px 4px rgba(0,0,0,0.10)",
    "--separator": "rgba(76,79,105,0.10)", "--separator-strong": "rgba(76,79,105,0.18)",
  },
  xterm: {
    background: "#eff1f5", foreground: "#4c4f69",
    cursor: "#1e66f5", cursorAccent: "#eff1f5",
    selectionBackground: "rgba(30,102,245,0.2)", selectionInactiveBackground: "rgba(0,0,0,0.1)",
    black: "#5c5f77", red: "#d20f39", green: "#40a02b", yellow: "#df8e1d",
    blue: "#1e66f5", magenta: "#8839ef", cyan: "#179299", white: "#acb0be",
    brightBlack: "#6c6f85", brightRed: "#d20f39", brightGreen: "#40a02b", brightYellow: "#df8e1d",
    brightBlue: "#1e66f5", brightMagenta: "#8839ef", brightCyan: "#179299", brightWhite: "#dce0e8",
  },
};

export const catppuccinFrappe: ThemeDefinition = {
  id: "catppuccin-frappe", name: "Frappé", isDark: true,
  swatch: ["#303446", "#e78284", "#a6d189", "#8caaee", "#ca9ee6"],
  cssVars: {
    "--bg-primary": "#232634", "--bg-secondary": "#303446", "--bg-tertiary": "#414559",
    "--bg-elevated": "#1e2030", "--bg-terminal": "#303446", "--bg-panel-border": "#51576d",
    "--bg-titlebar": "rgba(30,32,48,0.92)", "--bg-topbar": "rgba(35,38,52,0.92)",
    "--label-primary": "#c6d0f5", "--label-secondary": "rgba(198,208,245,0.65)",
    "--label-tertiary": "rgba(198,208,245,0.35)", "--label-disabled": "rgba(198,208,245,0.2)",
    "--accent": "#8caaee", "--accent-hover": "#a0baf2", "--accent-pressed": "#6e90e0",
    "--destructive": "#e78284", "--warning": "#e5c890",
    "--broadcast": "#ef9f76", "--broadcast-dim": "rgba(239,159,118,0.15)", "--success": "#a6d189",
    "--shadow-sm": "0 1px 3px rgba(0,0,0,0.5),0 1px 2px rgba(0,0,0,0.4)",
    "--shadow-md": "0 4px 12px rgba(0,0,0,0.6),0 2px 4px rgba(0,0,0,0.5)",
    "--separator": "rgba(255,255,255,0.08)", "--separator-strong": "rgba(255,255,255,0.14)",
  },
  xterm: {
    background: "#303446", foreground: "#c6d0f5",
    cursor: "#8caaee", cursorAccent: "#303446",
    selectionBackground: "rgba(140,170,238,0.3)", selectionInactiveBackground: "rgba(255,255,255,0.1)",
    black: "#51576d", red: "#e78284", green: "#a6d189", yellow: "#e5c890",
    blue: "#8caaee", magenta: "#ca9ee6", cyan: "#81c8be", white: "#b5bfe2",
    brightBlack: "#626880", brightRed: "#e78284", brightGreen: "#a6d189", brightYellow: "#e5c890",
    brightBlue: "#8caaee", brightMagenta: "#ca9ee6", brightCyan: "#81c8be", brightWhite: "#a5adce",
  },
};

export const catppuccinMacchiato: ThemeDefinition = {
  id: "catppuccin-macchiato", name: "Macchiato", isDark: true,
  swatch: ["#24273a", "#ed8796", "#a6da95", "#8aadf4", "#c6a0f6"],
  cssVars: {
    "--bg-primary": "#181926", "--bg-secondary": "#24273a", "--bg-tertiary": "#363a4f",
    "--bg-elevated": "#141621", "--bg-terminal": "#24273a", "--bg-panel-border": "#494d64",
    "--bg-titlebar": "rgba(20,22,33,0.92)", "--bg-topbar": "rgba(24,25,38,0.92)",
    "--label-primary": "#cad3f5", "--label-secondary": "rgba(202,211,245,0.65)",
    "--label-tertiary": "rgba(202,211,245,0.35)", "--label-disabled": "rgba(202,211,245,0.2)",
    "--accent": "#8aadf4", "--accent-hover": "#a0bef7", "--accent-pressed": "#6c96ec",
    "--destructive": "#ed8796", "--warning": "#eed49f",
    "--broadcast": "#f5a97f", "--broadcast-dim": "rgba(245,169,127,0.15)", "--success": "#a6da95",
    "--shadow-sm": "0 1px 3px rgba(0,0,0,0.5),0 1px 2px rgba(0,0,0,0.4)",
    "--shadow-md": "0 4px 12px rgba(0,0,0,0.6),0 2px 4px rgba(0,0,0,0.5)",
    "--separator": "rgba(255,255,255,0.08)", "--separator-strong": "rgba(255,255,255,0.14)",
  },
  xterm: {
    background: "#24273a", foreground: "#cad3f5",
    cursor: "#8aadf4", cursorAccent: "#24273a",
    selectionBackground: "rgba(138,173,244,0.3)", selectionInactiveBackground: "rgba(255,255,255,0.1)",
    black: "#494d64", red: "#ed8796", green: "#a6da95", yellow: "#eed49f",
    blue: "#8aadf4", magenta: "#c6a0f6", cyan: "#8bd5ca", white: "#b8c0e0",
    brightBlack: "#5b6078", brightRed: "#ed8796", brightGreen: "#a6da95", brightYellow: "#eed49f",
    brightBlue: "#8aadf4", brightMagenta: "#c6a0f6", brightCyan: "#8bd5ca", brightWhite: "#a5adcb",
  },
};

export const catppuccinMocha: ThemeDefinition = {
  id: "catppuccin-mocha", name: "Mocha", isDark: true,
  swatch: ["#1e1e2e", "#f38ba8", "#a6e3a1", "#89b4fa", "#cba6f7"],
  cssVars: {
    "--bg-primary": "#1e1e2e", "--bg-secondary": "#181825", "--bg-tertiary": "#313244",
    "--bg-elevated": "#11111b", "--bg-terminal": "#1e1e2e", "--bg-panel-border": "#45475a",
    "--bg-titlebar": "rgba(17,17,27,0.92)", "--bg-topbar": "rgba(24,24,37,0.92)",
    "--label-primary": "#cdd6f4", "--label-secondary": "rgba(205,214,244,0.65)",
    "--label-tertiary": "rgba(205,214,244,0.35)", "--label-disabled": "rgba(205,214,244,0.2)",
    "--accent": "#89b4fa", "--accent-hover": "#a0c5fb", "--accent-pressed": "#6a9de8",
    "--destructive": "#f38ba8", "--warning": "#f9e2af",
    "--broadcast": "#fab387", "--broadcast-dim": "rgba(250,179,135,0.15)", "--success": "#a6e3a1",
    "--shadow-sm": "0 1px 3px rgba(0,0,0,0.5),0 1px 2px rgba(0,0,0,0.4)",
    "--shadow-md": "0 4px 12px rgba(0,0,0,0.6),0 2px 4px rgba(0,0,0,0.5)",
    "--separator": "rgba(255,255,255,0.08)", "--separator-strong": "rgba(255,255,255,0.14)",
  },
  xterm: {
    background: "#1e1e2e", foreground: "#cdd6f4",
    cursor: "#89b4fa", cursorAccent: "#1e1e2e",
    selectionBackground: "rgba(137,180,250,0.3)", selectionInactiveBackground: "rgba(255,255,255,0.1)",
    black: "#45475a", red: "#f38ba8", green: "#a6e3a1", yellow: "#f9e2af",
    blue: "#89b4fa", magenta: "#cba6f7", cyan: "#89dceb", white: "#bac2de",
    brightBlack: "#585b70", brightRed: "#f38ba8", brightGreen: "#a6e3a1", brightYellow: "#f9e2af",
    brightBlue: "#89b4fa", brightMagenta: "#cba6f7", brightCyan: "#89dceb", brightWhite: "#a6adc8",
  },
};

// ─────────────────────────────────────────────────────────────────
// Solarized
// ─────────────────────────────────────────────────────────────────

export const solarizedLight: ThemeDefinition = {
  id: "solarized-light", name: "Light", isDark: false,
  swatch: ["#fdf6e3", "#dc322f", "#859900", "#268bd2", "#d33682"],
  cssVars: {
    "--bg-primary": "#fdf6e3", "--bg-secondary": "#eee8d5", "--bg-tertiary": "#e0dac8",
    "--bg-elevated": "#fffef8", "--bg-terminal": "#fdf6e3", "--bg-panel-border": "#d3cdb8",
    "--bg-titlebar": "rgba(238,232,213,0.9)", "--bg-topbar": "rgba(253,246,227,0.92)",
    "--label-primary": "rgba(101,123,131,0.92)", "--label-secondary": "rgba(101,123,131,0.65)",
    "--label-tertiary": "rgba(101,123,131,0.38)", "--label-disabled": "rgba(101,123,131,0.22)",
    "--accent": "#268bd2", "--accent-hover": "#3a9fe0", "--accent-pressed": "#1a79bf",
    "--destructive": "#dc322f", "--warning": "#b58900",
    "--broadcast": "#cb4b16", "--broadcast-dim": "rgba(203,75,22,0.12)", "--success": "#859900",
    "--shadow-sm": "0 1px 3px rgba(0,0,0,0.12),0 1px 2px rgba(0,0,0,0.08)",
    "--shadow-md": "0 4px 12px rgba(0,0,0,0.15),0 2px 4px rgba(0,0,0,0.10)",
    "--separator": "rgba(101,123,131,0.12)", "--separator-strong": "rgba(101,123,131,0.20)",
  },
  xterm: {
    background: "#fdf6e3", foreground: "#657b83",
    cursor: "#268bd2", cursorAccent: "#fdf6e3",
    selectionBackground: "rgba(38,139,210,0.2)", selectionInactiveBackground: "rgba(0,0,0,0.1)",
    black: "#073642", red: "#dc322f", green: "#859900", yellow: "#b58900",
    blue: "#268bd2", magenta: "#d33682", cyan: "#2aa198", white: "#eee8d5",
    brightBlack: "#002b36", brightRed: "#cb4b16", brightGreen: "#586e75", brightYellow: "#657b83",
    brightBlue: "#839496", brightMagenta: "#6c71c4", brightCyan: "#93a1a1", brightWhite: "#fdf6e3",
  },
};

export const solarizedDark: ThemeDefinition = {
  id: "solarized-dark", name: "Dark", isDark: true,
  swatch: ["#002b36", "#dc322f", "#859900", "#268bd2", "#d33682"],
  cssVars: {
    "--bg-primary": "#002b36", "--bg-secondary": "#073642", "--bg-tertiary": "#0d4555",
    "--bg-elevated": "#001e27", "--bg-terminal": "#002b36", "--bg-panel-border": "#094553",
    "--bg-titlebar": "rgba(0,30,39,0.92)", "--bg-topbar": "rgba(0,43,54,0.92)",
    "--label-primary": "#93a1a1", "--label-secondary": "rgba(147,161,161,0.70)",
    "--label-tertiary": "rgba(147,161,161,0.42)", "--label-disabled": "rgba(147,161,161,0.25)",
    "--accent": "#268bd2", "--accent-hover": "#3a9fe0", "--accent-pressed": "#1a79bf",
    "--destructive": "#dc322f", "--warning": "#b58900",
    "--broadcast": "#cb4b16", "--broadcast-dim": "rgba(203,75,22,0.15)", "--success": "#859900",
    "--shadow-sm": "0 1px 3px rgba(0,0,0,0.5),0 1px 2px rgba(0,0,0,0.4)",
    "--shadow-md": "0 4px 12px rgba(0,0,0,0.6),0 2px 4px rgba(0,0,0,0.5)",
    "--separator": "rgba(255,255,255,0.07)", "--separator-strong": "rgba(255,255,255,0.12)",
  },
  xterm: {
    background: "#002b36", foreground: "#839496",
    cursor: "#268bd2", cursorAccent: "#002b36",
    selectionBackground: "rgba(38,139,210,0.3)", selectionInactiveBackground: "rgba(255,255,255,0.1)",
    black: "#073642", red: "#dc322f", green: "#859900", yellow: "#b58900",
    blue: "#268bd2", magenta: "#d33682", cyan: "#2aa198", white: "#eee8d5",
    brightBlack: "#002b36", brightRed: "#cb4b16", brightGreen: "#586e75", brightYellow: "#657b83",
    brightBlue: "#839496", brightMagenta: "#6c71c4", brightCyan: "#93a1a1", brightWhite: "#fdf6e3",
  },
};

export const solarizedOsaka: ThemeDefinition = {
  id: "solarized-osaka", name: "Osaka", isDark: true,
  swatch: ["#011a25", "#f7768e", "#73daca", "#7aa2f7", "#bb9af7"],
  cssVars: {
    "--bg-primary": "#011a25", "--bg-secondary": "#02243a", "--bg-tertiary": "#0a3550",
    "--bg-elevated": "#000f18", "--bg-terminal": "#011a25", "--bg-panel-border": "#0e3f5e",
    "--bg-titlebar": "rgba(0,15,24,0.92)", "--bg-topbar": "rgba(1,26,37,0.92)",
    "--label-primary": "#cdd6f4", "--label-secondary": "rgba(205,214,244,0.65)",
    "--label-tertiary": "rgba(205,214,244,0.35)", "--label-disabled": "rgba(205,214,244,0.2)",
    "--accent": "#7aa2f7", "--accent-hover": "#8fb3f8", "--accent-pressed": "#5f87e6",
    "--destructive": "#f7768e", "--warning": "#e0af68",
    "--broadcast": "#ff9e64", "--broadcast-dim": "rgba(255,158,100,0.15)", "--success": "#73daca",
    "--shadow-sm": "0 1px 3px rgba(0,0,0,0.6),0 1px 2px rgba(0,0,0,0.5)",
    "--shadow-md": "0 4px 12px rgba(0,0,0,0.7),0 2px 4px rgba(0,0,0,0.6)",
    "--separator": "rgba(255,255,255,0.07)", "--separator-strong": "rgba(255,255,255,0.13)",
  },
  xterm: {
    background: "#011a25", foreground: "#cdd6f4",
    cursor: "#7aa2f7", cursorAccent: "#011a25",
    selectionBackground: "rgba(122,162,247,0.3)", selectionInactiveBackground: "rgba(255,255,255,0.08)",
    black: "#1d3045", red: "#f7768e", green: "#73daca", yellow: "#e0af68",
    blue: "#7aa2f7", magenta: "#bb9af7", cyan: "#7dcfff", white: "#a9b1d6",
    brightBlack: "#2a4a6e", brightRed: "#f7768e", brightGreen: "#73daca", brightYellow: "#e0af68",
    brightBlue: "#7aa2f7", brightMagenta: "#bb9af7", brightCyan: "#7dcfff", brightWhite: "#c0caf5",
  },
};

// ─────────────────────────────────────────────────────────────────
// Registry
// ─────────────────────────────────────────────────────────────────

export const THEMES: Record<string, ThemeDefinition> = {
  dark, light,
  dracula, monokai, "tokyo-night": tokyoNight, "one-dark": oneDark, ayu, nord,
  "catppuccin-latte": catppuccinLatte, "catppuccin-frappe": catppuccinFrappe,
  "catppuccin-macchiato": catppuccinMacchiato, "catppuccin-mocha": catppuccinMocha,
  "solarized-light": solarizedLight, "solarized-dark": solarizedDark, "solarized-osaka": solarizedOsaka,
};

export const THEME_GROUPS: ThemeGroup[] = [
  { label: "Apple",      themes: [dark, light] },
  { label: "Popular",    themes: [dracula, monokai, tokyoNight, oneDark, ayu, nord] },
  { label: "Catppuccin", themes: [catppuccinLatte, catppuccinFrappe, catppuccinMacchiato, catppuccinMocha] },
  { label: "Solarized",  themes: [solarizedLight, solarizedDark, solarizedOsaka] },
];
