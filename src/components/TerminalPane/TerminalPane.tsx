import { useRef, useEffect, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { ipc } from "../../lib/tauriIpc";
import { XTERM_DARK_THEME } from "../../lib/xtermTheme";
import { ensureFontLoaded } from "../../lib/fontLoader";
import { useTabStore } from "../../store/tabStore";
import type { Layout } from "../../types/terminal";
import "@xterm/xterm/css/xterm.css";
import "./TerminalPane.css";

export const terminalRegistry = new Map<string, Terminal>();

const LAYOUT_KEYS: Record<string, Layout> = {
  "1": 1, "2": 2, "3": 3, "4": 4, "5": 6, "6": 9,
};

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

  // Store shortcut callbacks in refs to avoid stale closures
  const shortcutRef = useRef({ onNextPanel, onPrevPanel });
  shortcutRef.current = { onNextPanel, onPrevPanel };

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

      // Copy/Paste handling
      const isMac = navigator.platform.toUpperCase().includes("MAC");
      term.attachCustomKeyEventHandler((event: KeyboardEvent) => {
        if (event.type !== "keydown") return true;

        const { ctrlKey, shiftKey, metaKey, key } = event;

        // Paste: Cmd+V (macOS) or Ctrl+Shift+V (Linux/Windows)
        const isPaste = isMac
          ? metaKey && key === "v"
          : ctrlKey && shiftKey && key === "V";
        if (isPaste) {
          navigator.clipboard.readText().then((text) => {
            if (text) term.paste(text);
          }).catch(() => {});
          return false;
        }

        // Copy: Cmd+C (macOS) or Ctrl+Shift+C (Linux/Windows) when text is selected
        const isCopy = isMac
          ? metaKey && key === "c"
          : ctrlKey && shiftKey && key === "C";
        if (isCopy && term.hasSelection()) {
          navigator.clipboard.writeText(term.getSelection()).catch(() => {});
          return false;
        }

        // App shortcuts: Ctrl+Shift+* and Ctrl+Tab
        if (ctrlKey && !metaKey) {
          // Ctrl+Tab: next tab
          if (key === "Tab" && !shiftKey) {
            const store = useTabStore.getState();
            const { tabs, activeTabId } = store;
            const idx = tabs.findIndex((t) => t.id === activeTabId);
            const next = tabs[(idx + 1) % tabs.length];
            if (next) store.setActiveTab(next.id);
            return false;
          }

          if (shiftKey) {
            switch (key) {
              case "N":
                shortcutRef.current.onNextPanel?.();
                return false;
              case "P":
                shortcutRef.current.onPrevPanel?.();
                return false;
              case "B": {
                const store = useTabStore.getState();
                store.toggleBroadcast(store.activeTabId);
                return false;
              }
              default: {
                const layout = LAYOUT_KEYS[key];
                if (layout !== undefined) {
                  const store = useTabStore.getState();
                  store.setLayout(store.activeTabId, layout);
                  return false;
                }
              }
            }
          }
        }

        return true;
      });

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
