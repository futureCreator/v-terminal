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
      "Press Ctrl+K to access tabs, layouts, clipboard history, cheatsheets, and more. No mouse needed.",
    shortcutKeys: ["Ctrl", "K"],
  },
  {
    id: "productivity",
    headline: "Stay focused, stay in flow",
    description:
      "Notes, Pomodoro timers, and cheatsheets live in your sidebar. No app switching needed.",
    shortcutKeys: ["Ctrl", "Shift", "N"],
  },
];
