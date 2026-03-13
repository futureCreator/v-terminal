import { useEffect, useRef } from "react";
import "./NotePanel.css";

const STORAGE_KEY = "v-terminal:note-content";

interface NotePanelProps {
  onClose: () => void;
}

export function NotePanel({ onClose }: NotePanelProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) ?? "";
    if (textareaRef.current) {
      textareaRef.current.value = saved;
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    localStorage.setItem(STORAGE_KEY, e.target.value);
  };

  return (
    <div className="note-panel">
      <div className="note-panel-header">
        <span className="note-panel-title">Notes</span>
        <button
          className="note-panel-close"
          onClick={onClose}
          aria-label="Close notes"
          title="Close notes"
        >
          <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
            <path d="M1.5 1.5l6 6M7.5 1.5l-6 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <textarea
        ref={textareaRef}
        className="note-panel-textarea"
        placeholder="메모를 입력하세요..."
        onChange={handleChange}
        spellCheck={false}
      />
    </div>
  );
}
