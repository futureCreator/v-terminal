import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { ipc } from "../lib/tauriIpc";
import { XTERM_DARK_THEME } from "../lib/xtermTheme";
import { ensureFontLoaded } from "../lib/fontLoader";

// Module-level registry: ptyId → Terminal instance
// Accessible to broadcast hook without prop-drilling
export const terminalRegistry = new Map<string, Terminal>();

interface UsePtyOptions {
  ptyId: string | null;
  cwd: string;
  containerRef: React.RefObject<HTMLDivElement | null>;
  onPtyCreated?: (ptyId: string) => void;
  onPtyExit?: (ptyId: string) => void;
  broadcastEnabled?: boolean;
  siblingPtyIds?: string[];
}

export function usePty({
  ptyId,
  cwd,
  containerRef,
  onPtyCreated,
  onPtyExit,
  broadcastEnabled = false,
  siblingPtyIds = [],
}: UsePtyOptions) {
  const fitAddonRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    let term: Terminal;
    let fitAddon: FitAddon;
    let currentPtyId: string | null = null;
    let unlistenData: (() => void) | null = null;
    let unlistenExit: (() => void) | null = null;
    let disposed = false;

    const setup = async () => {
      await ensureFontLoaded();

      term = new Terminal({
        fontFamily: '"JetBrainsMonoNerdFont", "JetBrains Mono", "Cascadia Code", monospace',
        fontSize: 14,
        lineHeight: 1.2,
        letterSpacing: 0,
        theme: XTERM_DARK_THEME,
        allowTransparency: false,
        fastScrollModifier: "alt",
        scrollback: 5000,
        cursorBlink: true,
        cursorStyle: "block",
        macOptionIsMeta: false,
        rightClickSelectsWord: true,
        convertEol: false,
      });

      fitAddon = new FitAddon();
      fitAddonRef.current = fitAddon;
      term.loadAddon(fitAddon);
      term.loadAddon(new WebLinksAddon());

      if (!containerRef.current || disposed) {
        term.dispose();
        return;
      }

      term.open(containerRef.current);
      fitAddon.fit();

      const { cols, rows } = term;

      // Spawn PTY
      try {
        currentPtyId = await ipc.ptyCreate(cwd, cols, rows);
      } catch (e) {
        term.write(`\r\n\x1b[31mFailed to start PTY: ${e}\x1b[0m\r\n`);
        return;
      }

      if (disposed) {
        ipc.ptyKill(currentPtyId).catch(() => {});
        term.dispose();
        return;
      }

      terminalRegistry.set(currentPtyId, term);
      onPtyCreated?.(currentPtyId);

      // Input: terminal → PTY (with optional broadcast)
      term.onData((data) => {
        if (!currentPtyId) return;
        const encoded = new TextEncoder().encode(data);

        ipc.ptyWrite(currentPtyId, encoded).catch(() => {});

        if (broadcastEnabled) {
          for (const sibId of siblingPtyIds) {
            if (sibId !== currentPtyId) {
              ipc.ptyWrite(sibId, encoded).catch(() => {});
            }
          }
        }
      });

      // Output: PTY → terminal
      unlistenData = await ipc.onPtyData((payload) => {
        if (payload.ptyId === currentPtyId && !disposed) {
          term.write(new Uint8Array(payload.data));
        }
      });

      unlistenExit = await ipc.onPtyExit((payload) => {
        if (payload.ptyId === currentPtyId && !disposed) {
          term.write("\r\n\x1b[2m[Process exited]\x1b[0m\r\n");
          onPtyExit?.(payload.ptyId);
        }
      });
    };

    setup();

    return () => {
      disposed = true;
      unlistenData?.();
      unlistenExit?.();
      if (currentPtyId) {
        terminalRegistry.delete(currentPtyId);
        ipc.ptyKill(currentPtyId).catch(() => {});
      }
      term?.dispose();
      fitAddonRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ptyId, cwd]);

  return { fitAddonRef };
}
