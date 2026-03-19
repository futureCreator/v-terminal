import { useEffect, useRef } from "react";

interface ShortcutActions {
  togglePalette: () => void;
  newTab: () => void;
  toggleSidebar: () => void;
  toggleBrowserPanel: () => void;
  fontIncrease: () => void;
  fontDecrease: () => void;
  fontReset: () => void;
}

/**
 * Registers global keyboard shortcuts that intercept before xterm.
 * Shortcuts are disabled while the welcome overlay is active.
 */
export function useGlobalKeyboardShortcuts(
  actions: ShortcutActions,
  disabled: boolean,
): void {
  const disabledRef = useRef(disabled);
  useEffect(() => { disabledRef.current = disabled; }, [disabled]);

  const actionsRef = useRef(actions);
  useEffect(() => { actionsRef.current = actions; }, [actions]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (disabledRef.current) return;
      const a = actionsRef.current;

      if (e.ctrlKey && e.key === "k") {
        e.preventDefault();
        e.stopPropagation();
        a.togglePalette();
      }
      if (e.ctrlKey && e.shiftKey && e.key === "T") {
        e.preventDefault();
        e.stopPropagation();
        a.newTab();
      }
      if (e.ctrlKey && e.shiftKey && e.key === "N") {
        e.preventDefault();
        e.stopPropagation();
        a.toggleSidebar();
      }
      if (e.ctrlKey && e.shiftKey && e.key === "B") {
        e.preventDefault();
        e.stopPropagation();
        a.toggleBrowserPanel();
      }
      if (e.ctrlKey && !e.shiftKey && (e.key === "=" || e.key === "+")) {
        e.preventDefault();
        e.stopPropagation();
        a.fontIncrease();
      }
      if (e.ctrlKey && !e.shiftKey && e.key === "-") {
        e.preventDefault();
        e.stopPropagation();
        a.fontDecrease();
      }
      if (e.ctrlKey && !e.shiftKey && e.key === "0") {
        e.preventDefault();
        e.stopPropagation();
        a.fontReset();
      }
    };
    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, []);
}
