# Alternate Buffer Awareness: Scroll & IME Fix

**Date:** 2026-03-16
**Status:** Approved
**Scope:** `src/components/TerminalPane/TerminalPane.tsx`

## Problem

Two intermittent bugs occur when using TUI apps (primarily claude-code) in v-terminal:

1. **Scroll jumps to top of scrollback history** — Triggered by terminal resize, panel splits, side panel toggles, or during TUI output. The scrollbar may also show "bottom" while the rendered viewport is desynced from the TUI's content.

2. **Korean (IME) input character drops** — After prolonged TUI use, some characters are lost during Korean composition input. The issue persists in the same pane even after exiting the TUI. Other panes are unaffected; opening a new tab fixes it.

## Root Cause

Both issues share a common root cause: **the terminal has no awareness of xterm.js's alternate screen buffer**.

### Scroll

The `ResizeObserver` callback captures `buffer.active.viewportY` and restores it after `fitAddon.fit()`. In alternate buffer mode:

- `viewportY` is always 0 and `buffer.length ≈ term.rows`
- `fitAddon.fit()` triggers internal reflow of the normal buffer, potentially resetting its viewport to 0
- `scrollToBottom()` or `scrollToLine()` is called on the alternate buffer, conflicting with the TUI app's SIGWINCH-based redraw
- The normal buffer's scroll position is lost because it was never independently tracked

### IME

Claude-code's rapid streaming output causes frequent `term.write()` calls. xterm.js re-renders its internal hidden textarea during writes, which can interrupt browser IME composition mid-sequence. When `compositionend` is missed or fired abnormally, the local `isComposing` flag becomes stuck at `true`, causing subsequent keydown events to be blocked. This corruption accumulates over time and persists in the xterm.js instance.

## Design

### Part 1: Scroll — Alternate Buffer Aware Restoration

#### 1a. Alternate buffer detection in ResizeObserver

```
ResizeObserver fires:
  if (term.buffer.active.type === 'alternate'):
    → fitAddon.fit()
    → daemonResize()
    → NO scroll restoration (TUI handles its own redraw via SIGWINCH)
  else (normal buffer):
    → existing logic: capture viewportY → fit → restore
```

#### 1b. Normal buffer viewport tracking

Add `savedNormalViewportY` as a **closure variable inside `init()`** (same scope as `isComposing`), tied to the lifetime of the Terminal instance. NOT a React ref — React refs survive component re-renders and would hold stale values across reinitializations.

Updated on:
- Every resize when in normal buffer mode (before fit)
- On buffer change event: use `term.buffer.normal.viewportY` (NOT `term.buffer.active.viewportY`, which already points to the new buffer at callback time)

#### 1c. Buffer change scroll restoration

```
term.buffer.onBufferChange:
  if switching to normal buffer (alternate → normal):
    → clamp: Math.min(savedNormalViewportY, Math.max(0, term.buffer.normal.length - term.rows))
    → restore via scrollToLine()
    → follow up with requestAnimationFrame restoration
```

The clamp is necessary because after a resize the normal buffer's `length` may have changed due to reflow, making the saved position out of range.

#### 1d. Font/lineHeight useEffects

Apply the same alternate buffer check to all three scroll-restoring useEffects:
- fontSize (lines 336-364)
- fontFamily (lines 367-395)
- lineHeight (lines 398-426)

When in alternate buffer: apply the option change and call `fitAddon.fit()` + `daemonResize()`, but skip scroll capture/restore.

**Implementation note:** Consider extracting a shared `fitWithScrollPreservation(term, fitAddon, ptyId)` helper to reduce the four instances of duplicated scroll-preservation logic.

### Part 2: IME — Composition State Corruption Recovery

#### 2a. Buffer change IME reset

```
term.buffer.onBufferChange:
  → isComposing = false (force reset)
  → clear composition timeout if active
```

Rationale: Any in-progress composition is invalid after a buffer switch.

#### 2b. Stuck state detection in custom key handler

```
attachCustomKeyEventHandler((e) => {
  if (e.type !== "keydown") return true;

  // Stuck state recovery: local flag says composing, browser says not
  if (isComposing && !e.isComposing) {
    isComposing = false;
  }

  if (e.isComposing || isComposing) return false;
  // ... rest of handler
});
```

This provides immediate self-healing: even if the state gets corrupted, the very next keydown auto-recovers. The recovery check is placed BEFORE the `isComposing` guard — placing it after would mean it never executes for the stuck case.

#### 2c. Composition timeout (safety net)

```
compositionstart:
  → isComposing = true
  → start 10-second timeout → force isComposing = false

compositionend:
  → clear timeout
  → requestAnimationFrame(() => { isComposing = false })

blur:
  → isComposing = false
  → clear composition timeout (for consistency with onBufferChange)
```

Normal Korean input completes within seconds. A 10-second timeout is a conservative safety net for cases where compositionend is never fired.

### Part 3: Resource Cleanup

All new resources must be disposed in the cleanup function (lines 309-324):

- **`onBufferChange` listener**: `term.buffer.onBufferChange` returns an `IDisposable`. Store and call `.dispose()` in cleanup, alongside `unlistenData` and `unlistenExit`.
- **Composition timeout**: Clear the pending `setTimeout` in cleanup to prevent firing against a disposed terminal.

### Registration Order

The `onBufferChange` listener should be registered **after** scrollback replay (line 162-163: `term.write(new Uint8Array(scrollback))`). If scrollback data contains escape sequences that switch to alternate buffer, the listener would fire during initialization before `savedNormalViewportY` has a meaningful value. Registering after replay ensures the normal buffer's state is established first.

### Notes

- **Rapid buffer switching**: Some TUI apps or escape sequence glitches may rapidly toggle buffers. The design is safe because all operations are idempotent — restoring scroll position and resetting `isComposing` are harmless when called multiple times.
- **Nested TUI apps**: Workflows like tmux → vim share the same alternate buffer. The binary check (`type === 'alternate'`) handles this correctly.

## Change Summary

| Location | Change | Purpose |
|----------|--------|---------|
| `init()` | Add `term.buffer.onBufferChange` listener (after scrollback replay) | Buffer switch detection |
| `init()` | Add `savedNormalViewportY` closure variable | Normal buffer scroll preservation |
| `init()` cleanup | Dispose `onBufferChange` listener + clear composition timeout | Prevent memory leaks |
| ResizeObserver | Check `buffer.active.type === 'alternate'` → skip scroll restore | Fix scroll jump |
| `onBufferChange` | Restore clamped `savedNormalViewportY` on alternate→normal | Preserve scroll after TUI exit |
| font/lineHeight useEffects (×3) | Same alternate buffer check | Fix scroll jump on config change |
| Custom key handler | Add `isComposing && !e.isComposing` recovery | IME auto-recovery |
| `compositionstart` | Add 10s timeout | IME safety net |
| `compositionend` | Clear timeout | - |
| `blur` | Also clear composition timeout | Consistency |
| `onBufferChange` | Force `isComposing = false`, clear timeout | IME reset on buffer switch |

## Files Modified

- `src/components/TerminalPane/TerminalPane.tsx` — all changes in this single file

## Testing

- **Scroll**: Run claude-code → resize terminal window → verify no scroll jump. Open/close side panel → verify no jump. Exit claude-code → verify scrollback position is preserved at the line where it was before entering the TUI.
- **Scroll desync**: Run claude-code → resize → verify scrollbar position matches rendered content.
- **Scroll clamp**: Scroll up in normal buffer → run a TUI that produces output → exit TUI → verify scroll position is reasonable (not beyond buffer length).
- **IME basic**: Run claude-code → type Korean text repeatedly over several minutes → verify no character drops. Exit claude-code → verify Korean input works in shell prompt.
- **IME recovery**: If character drops occur, verify next keystroke auto-recovers (stuck state detection).
- **IME timeout**: Simulate stuck composition (interrupt mid-composition by switching focus) → verify input recovers within 10 seconds.
- **Session reattach**: Detach and reattach to a session that was in a TUI → verify no scroll jump or IME issues.
- **Cleanup**: Open multiple tabs → close them → verify no memory leaks or console errors from stale listeners.
