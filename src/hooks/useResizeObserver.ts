import { useEffect, useRef } from "react";
import type { FitAddon } from "@xterm/addon-fit";
import { ipc } from "../lib/tauriIpc";
import type { Terminal } from "@xterm/xterm";

export function useResizeObserver(
  containerRef: React.RefObject<HTMLDivElement | null>,
  fitAddonRef: React.RefObject<FitAddon | null>,
  termRef: React.RefObject<Terminal | null>,
  ptyId: string | null
) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver(() => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        const fitAddon = fitAddonRef.current;
        const term = termRef.current;
        if (!fitAddon || !term || !ptyId) return;
        try {
          const buffer = term.buffer.active;
          const savedViewportY = buffer.viewportY;
          const isAtBottom = savedViewportY >= buffer.length - term.rows;

          fitAddon.fit();

          if (!isAtBottom) {
            term.scrollToLine(savedViewportY);
          }

          const { cols, rows } = term;
          ipc.daemonResize(ptyId, cols, rows).catch(() => {});
        } catch {
          // Fit may fail if terminal is not fully initialized yet
        }
      }, 50);
    });

    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [containerRef, fitAddonRef, termRef, ptyId]);
}
