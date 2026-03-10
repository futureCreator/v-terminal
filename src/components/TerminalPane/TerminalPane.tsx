import { useRef, useEffect, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { ipc } from "../../lib/tauriIpc";
import { XTERM_DARK_THEME } from "../../lib/xtermTheme";
import { ensureFontLoaded } from "../../lib/fontLoader";
import { useTabStore } from "../../store/tabStore";
import "@xterm/xterm/css/xterm.css";
import "./TerminalPane.css";

export const terminalRegistry = new Map<string, Terminal>();


interface TerminalPaneProps {
  cwd: string;
  isActive: boolean;
  broadcastEnabled: boolean;
  siblingPtyIds: string[];
  sshCommand?: string;
  onPtyCreated: (ptyId: string) => void;
  onPtyKilled: () => void;
  onFocus: () => void;
  onNextPanel?: () => void;
  onPrevPanel?: () => void;
}

export function TerminalPane({
  cwd,
  isActive,
  broadcastEnabled,
  siblingPtyIds,
  sshCommand,
  onPtyCreated,
  onPtyKilled,
  onFocus,
  onNextPanel,
  onPrevPanel,
}: TerminalPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const ptyIdRef = useRef<string | null>(null);
  const [exited, setExited] = useState(false);

  // Store broadcast refs to avoid stale closures
  const broadcastRef = useRef(broadcastEnabled);
  const siblingsRef = useRef(siblingPtyIds);
  broadcastRef.current = broadcastEnabled;
  siblingsRef.current = siblingPtyIds;


  useEffect(() => {
    if (!containerRef.current) return;

    let disposed = false;
    let unlistenData: (() => void) | null = null;
    let unlistenExit: (() => void) | null = null;

    const init = async () => {
      await ensureFontLoaded();

      const term = new Terminal({
        fontFamily: '"JetBrainsMonoNerdFont", "JetBrains Mono", "Nanum Gothic Coding", monospace',
        fontSize: 14,
        lineHeight: 1.2,
        theme: XTERM_DARK_THEME,
        allowTransparency: false,
        fastScrollModifier: "alt",
        scrollback: 5000,
        cursorBlink: true,
        cursorStyle: "block",
        convertEol: false,
      });

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.loadAddon(new WebLinksAddon());

      if (disposed || !containerRef.current) {
        term.dispose();
        return;
      }

      term.open(containerRef.current);
      fitAddon.fit();
      termRef.current = term;
      fitAddonRef.current = fitAddon;

      // Clipboard key bindings
      term.attachCustomKeyEventHandler((event: KeyboardEvent) => {
        if (event.type !== "keydown") return true;
        // Ctrl+C with selection → copy (not SIGINT)
        if (event.ctrlKey && event.key === "c" && term.hasSelection()) {
          navigator.clipboard.writeText(term.getSelection()).catch(() => {});
          return false;
        }
        // Ctrl+V → prevent \x16 from being sent to PTY (paste handled via paste event)
        if (event.ctrlKey && !event.shiftKey && event.key === "v") {
          return false;
        }
        return true;
      });

      // Handle paste once via capture-phase paste event (covers both Ctrl+V and Ctrl+Shift+V)
      term.textarea?.addEventListener("paste", (e: ClipboardEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const text = e.clipboardData?.getData("text/plain") ?? "";
        if (text) term.paste(text);
      }, true);


      const { cols, rows } = term;

      let ptyId: string;
      try {
        ptyId = await ipc.ptyCreate(cwd, cols, rows);
      } catch (e) {
        term.write(`\r\n\x1b[31mFailed to start shell: ${e}\x1b[0m\r\n`);
        return;
      }

      if (disposed) {
        await ipc.ptyKill(ptyId).catch(() => {});
        term.dispose();
        return;
      }

      ptyIdRef.current = ptyId;
      terminalRegistry.set(ptyId, term);
      onPtyCreated(ptyId);

      // Auto-execute SSH command if provided
      if (sshCommand) {
        const encoded = new TextEncoder().encode(sshCommand + "\r");
        ipc.ptyWrite(ptyId, encoded).catch(() => {});
      }

      // Input
      term.onData((data) => {
        const encoded = new TextEncoder().encode(data);
        ipc.ptyWrite(ptyId, encoded).catch(() => {});
        if (broadcastRef.current) {
          for (const sibId of siblingsRef.current) {
            if (sibId !== ptyId) {
              ipc.ptyWrite(sibId, encoded).catch(() => {});
            }
          }
        }
      });

      // Focus tracking
      term.textarea?.addEventListener("focus", () => onFocus());

      // Output
      unlistenData = await ipc.onPtyData((payload) => {
        if (payload.ptyId === ptyId && !disposed) {
          term.write(new Uint8Array(payload.data));
        }
      });

      unlistenExit = await ipc.onPtyExit((payload) => {
        if (payload.ptyId === ptyId && !disposed) {
          term.write("\r\n\x1b[2m[Process exited. Press any key to close.]\x1b[0m\r\n");
          setExited(true);
          onPtyKilled();
        }
      });

      // Resize observer
      if (containerRef.current) {
        let resizeTimeout: ReturnType<typeof setTimeout> | null = null;
        const observer = new ResizeObserver(() => {
          if (resizeTimeout) clearTimeout(resizeTimeout);
          resizeTimeout = setTimeout(() => {
            if (disposed || !fitAddonRef.current || !termRef.current) return;
            try {
              fitAddon.fit();
              const { cols: c, rows: r } = term;
              ipc.ptyResize(ptyId, c, r).catch(() => {});
            } catch {}
          }, 50);
        });
        observer.observe(containerRef.current);

        // Store for cleanup
        (containerRef.current as HTMLElement & { __observer?: ResizeObserver }).__observer = observer;
      }
    };

    init();

    return () => {
      disposed = true;
      unlistenData?.();
      unlistenExit?.();
      const ptyId = ptyIdRef.current;
      if (ptyId) {
        terminalRegistry.delete(ptyId);
        ipc.ptyKill(ptyId).catch(() => {});
        ptyIdRef.current = null;
      }
      const container = containerRef.current as (HTMLElement & { __observer?: ResizeObserver }) | null;
      container?.__observer?.disconnect();
      termRef.current?.dispose();
      termRef.current = null;
      fitAddonRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cwd]);

  // Focus terminal when panel becomes active
  useEffect(() => {
    if (isActive && termRef.current) {
      termRef.current.focus();
    }
  }, [isActive]);

  return (
    <div className={`terminal-pane ${isActive ? "terminal-pane--active" : ""}`} onClick={onFocus}>
      <div ref={containerRef} className="terminal-container" />
      {exited && (
        <div className="terminal-exit-overlay">
          <span>Process exited</span>
        </div>
      )}
    </div>
  );
}
