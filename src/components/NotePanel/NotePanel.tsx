import { useEffect } from "react";
import { NoteEditor } from "./NoteEditor";
import { TodoSection } from "./TodoSection";
import { useNoteStore } from "../../store/noteStore";
import "./NotePanel.css";

interface NotePanelProps {
  tabId: string;
  onClose: () => void;
}

export function NotePanel({ tabId, onClose }: NotePanelProps) {
  // Migrate legacy global note on first mount
  useEffect(() => {
    useNoteStore.getState().migrateOldNote(tabId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="note-panel">
      <div className="note-panel-header">
        <span className="note-panel-title">Notes</span>
        <button
          className="note-panel-close"
          onClick={onClose}
          aria-label="Close notes"
          title="노트 닫기"
        >
          <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
            <path
              d="M1.5 1.5l6 6M7.5 1.5l-6 6"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
      <div className="note-panel-body">
        <NoteEditor tabId={tabId} />
        <TodoSection tabId={tabId} />
      </div>
    </div>
  );
}
