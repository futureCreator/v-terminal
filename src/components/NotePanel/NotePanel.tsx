import { NoteEditor } from "./NoteEditor";
import "./NotePanel.css";

interface NotePanelProps {
  panelId: string;
}

export function NotePanel({ panelId }: NotePanelProps) {
  return (
    <div className="note-panel note-panel--embedded">
      <div className="note-panel-header">
        <span className="note-panel-title">Note</span>
      </div>
      <div className="note-panel-body">
        <NoteEditor panelId={panelId} />
      </div>
    </div>
  );
}
