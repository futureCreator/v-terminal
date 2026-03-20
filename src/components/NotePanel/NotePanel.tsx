import { NoteEditor } from "./NoteEditor";
import { useNoteConfigStore } from "../../store/noteConfigStore";
import "./NotePanel.css";

interface NotePanelProps {
  panelId: string;
  isActive?: boolean;
  onFocus?: () => void;
}

export function NotePanel({ panelId, isActive, onFocus }: NotePanelProps) {
  const bgStyle = useNoteConfigStore((s) => s.backgroundStyle);

  const bgClass = bgStyle !== "none" ? ` note-panel--bg-${bgStyle}` : "";

  return (
    <div
      className={`note-panel note-panel--embedded${isActive ? " note-panel--active" : ""}${bgClass}`}
      onFocus={onFocus}
      onMouseDown={onFocus}
    >
      <NoteEditor panelId={panelId} />
    </div>
  );
}
