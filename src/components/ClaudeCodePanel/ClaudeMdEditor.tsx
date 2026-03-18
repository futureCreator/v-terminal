import { useEffect, useRef, useCallback } from "react";
import { EditorState, Compartment } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { baseMarkdownExtensions, buildFontSizeTheme } from "../../lib/codemirrorSetup";
import { useTerminalConfigStore } from "../../store/terminalConfigStore";
import { useClaudeCodeStore } from "../../store/claudeCodeStore";

interface ClaudeMdEditorProps {
  path: string;
  content: string;
  readonly: boolean;
}

export function ClaudeMdEditor({ path, content, readonly }: ClaudeMdEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const fontSizeCompartment = useRef(new Compartment());
  const readonlyCompartment = useRef(new Compartment());
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentRef = useRef(content);

  const saveFile = useClaudeCodeStore((s) => s.saveFile);
  const terminalFontSize = useTerminalConfigStore((s) => s.fontSize);

  const debouncedSave = useCallback(
    (newContent: string) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        saveFile(path, newContent).catch(() => {});
      }, 500);
    },
    [path, saveFile]
  );

  useEffect(() => {
    if (!containerRef.current) return;

    const initialFontSize = useTerminalConfigStore.getState().fontSize;
    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        const doc = update.state.doc.toString();
        contentRef.current = doc;
        debouncedSave(doc);
      }
    });

    const state = EditorState.create({
      doc: content,
      extensions: [
        ...baseMarkdownExtensions({
          fontSizeCompartment: fontSizeCompartment.current,
          initialFontSize,
          placeholderText: "CLAUDE.md content...",
        }),
        readonlyCompartment.current.of(EditorView.editable.of(!readonly)),
        updateListener,
      ],
    });

    const view = new EditorView({ state, parent: containerRef.current });
    viewRef.current = view;

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: fontSizeCompartment.current.reconfigure(buildFontSizeTheme(terminalFontSize)),
    });
  }, [terminalFontSize]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    if (content !== contentRef.current) {
      contentRef.current = content;
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: content },
      });
    }
  }, [content]);

  return <div ref={containerRef} className="note-cm-container" />;
}
