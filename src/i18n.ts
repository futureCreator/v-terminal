import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import ko from "./locales/ko.json";

const LOCALE_KEY = "v-terminal:locale";

function detectLocale(): string {
  const saved = localStorage.getItem(LOCALE_KEY);
  if (saved === "en" || saved === "ko") return saved;

  const nav = navigator.language.toLowerCase();
  if (nav.startsWith("ko")) return "ko";
  return "en";
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ko: { translation: ko },
  },
  lng: detectLocale(),
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

export function changeLanguage(lng: string) {
  i18n.changeLanguage(lng);
  localStorage.setItem(LOCALE_KEY, lng);
}

export default i18n;
