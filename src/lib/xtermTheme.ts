import type { ITheme } from "@xterm/xterm";

export const XTERM_DARK_THEME: ITheme = {
  background: "#1c1c1e",
  foreground: "rgba(255,255,255,0.85)",
  cursor: "#0a84ff",
  cursorAccent: "#1c1c1e",
  selectionBackground: "rgba(10,132,255,0.3)",
  selectionForeground: undefined,
  selectionInactiveBackground: "rgba(255,255,255,0.1)",
  // Standard ANSI colors
  black: "#1c1c1e",
  red: "#ff453a",
  green: "#30d158",
  yellow: "#ffd60a",
  blue: "#0a84ff",
  magenta: "#bf5af2",
  cyan: "#5ac8f5",
  white: "rgba(255,255,255,0.85)",
  // Bright variants
  brightBlack: "#636366",
  brightRed: "#ff6961",
  brightGreen: "#34c759",
  brightYellow: "#ffd60a",
  brightBlue: "#409cff",
  brightMagenta: "#da8fff",
  brightCyan: "#70d7ff",
  brightWhite: "#ffffff",
};

export const XTERM_LIGHT_THEME: ITheme = {
  background: "#f9f9f9",
  foreground: "rgba(0,0,0,0.85)",
  cursor: "#007aff",
  cursorAccent: "#f9f9f9",
  selectionBackground: "rgba(0,122,255,0.25)",
  selectionForeground: undefined,
  selectionInactiveBackground: "rgba(0,0,0,0.1)",
  // Standard ANSI colors
  black: "#1c1c1e",
  red: "#c41a16",
  green: "#007c15",
  yellow: "#946a00",
  blue: "#0431fa",
  magenta: "#9a2eae",
  cyan: "#1b7ea0",
  white: "rgba(0,0,0,0.75)",
  // Bright variants
  brightBlack: "#6c6c70",
  brightRed: "#ff3b30",
  brightGreen: "#34c759",
  brightYellow: "#ff9500",
  brightBlue: "#007aff",
  brightMagenta: "#bf5af2",
  brightCyan: "#5ac8f5",
  brightWhite: "#1c1c1e",
};
