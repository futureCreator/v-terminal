import { useEffect, useRef } from "react";
import { EditorState, Compartment } from "@codemirror/state";
import { EditorView, placeholder, keymap } from "@codemirror/view";
import { defaultKeymap, indentWithTab } from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import {
  syntaxHighlighting,
  HighlightStyle,
  defaultHighlightStyle,
} from "@codemirror/language";
import { tags } from "@lezer/highlight";
import { useNoteStore } from "../../store/noteStore";
import { useTerminalConfigStore } from "../../store/terminalConfigStore";

/** CSS-variable–driven highlight style for markdown tokens */
const mdHighlight = HighlightStyle.define([
  { tag: tags.heading1, fontWeight: "700", fontSize: "1.25em" },
  { tag: tags.heading2, fontWeight: "700", fontSize: "1.12em" },
  { tag: tags.heading3, fontWeight: "600", fontSize: "1.05em" },
  {
    tag: [tags.heading4, tags.heading5, tags.heading6],
    fontWeight: "600",
  },
  { tag: tags.strong, fontWeight: "600" },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: tags.strikethrough, textDecoration: "line-through", opacity: "0.6" },
  {
    tag: tags.monospace,
    fontFamily: '"JetBrains Mono", "JetBrainsMonoNerdFont", monospace',
  },
  { tag: tags.url, textDecoration: "underline" },
  { tag: tags.link, textDecoration: "underline" },
  {
    tag: [tags.processingInstruction, tags.contentSeparator],
    opacity: "0.4",
  },
  { tag: tags.quote, fontStyle: "italic", opacity: "0.8" },
]);

/** Font-size theme (reconfigured dynamically via Compartment) */
function buildFontSizeTheme(fontSize: number) {
  return EditorView.theme({
    "&": { fontSize: `${fontSize}px` },
  });
}

/** CodeMirror theme that reads from CSS custom properties */
const cmTheme = EditorView.theme({
  "&": {
    flex: "1",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    fontFamily: '"Pretendard", sans-serif',
    backgroundColor: "transparent",
  },
  ".cm-scroller": {
    flex: "1",
    overflow: "auto",
    scrollbarWidth: "thin",
    scrollbarColor: "var(--bg-tertiary) transparent",
  },
  ".cm-scroller::-webkit-scrollbar": { width: "4px" },
  ".cm-scroller::-webkit-scrollbar-track": { background: "transparent" },
  ".cm-scroller::-webkit-scrollbar-thumb": {
    background: "var(--bg-tertiary)",
    borderRadius: "2px",
  },
  ".cm-content": {
    padding: "10px 14px 20px",
    lineHeight: "1.65",
    caretColor: "var(--accent)",
    color: "var(--label-primary)",
    minHeight: "100%",
    fontFamily: '"Pretendard", sans-serif',
  },
  ".cm-cursor, .cm-dropCursor": {
    borderLeftColor: "var(--accent)",
  },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
    background: "color-mix(in srgb, var(--accent), transparent 75%) !important",
  },
  ".cm-activeLine": {
    backgroundColor: "transparent",
  },
  ".cm-gutters": {
    display: "none",
  },
  ".cm-placeholder": {
    color: "var(--label-disabled)",
    fontFamily: '"Pretendard", sans-serif',
    fontStyle: "normal",
  },
  "&.cm-focused": {
    outline: "none",
  },
});

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
        cmTheme,
        fontSizeCompartment.current.of(buildFontSizeTheme(initialFontSize)),
        markdown({ base: markdownLanguage, codeLanguages: languages }),
        syntaxHighlighting(mdHighlight),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        placeholder("Type your note here..."),
        keymap.of([...defaultKeymap, indentWithTab]),
        EditorView.lineWrapping,
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
