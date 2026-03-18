import { useEffect, useRef } from "react";
import { EditorState, Compartment } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { baseMarkdownExtensions, buildFontSizeTheme } from "../../lib/codemirrorSetup";
import { useNoteStore } from "../../store/noteStore";
import { useTerminalConfigStore } from "../../store/terminalConfigStore";

interface NoteEditorProps {
  tabId: string;
}

export function NoteEditor({ tabId }: NoteEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const tabIdRef = useRef(tabId);
  const suppressRef = useRef(false);
  const fontSizeCompartment = useRef(new Compartment());

  const setMarkdown = useNoteStore((s) => s.setMarkdown);
  const terminalFontSize = useTerminalConfigStore((s) => s.fontSize);

  // Create editor once on mount
  useEffect(() => {
    if (!containerRef.current) return;

    const content =
      useNoteStore.getState().notes[tabId]?.markdown ?? "";

    const initialFontSize = useTerminalConfigStore.getState().fontSize;

    const updateListener = EditorView.updateListener.of((update) => {
      if (suppressRef.current) return;
      if (update.docChanged) {
        const doc = update.state.doc.toString();
        setMarkdown(tabIdRef.current, doc);
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

  // Sync font size with terminal config
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: fontSizeCompartment.current.reconfigure(
        buildFontSizeTheme(terminalFontSize)
      ),
    });
  }, [terminalFontSize]);

  // Swap content when tabId changes
  useEffect(() => {
    tabIdRef.current = tabId;
    const view = viewRef.current;
    if (!view) return;

    const newContent =
      useNoteStore.getState().notes[tabId]?.markdown ?? "";
    const currentContent = view.state.doc.toString();

    if (newContent !== currentContent) {
      suppressRef.current = true;
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: newContent },
      });
      suppressRef.current = false;
    }
  }, [tabId]);

  return <div ref={containerRef} className="note-cm-container" />;
}
