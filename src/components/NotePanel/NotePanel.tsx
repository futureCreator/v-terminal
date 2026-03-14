import { useEditor, EditorContent } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import { TaskList } from "@tiptap/extension-task-list";
import { TaskItem } from "@tiptap/extension-task-item";
import { Placeholder } from "@tiptap/extension-placeholder";
import { Markdown } from "tiptap-markdown";
import "./NotePanel.css";

const STORAGE_KEY = "v-terminal:note-content";

interface NotePanelProps {
  onClose: () => void;
}

export function NotePanel({ onClose }: NotePanelProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({
        placeholder: "메모를 입력하세요...\n\n# 제목\n**굵게**, *기울임*\n- [ ] 할 일 목록",
      }),
      Markdown.configure({
        html: false,
        transformPastedText: true,
      }),
    ],
    content: localStorage.getItem(STORAGE_KEY) ?? "",
    onUpdate: ({ editor }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const markdown = (editor.storage as any).markdown.getMarkdown();
      localStorage.setItem(STORAGE_KEY, markdown);
    },
  });

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
      <EditorContent editor={editor} className="note-editor" />
    </div>
  );
}
