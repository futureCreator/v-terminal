export interface SlideData {
  id: string;
  headline: string;
  description: string;
  shortcutKeys: string[];
}

export const slides: SlideData[] = [
  {
    id: "command-palette",
    headline: "Everything at your fingertips",
    description:
      "Press Ctrl+K to access tabs, layouts, clipboard history, and more. No mouse needed.",
    shortcutKeys: ["Ctrl", "K"],
  },
  {
    id: "flexible-layout",
    headline: "Your workspace, your way",
    description:
      "Switch between single to 9-panel layouts instantly. Each panel connects independently to Local, SSH, or WSL — mix them freely in one view.",
    shortcutKeys: [],
  },
  {
    id: "productivity",
    headline: "Stay focused, stay in flow",
    description:
      "Notes and Pomodoro timers live in your sidebar. No app switching needed.",
    shortcutKeys: ["Ctrl", "Shift", "N"],
  },
  {
    id: "browser",
    headline: "Browse without leaving",
    description:
      "Open a built-in browser panel right next to your terminal. Look up docs, check dashboards, or preview your work — all without breaking your flow.",
    shortcutKeys: ["Ctrl", "Shift", "B"],
  },
];
