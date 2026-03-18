import React, { useEffect, useRef } from "react";
import { EditorView } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import {
  Decoration,
  DecorationSet,
  ViewPlugin,
  ViewUpdate,
} from "@codemirror/view";
import { cmTheme } from "../../lib/codemirrorSetup";
import { useGitStore } from "../../store/gitStore";
import "./DiffViewer.css";

// Build diff line decorations
function buildDiffDecorations(doc: string): DecorationSet {
  const builder: Array<{ from: number; deco: Decoration }> = [];
  let pos = 0;

  for (const line of doc.split("\n")) {
    const lineEnd = pos + line.length;

    if (line.startsWith("+") && !line.startsWith("+++")) {
      builder.push({
        from: pos,
        deco: Decoration.line({ class: "diff-line-added" }),
      });
    } else if (line.startsWith("-") && !line.startsWith("---")) {
      builder.push({
        from: pos,
        deco: Decoration.line({ class: "diff-line-deleted" }),
      });
    } else if (line.startsWith("@@")) {
      builder.push({
        from: pos,
        deco: Decoration.line({ class: "diff-line-hunk" }),
      });
    }

    pos = lineEnd + 1; // +1 for newline
  }

  return Decoration.set(
    builder.map((b) => b.deco.range(b.from)),
    true
  );
}

const diffDecoPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = buildDiffDecorations(view.state.doc.toString());
    }
    update(update: ViewUpdate) {
      if (update.docChanged) {
        this.decorations = buildDiffDecorations(update.state.doc.toString());
      }
    }
  },
  { decorations: (v) => v.decorations }
);

export const DiffViewer: React.FC = () => {
  const { selectedFile, diffContent, clearSelection } = useGitStore();
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  // Handle ESC key
  useEffect(() => {
    if (!selectedFile) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        clearSelection();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [selectedFile, clearSelection]);

  // Create/update CodeMirror editor
  useEffect(() => {
    if (!editorRef.current || !diffContent) {
      viewRef.current?.destroy();
      viewRef.current = null;
      return;
    }

    const isBinary =
      diffContent.includes("Binary files") && diffContent.includes("differ");

    if (isBinary) {
      return;
    }

    const state = EditorState.create({
      doc: diffContent,
      extensions: [
        EditorView.editable.of(false),
        EditorState.readOnly.of(true),
        cmTheme,
        diffDecoPlugin,
        EditorView.lineWrapping,
      ],
    });

    viewRef.current?.destroy();
    viewRef.current = new EditorView({
      state,
      parent: editorRef.current,
    });

    return () => {
      viewRef.current?.destroy();
      viewRef.current = null;
    };
  }, [diffContent]);

  if (!selectedFile) return null;

  const isBinary =
    diffContent?.includes("Binary files") && diffContent?.includes("differ");
  const isEmpty = diffContent !== null && diffContent.trim() === "";
  const stageLabel = selectedFile.staged ? "staged" : "unstaged";

  return (
    <div className="diff-overlay" onClick={(e) => {
      if (e.target === e.currentTarget) clearSelection();
    }}>
      <div className="diff-viewer">
        <div className="diff-viewer__header">
          <span className="diff-viewer__filename">
            {selectedFile.path}
            <span className="diff-viewer__stage-label">{stageLabel}</span>
          </span>
          <button className="diff-viewer__close" onClick={clearSelection}>
            ✕
          </button>
        </div>
        <div className="diff-viewer__content">
          {diffContent === null && (
            <div className="diff-viewer__loading">Loading diff...</div>
          )}
          {isBinary && (
            <div className="diff-viewer__message">
              Binary file — diff not available
            </div>
          )}
          {isEmpty && (
            <div className="diff-viewer__message">No changes</div>
          )}
          {!isBinary && !isEmpty && <div ref={editorRef} className="diff-viewer__editor" />}
        </div>
      </div>
    </div>
  );
};
