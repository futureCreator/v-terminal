import { useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "./NotePanel.css";

const STORAGE_KEY = "v-terminal:note-content";

interface NotePanelProps {
  onClose: () => void;
}

function getCheckboxLines(content: string): number[] {
  return content.split("\n").reduce<number[]>((acc, line, idx) => {
    if (/^\s*[-*+]\s+\[[ x]\]/i.test(line)) acc.push(idx);
    return acc;
  }, []);
}

export function NotePanel({ onClose }: NotePanelProps) {
  const [content, setContent] = useState(() =>
    localStorage.getItem(STORAGE_KEY) ?? ""
  );
  const [mode, setMode] = useState<"edit" | "preview">("edit");

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      setContent(value);
      localStorage.setItem(STORAGE_KEY, value);
    },
    []
  );

  const toggleCheckbox = useCallback(
    (lineIdx: number, isChecked: boolean) => {
      setContent((prev) => {
        const lines = prev.split("\n");
        if (isChecked) {
          lines[lineIdx] = lines[lineIdx].replace(
            /^(\s*[-*+]\s+)\[x\]/i,
            "$1[ ]"
          );
        } else {
          lines[lineIdx] = lines[lineIdx].replace(
            /^(\s*[-*+]\s+)\[ \]/,
            "$1[x]"
          );
        }
        const next = lines.join("\n");
        localStorage.setItem(STORAGE_KEY, next);
        return next;
      });
    },
    []
  );

  const checkboxLines = getCheckboxLines(content);
  let checkboxCounter = 0;

  return (
    <div className="note-panel">
      <div className="note-panel-header">
        <span className="note-panel-title">Notes</span>
        <div className="note-panel-header-actions">
          <button
            className={`note-panel-mode-btn${mode === "edit" ? " active" : ""}`}
            onClick={() => setMode("edit")}
            aria-label="편집 모드"
            title="편집"
          >
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <path
                d="M7.8 1.2l2 2-5.5 5.5H2.3V6.7l5.5-5.5z"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <button
            className={`note-panel-mode-btn${mode === "preview" ? " active" : ""}`}
            onClick={() => setMode("preview")}
            aria-label="미리보기 모드"
            title="미리보기"
          >
            <svg width="13" height="9" viewBox="0 0 13 9" fill="none">
              <path
                d="M1 4.5c0 0 2.2-3.5 5.5-3.5S12 4.5 12 4.5s-2.2 3.5-5.5 3.5S1 4.5 1 4.5z"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
              <circle cx="6.5" cy="4.5" r="1.5" stroke="currentColor" strokeWidth="1.2" />
            </svg>
          </button>
          <div className="note-panel-header-sep" />
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
      </div>

      {mode === "edit" ? (
        <textarea
          className="note-panel-textarea"
          value={content}
          placeholder={`메모를 입력하세요...\n\n마크다운을 지원합니다.\n- [ ] 할 일 목록도 가능해요`}
          onChange={handleChange}
          spellCheck={false}
        />
      ) : (
        <div className="note-panel-preview">
          {content.trim() ? (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                input: ({ checked, ...props }) => {
                  if (props.type === "checkbox") {
                    const idx = checkboxCounter++;
                    const lineIdx = checkboxLines[idx];
                    return (
                      <input
                        type="checkbox"
                        checked={checked ?? false}
                        onChange={() =>
                          toggleCheckbox(lineIdx, checked ?? false)
                        }
                        className="note-checkbox"
                      />
                    );
                  }
                  return <input checked={checked} {...props} />;
                },
              }}
            >
              {content}
            </ReactMarkdown>
          ) : (
            <span className="note-preview-empty">미리볼 내용이 없습니다.</span>
          )}
        </div>
      )}
    </div>
  );
}
