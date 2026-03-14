import { Crepe } from "@milkdown/crepe";
import { Milkdown, MilkdownProvider, useEditor } from "@milkdown/react";
import "@milkdown/crepe/theme/common/style.css";
import "./NotePanel.css";

const STORAGE_KEY = "v-terminal:note-content";

interface NotePanelProps {
  onClose: () => void;
}

function NoteEditor() {
  useEditor((root) => {
    const crepe = new Crepe({
      root,
      defaultValue: localStorage.getItem(STORAGE_KEY) ?? "",
      features: {
        [Crepe.Feature.BlockEdit]: false,
        [Crepe.Feature.ImageBlock]: false,
        [Crepe.Feature.Latex]: false,
      },
      featureConfigs: {
        [Crepe.Feature.Placeholder]: {
          text: "메모를 입력하세요...",
          mode: "block",
        },
      },
    });

    crepe.on((listener) => {
      listener.markdownUpdated((_ctx, markdown) => {
        localStorage.setItem(STORAGE_KEY, markdown);
      });
    });

    return crepe;
  });

  return <Milkdown />;
}

export function NotePanel({ onClose }: NotePanelProps) {
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
      <div className="note-editor">
        <MilkdownProvider>
          <NoteEditor />
        </MilkdownProvider>
      </div>
    </div>
  );
}
