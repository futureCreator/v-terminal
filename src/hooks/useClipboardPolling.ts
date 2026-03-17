import { useEffect, useRef } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { readText } from "@tauri-apps/plugin-clipboard-manager";
import { useClipboardStore } from "../store/clipboardStore";

const POLL_INTERVAL_MS = 1000;

export function useClipboardPolling() {
  const addEntry = useClipboardStore((s) => s.addEntry);
  const lastTextRef = useRef<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const appWindow = getCurrentWindow();

    const poll = async () => {
      try {
        const text = await readText();
        if (text && text !== lastTextRef.current) {
          lastTextRef.current = text;
          addEntry(text);
        }
      } catch {
        // clipboard read failed (locked, non-text content, etc.) — skip silently
      }
    };

    const startPolling = () => {
      if (intervalRef.current) return;
      // Poll immediately on focus
      poll();
      intervalRef.current = setInterval(poll, POLL_INTERVAL_MS);
    };

    const stopPolling = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    // Start polling if window is already focused
    startPolling();

    const unlisten = appWindow.onFocusChanged(({ payload: focused }) => {
      if (focused) startPolling();
      else stopPolling();
    });

    return () => {
      stopPolling();
      unlisten.then((fn) => fn());
    };
  }, [addEntry]);
}
