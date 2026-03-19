import { useEffect, useRef } from "react";
import { EditorState, Compartment } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { baseMarkdownExtensions, buildFontSizeTheme } from "../../lib/codemirrorSetup";
import { useNoteStore } from "../../store/noteStore";
import { useTerminalConfigStore } from "../../store/terminalConfigStore";

interface NoteEditorProps {
  panelId: string;
}

export function NoteEditor({ panelId }: NoteEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const panelIdRef = useRef(panelId);
  const suppressRef = useRef(false);
  const fontSizeCompartment = useRef(new Compartment());

  const setMarkdown = useNoteStore((s) => s.setMarkdown);
  const terminalFontSize = useTerminalConfigStore((s) => s.fontSize);

  useEffect(() => {
    if (!containerRef.current) return;

    const content = useNoteStore.getState().notes[panelId] ?? "";
    const initialFontSize = useTerminalConfigStore.getState().fontSize;

    const updateListener = EditorView.updateListener.of((update) => {
      if (suppressRef.current) return;
      if (update.docChanged) {
        const doc = update.state.doc.toString();
        setMarkdown(panelIdRef.current, doc);
      }
    });

    const state = EditorState.create({
      doc: content,
      extensions: [
        ...baseMarkdownExtensions({
          fontSizeCompartment: fontSizeCompartment.current,
          initialFontSize,
          placeholderText: "Type your note here...",
        }),
        updateListener,
      ],
    });

    const view = new EditorView({ state, parent: containerRef.current });
    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: fontSizeCompartment.current.reconfigure(
        buildFontSizeTheme(terminalFontSize)
      ),
    });
  }, [terminalFontSize]);

  useEffect(() => {
    panelIdRef.current = panelId;
    const view = viewRef.current;
    if (!view) return;

    const newContent = useNoteStore.getState().notes[panelId] ?? "";
    const currentContent = view.state.doc.toString();

    if (newContent !== currentContent) {
      suppressRef.current = true;
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: newContent },
      });
      suppressRef.current = false;
    }
  }, [panelId]);

  return <div ref={containerRef} className="note-cm-container" />;
}
