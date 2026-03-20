# Alternate Buffer Scroll & IME Fix — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix scroll jumps and Korean IME character drops during TUI app usage by adding alternate screen buffer awareness to TerminalPane.

**Architecture:** All changes are in the `init()` closure and three `useEffect` hooks inside `TerminalPane.tsx`. New closure variables (`savedNormalViewportY`, `compositionTimeout`) and a `term.buffer.onBufferChange` listener provide the infrastructure. The ResizeObserver and config-change useEffects are updated to skip scroll restoration when in alternate buffer mode. The IME handling gains stuck-state detection, composition timeout, and buffer-switch reset.

**Tech Stack:** React 18, xterm.js v5 (`@xterm/xterm`), TypeScript

**Spec:** `docs/superpowers/specs/2026-03-16-alternate-buffer-scroll-ime-fix-design.md`

**Testing:** Manual only — no automated test harness exists in this project, and xterm.js requires a canvas-enabled browser environment. All testing is done on Windows by running TUI apps (claude-code) in the terminal.

---

## File Structure

All changes in a single file:

- **Modify:** `src/components/TerminalPane/TerminalPane.tsx`
  - `init()` closure (lines 113-305): Add variables, onBufferChange listener, IME enhancements
  - Cleanup function (lines 309-324): Dispose new resources
  - fontSize useEffect (lines 336-364): Add alternate buffer check
  - fontFamily useEffect (lines 367-395): Add alternate buffer check
  - lineHeight useEffect (lines 398-426): Add alternate buffer check

---

## Task 1: Add closure variables and onBufferChange listener

**Files:**
- Modify: `src/components/TerminalPane/TerminalPane.tsx:187-188` (after `isComposing` declaration)
- Modify: `src/components/TerminalPane/TerminalPane.tsx:164` (after scrollback replay)

This task adds the infrastructure that all subsequent tasks depend on.

**Note:** All line numbers in this plan refer to the original source file. Each task inserts code, so line numbers shift by ~25-30 lines after Task 1. Use the surrounding code context (provided in code blocks) to locate insertion points rather than relying on exact line numbers.

- [ ] **Step 1: Add useEffect-level variables alongside `disposed`/`unlistenData`/`unlistenExit` (line 109-111)**

These must be at the useEffect level (NOT inside `init()`) so the cleanup function can access them:

```typescript
    let disposed = false;
    let unlistenData: (() => void) | null = null;
    let unlistenExit: (() => void) | null = null;
    let disposeBufferChange: { dispose(): void } | null = null;
    let compositionTimeout: ReturnType<typeof setTimeout> | null = null;
```

- [ ] **Step 2: Add init()-scoped variables after `isComposing` (line 188)**

After the existing `let isComposing = false;` line, add the normal buffer viewport tracker. This is a closure variable inside `init()` because it is tied to the Terminal instance lifetime:

```typescript
      // IME composition state — prevents custom key handler from interfering with Korean/CJK input
      let isComposing = false;

      // Normal buffer scroll position — tracked independently so it survives alternate buffer sessions
      let savedNormalViewportY = term.buffer.normal.viewportY;
```

- [ ] **Step 3: Add onBufferChange listener after the try-catch block (after line 169, before `if (disposed)` at line 171)**

Insert the `onBufferChange` listener between the end of the try-catch block and the `if (disposed)` check. This must be after `term.write(new Uint8Array(scrollback))` so the normal buffer state is established.

Context — insert after `} catch (e) { ... return; }` and before `if (disposed) {`:

```typescript
      // Buffer change listener — handles scroll restoration and IME reset on alternate ↔ normal transitions
      disposeBufferChange = term.buffer.onBufferChange((newBuffer) => {
        if (disposed) return;

        // IME reset: any in-progress composition is invalid after a buffer switch
        isComposing = false;
        if (compositionTimeout) {
          clearTimeout(compositionTimeout);
          compositionTimeout = null;
        }

        // Scroll restoration: when returning to normal buffer, restore saved viewport position
        if (newBuffer.type === "normal") {
          const maxScroll = Math.max(0, term.buffer.normal.length - term.rows);
          const clamped = Math.min(savedNormalViewportY, maxScroll);
          term.scrollToLine(clamped);
          requestAnimationFrame(() => {
            if (!disposed) {
              const maxScroll = Math.max(0, term.buffer.normal.length - term.rows);
              const clamped = Math.min(savedNormalViewportY, maxScroll);
              term.scrollToLine(clamped);
            }
          });
        } else {
          // Switching TO alternate buffer — snapshot normal buffer position before it's hidden
          savedNormalViewportY = term.buffer.normal.viewportY;
        }
      });
```

- [ ] **Step 4: Commit**

```bash
git add src/components/TerminalPane/TerminalPane.tsx
git commit -m "feat: add onBufferChange listener and closure variables for alternate buffer awareness"
```

---

## Task 2: Update ResizeObserver to be alternate-buffer-aware

**Files:**
- Modify: `src/components/TerminalPane/TerminalPane.tsx:266-304` (ResizeObserver callback)

- [ ] **Step 1: Replace the ResizeObserver callback**

Replace lines 271-300 (the inner ResizeObserver callback body) with alternate-buffer-aware logic:

```typescript
      const observer = new ResizeObserver(() => {
          if (disposed || !fitAddonRef.current || !termRef.current) return;

          const isAlternate = term.buffer.active.type === "alternate";

          // In normal buffer: capture viewport position at the first event in each debounce window,
          // before xterm has a chance to internally reset it during reflow
          if (!resizeTimeout && !isAlternate) {
            const buffer = term.buffer.active;
            savedViewportY = buffer.viewportY;
            savedIsAtBottom = savedViewportY >= buffer.length - term.rows;
            // Also update the persistent normal buffer tracker
            savedNormalViewportY = buffer.viewportY;
          }

          if (resizeTimeout) clearTimeout(resizeTimeout);
          resizeTimeout = setTimeout(() => {
            resizeTimeout = null;
            if (disposed || !fitAddonRef.current || !termRef.current) return;
            try {
              fitAddon.fit();

              // Only restore scroll position in normal buffer mode.
              // In alternate buffer, TUI apps handle their own redraw via SIGWINCH.
              if (!isAlternate) {
                const restore = () => {
                  if (savedIsAtBottom) {
                    term.scrollToBottom();
                  } else {
                    term.scrollToLine(savedViewportY);
                  }
                };
                restore();
                requestAnimationFrame(restore);
              }

              ipc.daemonResize(ptyId, term.cols, term.rows).catch(() => {});
            } catch {}
          }, 50);
        });
```

Note: `isAlternate` is captured at the START of the ResizeObserver callback (outside the debounce timeout) so it reflects the state at the time of the resize event, not 50ms later.

- [ ] **Step 2: Commit**

```bash
git add src/components/TerminalPane/TerminalPane.tsx
git commit -m "fix: skip scroll restoration in alternate buffer during resize"
```

---

## Task 3: Update font/lineHeight useEffects to be alternate-buffer-aware

**Files:**
- Modify: `src/components/TerminalPane/TerminalPane.tsx:336-364` (fontSize useEffect)
- Modify: `src/components/TerminalPane/TerminalPane.tsx:367-395` (fontFamily useEffect)
- Modify: `src/components/TerminalPane/TerminalPane.tsx:398-426` (lineHeight useEffect)

All three follow the same pattern: add an alternate buffer check to skip scroll capture/restore.

- [ ] **Step 1: Update fontSize useEffect (lines 336-364)**

Replace the try block body:

```typescript
  useEffect(() => {
    const term = termRef.current;
    const fitAddon = fitAddonRef.current;
    if (!term || !fitAddon) return;

    term.options.fontSize = fontSize;
    try {
      const isAlternate = term.buffer.active.type === "alternate";

      if (!isAlternate) {
        const buffer = term.buffer.active;
        const savedViewportY = buffer.viewportY;
        const isAtBottom = savedViewportY >= buffer.length - term.rows;

        fitAddon.fit();

        const restore = () => {
          if (isAtBottom) {
            term.scrollToBottom();
          } else {
            term.scrollToLine(savedViewportY);
          }
        };
        restore();
        requestAnimationFrame(restore);
      } else {
        fitAddon.fit();
      }

      const ptyId = ptyIdRef.current;
      if (ptyId) {
        ipc.daemonResize(ptyId, term.cols, term.rows).catch(() => {});
      }
    } catch {}
  }, [fontSize]);
```

- [ ] **Step 2: Update fontFamily useEffect (lines 367-395)**

Same pattern — replace the try block body:

```typescript
  useEffect(() => {
    const term = termRef.current;
    const fitAddon = fitAddonRef.current;
    if (!term || !fitAddon) return;

    term.options.fontFamily = `"${fontFamily}", "JetBrains Mono", "Nanum Gothic Coding", monospace`;
    try {
      const isAlternate = term.buffer.active.type === "alternate";

      if (!isAlternate) {
        const buffer = term.buffer.active;
        const savedViewportY = buffer.viewportY;
        const isAtBottom = savedViewportY >= buffer.length - term.rows;

        fitAddon.fit();

        const restore = () => {
          if (isAtBottom) {
            term.scrollToBottom();
          } else {
            term.scrollToLine(savedViewportY);
          }
        };
        restore();
        requestAnimationFrame(restore);
      } else {
        fitAddon.fit();
      }

      const ptyId = ptyIdRef.current;
      if (ptyId) {
        ipc.daemonResize(ptyId, term.cols, term.rows).catch(() => {});
      }
    } catch {}
  }, [fontFamily]);
```

- [ ] **Step 3: Update lineHeight useEffect (lines 398-426)**

Same pattern:

```typescript
  useEffect(() => {
    const term = termRef.current;
    const fitAddon = fitAddonRef.current;
    if (!term || !fitAddon) return;

    term.options.lineHeight = lineHeight;
    try {
      const isAlternate = term.buffer.active.type === "alternate";

      if (!isAlternate) {
        const buffer = term.buffer.active;
        const savedViewportY = buffer.viewportY;
        const isAtBottom = savedViewportY >= buffer.length - term.rows;

        fitAddon.fit();

        const restore = () => {
          if (isAtBottom) {
            term.scrollToBottom();
          } else {
            term.scrollToLine(savedViewportY);
          }
        };
        restore();
        requestAnimationFrame(restore);
      } else {
        fitAddon.fit();
      }

      const ptyId = ptyIdRef.current;
      if (ptyId) {
        ipc.daemonResize(ptyId, term.cols, term.rows).catch(() => {});
      }
    } catch {}
  }, [lineHeight]);
```

- [ ] **Step 4: Commit**

```bash
git add src/components/TerminalPane/TerminalPane.tsx
git commit -m "fix: skip scroll restoration in alternate buffer for font/lineHeight changes"
```

---

## Task 4: Enhance IME handling with stuck-state recovery and composition timeout

**Files:**
- Modify: `src/components/TerminalPane/TerminalPane.tsx:191-252` (custom key handler + composition event listeners)

- [ ] **Step 1: Add stuck-state recovery to custom key handler**

In the `attachCustomKeyEventHandler` callback, add stuck-state detection BEFORE the existing `isComposing` guard (between line 193 and line 199):

```typescript
      term.attachCustomKeyEventHandler((e) => {
        if (e.type !== "keydown") return true;

        // Stuck state recovery: if our local flag says composing but the browser
        // says otherwise, trust the browser and reset. This self-heals corruption
        // caused by missed compositionend events during rapid terminal output.
        if (isComposing && !e.isComposing) {
          isComposing = false;
          if (compositionTimeout) {
            clearTimeout(compositionTimeout);
            compositionTimeout = null;
          }
        }

        if (e.isComposing || isComposing) return false;
        // ... rest of handler unchanged
```

- [ ] **Step 2: Add composition timeout to compositionstart/compositionend/blur handlers**

Replace the composition event listeners (lines 243-252):

```typescript
      term.textarea?.addEventListener("focus", () => onFocus());
      term.textarea?.addEventListener("blur", () => {
        isComposing = false;
        if (compositionTimeout) {
          clearTimeout(compositionTimeout);
          compositionTimeout = null;
        }
      });
      term.textarea?.addEventListener("compositionstart", () => {
        isComposing = true;
        // Safety net: if compositionend never fires (e.g. interrupted by rapid terminal output),
        // force-clear after 10 seconds. Normal Korean input completes within seconds.
        if (compositionTimeout) clearTimeout(compositionTimeout);
        compositionTimeout = setTimeout(() => {
          compositionTimeout = null;
          isComposing = false;
        }, 10_000);
      });
      term.textarea?.addEventListener("compositionend", () => {
        if (compositionTimeout) {
          clearTimeout(compositionTimeout);
          compositionTimeout = null;
        }
        // Delay clearing the flag so that the keydown event fired in the same
        // tick right after compositionend is still blocked by the custom key
        // handler.  Without this, the final keystroke (e.g. Enter/Space that
        // commits the composed text) can leak through and send a duplicate
        // character — especially on Windows IME.
        requestAnimationFrame(() => { isComposing = false; });
      });
```

- [ ] **Step 3: Commit**

```bash
git add src/components/TerminalPane/TerminalPane.tsx
git commit -m "fix: add IME stuck-state recovery and composition timeout safety net"
```

---

## Task 5: Add resource cleanup

**Files:**
- Modify: `src/components/TerminalPane/TerminalPane.tsx:309-324` (cleanup function)

- [ ] **Step 1: Update the cleanup function to dispose new resources**

In the cleanup return function, add disposal of the `onBufferChange` listener and the composition timeout:

```typescript
    return () => {
      disposed = true;
      unlistenData?.();
      unlistenExit?.();
      disposeBufferChange?.dispose();
      disposeBufferChange = null;
      if (compositionTimeout) {
        clearTimeout(compositionTimeout);
        compositionTimeout = null;
      }
      observerRef.current?.disconnect();
      observerRef.current = null;
      const ptyId = ptyIdRef.current;
      if (ptyId) {
        terminalRegistry.delete(ptyId);
        ipc.daemonDetach(ptyId).catch(() => {}); // detach but don't kill — session persists in daemon
        ptyIdRef.current = null;
      }
      termRef.current?.dispose();
      termRef.current = null;
      fitAddonRef.current = null;
    };
```

Note: `compositionTimeout` is a closure variable inside `init()`, so it's accessible here. `disposeBufferChange` is declared at the top of the `init` effect alongside `unlistenData`/`unlistenExit`.

- [ ] **Step 2: Verify build passes**

```bash
cd /Users/handongho/.openclaw/workspace/projects/v-terminal && npm run build
```

Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/TerminalPane/TerminalPane.tsx
git commit -m "fix: dispose onBufferChange listener and composition timeout on cleanup"
```

---

## Task 6: Manual testing on Windows

All testing is manual since xterm.js requires a canvas-enabled browser environment.

- [ ] **Step 1: Build the app**

```bash
cd /Users/handongho/.openclaw/workspace/projects/v-terminal && npm run tauri build
```

- [ ] **Step 2: Test scroll — resize during TUI**

1. Open v-terminal
2. Run `claude` (or another TUI app like `vim`)
3. Resize the terminal window by dragging edges
4. Verify: no scroll jump to top, no scrollbar/viewport desync

- [ ] **Step 3: Test scroll — side panel toggle**

1. While TUI is running, open/close the side panel (notes, timer)
2. Verify: no scroll jump

- [ ] **Step 4: Test scroll — exit TUI preserves position**

1. In normal shell, generate output (e.g., `ls -la` several times to fill scrollback)
2. Scroll up partway through the output
3. Run `claude` (enters alternate buffer)
4. Exit claude
5. Verify: scroll position is restored to where it was before entering the TUI

- [ ] **Step 5: Test IME — Korean input during TUI**

1. Run `claude`
2. Type Korean text repeatedly over several minutes
3. Verify: no character drops, all composed text appears correctly

- [ ] **Step 6: Test IME — Korean input after TUI exit**

1. Exit `claude`
2. In the same shell pane, type Korean text
3. Verify: Korean input works correctly (no persistent corruption)

- [ ] **Step 7: Test IME — other panes unaffected**

1. While TUI is running in one pane, switch to another pane
2. Type Korean text
3. Verify: input works correctly
