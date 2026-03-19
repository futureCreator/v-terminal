import { useNoteStore } from "../store/noteStore";
import type { Panel } from "../types/terminal";

/**
 * Remove note data for panels that have a "note" connection type.
 */
export function cleanupNotePanels(panels: Panel[]): void {
  const notePanelIds = panels
    .filter((p) => p.connection?.type === "note")
    .map((p) => p.id);
  if (notePanelIds.length > 0) {
    useNoteStore.getState().removeNotes(notePanelIds);
  }
}

/**
 * Remove note data for a single panel.
 */
export function cleanupNotePanel(panelId: string): void {
  useNoteStore.getState().removeNote(panelId);
}
