import { useRef, useEffect, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { WebglAddon } from "@xterm/addon-webgl";
import { CanvasAddon } from "@xterm/addon-canvas";
import { open as openUrl } from "@tauri-apps/plugin-shell";
import { ipc } from "../../lib/tauriIpc";
import { ensureFontLoaded } from "../../lib/fontLoader";
import { useTabStore } from "../../store/tabStore";
import { useThemeStore, resolveThemeDefinition } from "../../store/themeStore";
import { useTerminalConfigStore } from "../../store/terminalConfigStore";
import "@xterm/xterm/css/xterm.css";
import "./TerminalPane.css";

export const terminalRegistry = new Map<string, Terminal>();

// Module-level singleton — avoids allocating a new TextEncoder on every keystroke
const encoder = new TextEncoder();

interface TerminalPaneProps {
  style?: React.CSSProperties;
  cwd: string;
  isActive: boolean;
  broadcastEnabled: boolean;
  siblingPtyIds: string[];
  sshCommand?: string;
  shellProgram?: string;
  shellArgs?: string[];
  existingSessionId?: string;
  onPtyCreated: (ptyId: string) => void;
  onPtyKilled: () => void;
  onFocus: () => void;
  onNextPanel?: () => void;
  onPrevPanel?: () => void;
}

export function TerminalPane({
  style,
  cwd,
  isActive,
  broadcastEnabled,
  siblingPtyIds,
  sshCommand,
  shellProgram,
  shellArgs,
  existingSessionId,
  onPtyCreated,
  onPtyKilled,
  onFocus,
  onNextPanel,
  onPrevPanel,
}: TerminalPaneProps) {
  const { themeId } = useThemeStore();
  const themeRef = useRef(themeId);
  themeRef.current = themeId;

  const { fontSize, fontFamily, cursorStyle, cursorBlink, lineHeight, scrollback } = useTerminalConfigStore();
  const fontSizeRef = useRef(fontSize);
  fontSizeRef.current = fontSize;
  const fontFamilyRef = useRef(fontFamily);
  fontFamilyRef.current = fontFamily;
  const cursorStyleRef = useRef(cursorStyle);
  cursorStyleRef.current = cursorStyle;
  const cursorBlinkRef = useRef(cursorBlink);
  cursorBlinkRef.current = cursorBlink;
  const lineHeightRef = useRef(lineHeight);
  lineHeightRef.current = lineHeight;
  const scrollbackRef = useRef(scrollback);
  scrollbackRef.current = scrollback;

  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const ptyIdRef = useRef<string | null>(null);
  const observerRef = useRef<ResizeObserver | null>(null);
  const [exited, setExited] = useState(false);
  const exitedRef = useRef(exited);
  exitedRef.current = exited;
  const [loading, setLoading] = useState(true);
  const [initKey, setInitKey] = useState(0);

  // Store broadcast state in refs to avoid stale closures in the onData handler
  const broadcastRef = useRef(broadcastEnabled);
  const siblingsRef = useRef(siblingPtyIds);
  broadcastRef.current = broadcastEnabled;
  siblingsRef.current = siblingPtyIds;

  const handleRestart = () => {
    setExited(false);
    setLoading(true);
    setInitKey((k) => k + 1);
  };

  // When the daemon dies, mark this pane as exited so the user can start a new session
  useEffect(() => {
    let unlisten: (() => void) | null = null;
    ipc.onDaemonStatus((status) => {
      if (status === "reconnecting" && !exitedRef.current && ptyIdRef.current) {
        setExited(true);
        onPtyKilled();
      }
    }).then((fn) => { unlisten = fn; });
    return () => { unlisten?.(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    let disposed = false;
    let unlistenData: (() => void) | null = null;
    let unlistenExit: (() => void) | null = null;

    const init = async () => {
      await ensureFontLoaded();

      const xtermTheme = resolveThemeDefinition(themeRef.current).xterm;
      const term = new Terminal({
        fontFamily: `"${fontFamilyRef.current}", "JetBrainsMonoNerdFont", "Nanum Gothic Coding", monospace`,
        fontSize: fontSizeRef.current,
        lineHeight: lineHeightRef.current,
        theme: xtermTheme,
        allowTransparency: false,
        scrollback: scrollbackRef.current,
        cursorBlink: cursorBlinkRef.current,
        cursorStyle: cursorStyleRef.current,
        convertEol: false,
      });

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.loadAddon(new WebLinksAddon((_event, uri) => { openUrl(uri).catch(() => {}); }));

      if (disposed || !containerRef.current) {
        term.dispose();
        return;
      }

      term.open(containerRef.current);
      fitAddon.fit();

      // Renderer: WebGL → Canvas → DOM fallback
      try {
        const webglAddon = new WebglAddon();
        webglAddon.onContextLost(() => {
          webglAddon.dispose();
          try {
            term.loadAddon(new CanvasAddon());
          } catch {
            // DOM renderer remains as final fallback
          }
        });
        term.loadAddon(webglAddon);
      } catch {
        try {
          term.loadAddon(new CanvasAddon());
        } catch {
          // DOM renderer remains as final fallback
        }
      }

      termRef.current = term;
      fitAddonRef.current = fitAddon;

      const { cols, rows } = term;

      let ptyId: string;
      let scrollback: number[] = [];
      try {
        if (existingSessionId) {
          try {
            ptyId = existingSessionId;
            scrollback = await ipc.daemonAttach(ptyId);
          } catch {
            // Session no longer exists (e.g. daemon restarted) — create a fresh one
            ptyId = await ipc.daemonCreateSession(cwd, cols, rows, undefined, shellProgram, shellArgs);
            scrollback = await ipc.daemonAttach(ptyId);
          }
        } else {
          ptyId = await ipc.daemonCreateSession(cwd, cols, rows, undefined, shellProgram, shellArgs);
          scrollback = await ipc.daemonAttach(ptyId);
        }
        if (scrollback.length > 0) {
          term.write(new Uint8Array(scrollback));
        }
      } catch (e) {
        term.write(`\r\n\x1b[31mFailed to start session: ${e}\x1b[0m\r\n`);
        setLoading(false);
        return;
      }

      if (disposed) {
        await ipc.daemonDetach(ptyId).catch(() => {});
        term.dispose();
        return;
      }

      ptyIdRef.current = ptyId;
      terminalRegistry.set(ptyId, term);
      setLoading(false);
      onPtyCreated(ptyId);

      // Auto-execute SSH command if provided
      if (sshCommand) {
        ipc.daemonWrite(ptyId, encoder.encode(sshCommand + "\r")).catch(() => {});
      }

      // Clipboard and reserved key handling
      term.attachCustomKeyEventHandler((e) => {
        if (e.type !== "keydown") return true;

        if (e.ctrlKey && e.key === "c") {
          const selection = term.getSelection();
          if (selection) {
            navigator.clipboard.writeText(selection).catch(() => {});
            return false;
          }
          return true; // no selection → pass as SIGINT
        }

        if ((e.metaKey || e.ctrlKey) && e.key === "v") {
          return false;
        }

        if (e.ctrlKey && e.key === "k") {
          return false;
        }

        // Reserved for terminal font size adjustment
        if (e.ctrlKey && !e.shiftKey && (e.key === "=" || e.key === "+" || e.key === "-" || e.key === "0")) {
          return false;
        }

        return true;
      });

      // Input: terminal → PTY (with optional broadcast)
      term.onData((data) => {
        const encoded = encoder.encode(data);
        ipc.daemonWrite(ptyId, encoded).catch(() => {});
        if (broadcastRef.current) {
          for (const sibId of siblingsRef.current) {
            if (sibId !== ptyId) {
              ipc.daemonWrite(sibId, encoded).catch(() => {});
            }
          }
        }
      });

      // Focus tracking
      term.textarea?.addEventListener("focus", () => onFocus());

      // Output: PTY → terminal
      unlistenData = await ipc.onPtyData(ptyId, (data) => {
        if (disposed) return;
        term.write(data);
      });

      unlistenExit = await ipc.onPtyExit(ptyId, () => {
        if (!disposed) {
          setExited(true);
          onPtyKilled();
        }
      });

      // Resize observer with debounce
      if (containerRef.current) {
        let resizeTimeout: ReturnType<typeof setTimeout> | null = null;
        const observer = new ResizeObserver(() => {
          if (disposed || !fitAddonRef.current || !termRef.current) return;

          if (resizeTimeout) clearTimeout(resizeTimeout);
          resizeTimeout = setTimeout(() => {
            resizeTimeout = null;
            if (disposed || !fitAddonRef.current || !termRef.current) return;
            try {
              fitAddon.fit();
              ipc.daemonResize(ptyId, term.cols, term.rows).catch(() => {});
            } catch {}
          }, 50);
        });
        observer.observe(containerRef.current);
        observerRef.current = observer;
      }
    };

    init();

    return () => {
      disposed = true;
      unlistenData?.();
      unlistenExit?.();
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cwd, initKey]);

  // Focus terminal when panel becomes active
  useEffect(() => {
    if (isActive && termRef.current) {
      termRef.current.focus();
    }
  }, [isActive]);

  // Apply font/layout changes — re-fit terminal and notify PTY of new dimensions
  useEffect(() => {
    const term = termRef.current;
    const fitAddon = fitAddonRef.current;
    if (!term || !fitAddon) return;

    term.options.fontSize = fontSize;
    term.options.fontFamily = `"${fontFamily}", "JetBrainsMonoNerdFont", "Nanum Gothic Coding", monospace`;
    term.options.lineHeight = lineHeight;
    try {
      fitAddon.fit();
      const ptyId = ptyIdRef.current;
      if (ptyId) {
        ipc.daemonResize(ptyId, term.cols, term.rows).catch(() => {});
      }
    } catch {}
  }, [fontSize, fontFamily, lineHeight]);

  // Apply cursor style changes
  useEffect(() => {
    const term = termRef.current;
    if (!term) return;
    term.options.cursorStyle = cursorStyle;
  }, [cursorStyle]);

  // Apply cursor blink changes
  useEffect(() => {
    const term = termRef.current;
    if (!term) return;
    term.options.cursorBlink = cursorBlink;
  }, [cursorBlink]);

  // Apply scrollback changes
  useEffect(() => {
    const term = termRef.current;
    if (!term) return;
    term.options.scrollback = scrollback;
  }, [scrollback]);

  return (
    <div
      className={`terminal-pane ${isActive ? "terminal-pane--active" : ""}`}
      style={style}
      onClick={() => { onFocus(); termRef.current?.focus(); }}
    >
      {loading && !exited && (
        <div className="terminal-loading">
          <div className="terminal-spinner" />
        </div>
      )}
      <div
        ref={containerRef}
        className="terminal-container"
        style={{ display: exited ? "none" : undefined }}
      />
      {exited && (
        <div className="terminal-exit-panel" onClick={handleRestart}>
          <svg className="terminal-exit-icon" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 5.5L7.5 10L3 14.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M10 14.5H17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <span className="terminal-exit-label">New Session</span>
        </div>
      )}
    </div>
  );
}
