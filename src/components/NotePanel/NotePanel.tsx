import { NoteEditor } from "./NoteEditor";
import "./NotePanel.css";

interface NotePanelProps {
  panelId: string;
}

export function NotePanel({ panelId }: NotePanelProps) {
  return (
    <div className="note-panel note-panel--embedded">
      <NoteEditor panelId={panelId} />
    </div>
  );
}
