export interface SlideData {
  id: string;
  headlineKey: string;
  descriptionKey: string;
  shortcutKeys: string[];
}

export const slides: SlideData[] = [
  {
    id: "command-palette",
    headlineKey: "welcome.slide1Title",
    descriptionKey: "welcome.slide1Desc",
    shortcutKeys: ["Ctrl", "K"],
  },
  {
    id: "flexible-layout",
    headlineKey: "welcome.slide2Title",
    descriptionKey: "welcome.slide2Desc",
    shortcutKeys: [],
  },
  {
    id: "productivity",
    headlineKey: "welcome.slide3Title",
    descriptionKey: "welcome.slide3Desc",
    shortcutKeys: ["Ctrl", "Shift", "N"],
  },
  {
    id: "browser",
    headlineKey: "welcome.slide4Title",
    descriptionKey: "welcome.slide4Desc",
    shortcutKeys: ["Ctrl", "Shift", "B"],
  },
];
