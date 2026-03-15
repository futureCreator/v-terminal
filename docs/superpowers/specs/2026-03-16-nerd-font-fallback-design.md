# Nerd Font Fallback Design

## Problem

When a user selects a non-Nerd font (e.g., Fira Code, Source Code Pro), Nerd Font icons used by CLI tools like `lsd`, oh-my-posh, and powerlevel10k render as broken/missing glyphs.

The current fallback chain references `"JetBrains Mono"` which does not match the `@font-face` name `"JetBrainsMonoNerdFont"` declared in `globals.css`, so the Nerd Font glyphs are never resolved.

## Solution

Replace `"JetBrains Mono"` with `"JetBrainsMonoNerdFont"` in the font fallback chain across all 3 locations.

### Fallback Chain

**Before:** `"<selected font>", "JetBrains Mono", "Nanum Gothic Coding", monospace`

**After:** `"<selected font>", "JetBrainsMonoNerdFont", "Nanum Gothic Coding", monospace`

### Files to Modify

| File | Line | Context |
|------|------|---------|
| `src/components/TerminalPane/TerminalPane.tsx` | ~118 | Terminal creation `fontFamily` option |
| `src/components/TerminalPane/TerminalPane.tsx` | ~300 | Dynamic font update `term.options.fontFamily` |
| `src/components/SettingsModal/SettingsModal.tsx` | ~205 | Font preview `<code>` inline style |

### Why This Works

- v-terminal uses xterm.js 6.0.0's **DOM renderer** (no WebGL/Canvas addon), which supports CSS font fallback natively
- `JetBrainsMonoNerdFont` is already bundled (99 TTF files in `public/fonts/`) and loaded via `@font-face` in `globals.css`
- `fontLoader.ts` already preloads `JetBrainsMonoNerdFont` — no changes needed there
- When the primary font lacks a Nerd Font glyph, the browser automatically falls back to `JetBrainsMonoNerdFont`

### No Changes Needed

- `src/lib/fontLoader.ts` — already preloads `JetBrainsMonoNerdFont`
- `src/styles/globals.css` — `@font-face` already correctly defined
- `src/store/terminalConfigStore.ts` — no font chain stored here
