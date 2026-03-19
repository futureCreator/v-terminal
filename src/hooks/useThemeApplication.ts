import { useEffect } from "react";
import { resolveThemeDefinition } from "../store/themeStore";
import { terminalRegistry } from "../components/TerminalPane/TerminalPane";

/**
 * Applies theme CSS variables to the document root and updates all open terminals.
 * Listens for system color scheme changes when theme is set to "auto".
 */
export function useThemeApplication(themeId: string): void {
  useEffect(() => {
    const applyTheme = () => {
      const def = resolveThemeDefinition(themeId);
      const el = document.documentElement;
      Object.entries(def.cssVars).forEach(([key, val]) => el.style.setProperty(key, val));
      for (const term of terminalRegistry.values()) {
        term.options.theme = def.xterm;
      }
    };

    applyTheme();

    if (themeId === "auto") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      mq.addEventListener("change", applyTheme);
      return () => mq.removeEventListener("change", applyTheme);
    }
  }, [themeId]);
}
