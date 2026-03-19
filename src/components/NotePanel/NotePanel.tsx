import { NoteEditor } from "./NoteEditor";
import "./NotePanel.css";

interface NotePanelProps {
  panelId: string;
  isActive?: boolean;
  onFocus?: () => void;
}

export function NotePanel({ panelId, isActive, onFocus }: NotePanelProps) {
  return (
    <div
      className={`note-panel note-panel--embedded${isActive ? " note-panel--active" : ""}`}
      onFocus={onFocus}
      onMouseDown={onFocus}
    >
      <NoteEditor panelId={panelId} />
    </div>
  );
}
