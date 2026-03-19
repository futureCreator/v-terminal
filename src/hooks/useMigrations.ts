import { useEffect } from "react";

/**
 * One-time data migrations that run on app startup.
 * Each migration is idempotent and guarded by a localStorage flag.
 */
export function useMigrations(): void {
  // Migrate old per-tab notes+todos to new unified format
  useEffect(() => {
    const MIGRATION_KEY = "v-terminal:migration-note-panel-done";
    if (localStorage.getItem(MIGRATION_KEY)) return;

    const oldNotesRaw = localStorage.getItem("v-terminal:tab-notes");
    if (oldNotesRaw) {
      try {
        const oldNotes = JSON.parse(oldNotesRaw) as Record<string, { markdown: string; todos: Array<{ id: string; text: string; completed: boolean }> }>;
        const allTodos: Array<{ id: string; text: string; completed: boolean }> = [];
        const seenTexts = new Set<string>();

        for (const tabNote of Object.values(oldNotes)) {
          if (tabNote.todos) {
            for (const todo of tabNote.todos) {
              const key = todo.text.trim().toLowerCase();
              if (!seenTexts.has(key)) {
                seenTexts.add(key);
                allTodos.push(todo);
              }
            }
          }
        }

        if (allTodos.length > 0) {
          const existingRaw = localStorage.getItem("v-terminal:todos");
          const existing = existingRaw ? JSON.parse(existingRaw) as Array<{ id: string; text: string; completed: boolean }> : [];
          localStorage.setItem("v-terminal:todos", JSON.stringify([...existing, ...allTodos]));
        }

        localStorage.removeItem("v-terminal:tab-notes");
      } catch { /* corrupted data — skip */ }
    }

    localStorage.removeItem("v-terminal:note-content");
    localStorage.setItem(MIGRATION_KEY, "true");
  }, []);

  // Convert stale browser panel connections to local
  useEffect(() => {
    const MIGRATION_KEY = "v-terminal:migration-browser-panel-done";
    if (localStorage.getItem(MIGRATION_KEY)) return;

    const wsRaw = localStorage.getItem("v-terminal:workspace");
    if (wsRaw) {
      try {
        const ws = JSON.parse(wsRaw);
        let changed = false;
        if (ws.tabs && Array.isArray(ws.tabs)) {
          for (const tab of ws.tabs) {
            if (tab.panels && Array.isArray(tab.panels)) {
              for (const panel of tab.panels) {
                if (panel.connection?.type === "browser") {
                  panel.connection = { type: "local" };
                  panel.sessionId = null;
                  changed = true;
                }
              }
            }
          }
        }
        if (changed) {
          localStorage.setItem("v-terminal:workspace", JSON.stringify(ws));
        }
      } catch { /* corrupted data — skip */ }
    }

    localStorage.setItem(MIGRATION_KEY, "true");
  }, []);
}
