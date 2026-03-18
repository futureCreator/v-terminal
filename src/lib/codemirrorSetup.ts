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
import type { Extension } from "@codemirror/state";
import { Compartment } from "@codemirror/state";

/** CSS-variable-driven highlight style for markdown tokens */
export const mdHighlight = HighlightStyle.define([
  { tag: tags.heading1, fontWeight: "700", fontSize: "1.25em" },
  { tag: tags.heading2, fontWeight: "700", fontSize: "1.12em" },
  { tag: tags.heading3, fontWeight: "600", fontSize: "1.05em" },
  { tag: [tags.heading4, tags.heading5, tags.heading6], fontWeight: "600" },
  { tag: tags.strong, fontWeight: "600" },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: tags.strikethrough, textDecoration: "line-through", opacity: "0.6" },
  { tag: tags.monospace, fontFamily: '"JetBrains Mono", "JetBrainsMonoNerdFont", monospace' },
  { tag: tags.url, textDecoration: "underline" },
  { tag: tags.link, textDecoration: "underline" },
  { tag: [tags.processingInstruction, tags.contentSeparator], opacity: "0.4" },
  { tag: tags.quote, fontStyle: "italic", opacity: "0.8" },
]);

/** CodeMirror theme that reads from CSS custom properties */
export const cmTheme = EditorView.theme({
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
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--accent)" },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
    background: "color-mix(in srgb, var(--accent), transparent 75%) !important",
  },
  ".cm-activeLine": { backgroundColor: "transparent" },
  ".cm-gutters": { display: "none" },
  ".cm-placeholder": {
    color: "var(--label-disabled)",
    fontFamily: '"Pretendard", sans-serif',
    fontStyle: "normal",
  },
  "&.cm-focused": { outline: "none" },
});

/** Font-size theme (reconfigured dynamically via Compartment) */
export function buildFontSizeTheme(fontSize: number) {
  return EditorView.theme({ "&": { fontSize: `${fontSize}px` } });
}

/** Build the base set of extensions for a markdown editor */
export function baseMarkdownExtensions(opts: {
  fontSizeCompartment: Compartment;
  initialFontSize: number;
  placeholderText?: string;
}): Extension[] {
  return [
    cmTheme,
    opts.fontSizeCompartment.of(buildFontSizeTheme(opts.initialFontSize)),
    markdown({ base: markdownLanguage, codeLanguages: languages }),
    syntaxHighlighting(mdHighlight),
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    placeholder(opts.placeholderText ?? ""),
    keymap.of([...defaultKeymap, indentWithTab]),
    EditorView.lineWrapping,
  ];
}
