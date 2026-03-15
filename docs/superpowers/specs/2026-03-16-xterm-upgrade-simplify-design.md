# xterm.js 6.0.0 Upgrade & Scroll/IME Code Simplification

## Problem

TerminalPane.tsx has accumulated ~170 lines of workaround code across 8 commits to fix scroll position preservation and Korean IME input issues. These workarounds address bugs in xterm.js 5.5.0 at the application level, but the fundamental problems remain unresolved — particularly in TUI apps (alternate buffer mode).

VS Code's terminal uses the same xterm.js library but has **zero** custom scroll tracking and **zero** custom IME handling. Investigation reveals:

1. **xterm.js 6.0.0** includes internal fixes for the exact problems we're working around (textarea resync on compositionstart for TUI, scrollbar teleport fix on buffer transitions, duplicate IME input fix).
2. **FitAddon.fit()** triggers DOM measurements that can desync scroll position, but xterm.js 6.0.0's viewport overhaul addresses this.

## Solution

Upgrade xterm.js to 6.0.0 and delete all application-level workaround code, delegating scroll and IME handling entirely to xterm.js internals.

## Package Upgrades

| Package | Current | Target |
|---------|---------|--------|
| `@xterm/xterm` | `^5` | `^6.0.0` |
| `@xterm/addon-fit` | `^0.10` | `^0.11.0` |
| `@xterm/addon-web-links` | `^0.11` | `^0.12.0` |
| `@xterm/addon-unicode11` | `^0.8` | **Remove** (unused — never imported in source) |

## Breaking Change

- Remove `fastScrollModifier: "alt"` from Terminal constructor (option removed in 6.0.0).

## Code to Delete

### IME workarounds (all removed)

- `isComposing` flag and all references
- `compositionTimeout` and 10-second safety net
- `writeBuffer` / `flushWriteBuffer` (write buffering)
- `compositionstart` / `compositionend` event listeners
- `blur` event listener's IME cleanup code
- `customKeyEventHandler` stuck-state recovery and `isComposing` guard
- `onBufferChange` listener's IME reset logic
- PTY data handler's `isComposing` branching (simplify to direct `term.write(data)`)

### Scroll workarounds (all removed)

- `savedNormalViewportY` / `lastNormalViewportY` / `lastNormalIsAtBottom` variables
- `scrollDisposable` (`term.onScroll()` listener)
- `writeDisposable` (`term.onWriteParsed()` listener)
- `onBufferChange` listener (entire listener removed — scroll restore + IME reset both gone)
- ResizeObserver double-restore pattern (immediate + requestAnimationFrame)
- 3 duplicate useEffect hooks (fontSize/fontFamily/lineHeight) with scroll save/restore

### Cleanup variables removed

- `disposeBufferChange`
- `scrollDisposable`
- `writeDisposable`
- `compositionTimeout`

## Code to Keep

### customKeyEventHandler

Keep clipboard handling (Ctrl+C copy, Ctrl+V paste), reserved keys (Ctrl+K, Ctrl+±0). Remove all IME-related logic.

### ResizeObserver

Keep debounced `fitAddon.fit()` + `ipc.daemonResize()`. Remove alternate buffer check and scroll restoration.

### Config change useEffects

Consolidate 3 duplicate useEffect hooks (fontSize, fontFamily, lineHeight) into 1 unified effect that applies the changed option, calls `fit()`, and sends `daemonResize()`.

## Final Structure

```
Before (~617 lines):
├── isComposing + savedNormalViewportY + writeBuffer + flush
├── onBufferChange (IME reset + scroll restore + rAF)
├── customKeyEventHandler (stuck recovery + IME guard + clipboard + reserved keys)
├── compositionstart/end/blur listeners (3)
├── PTY data handler (isComposing branch + buffering)
├── onScroll + onWriteParsed listeners (continuous tracking)
├── ResizeObserver (debounce + alternate check + double-restore)
├── useEffect fontSize (scroll save/restore)
├── useEffect fontFamily (scroll save/restore)
└── useEffect lineHeight (scroll save/restore)

After (~460 lines):
├── customKeyEventHandler (clipboard + reserved keys only)
├── focus listener (onFocus callback)
├── PTY data handler (direct term.write)
├── ResizeObserver (debounce + fit + daemonResize)
├── useEffect font/lineHeight unified (option set + fit + daemonResize)
├── useEffect cursorStyle (kept as-is)
├── useEffect cursorBlink (kept as-is)
└── useEffect scrollback (kept as-is)
```

~160 lines removed, complexity significantly reduced.

## Testing Plan

1. Normal buffer: type Korean text, verify no character drops or duplicates
2. TUI app (vim/nano): type Korean text in insert mode, verify correct input
3. Resize terminal while in normal buffer: verify scroll position preserved
4. Resize terminal while in TUI app: verify TUI redraws correctly
5. Switch between normal and alternate buffer (enter/exit vim): verify scroll position
6. Change font size/family/line height: verify terminal re-fits without scroll jump
7. Rapid terminal output during Korean input: verify no IME interruption
8. Verify `ITheme` type compatibility (used in xtermTheme.ts and definitions.ts)
