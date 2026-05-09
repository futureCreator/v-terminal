import { useEffect, useRef } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { readText } from "@tauri-apps/plugin-clipboard-manager";
import { useClipboardStore } from "../store/clipboardStore";

const POLL_INTERVAL_MS = 1000;

export function useClipboardPolling() {
  const addEntry = useClipboardStore((s) => s.addEntry);
  const lastTextRef = useRef<string | null>(null);

  useEffect(() => {
    const appWindow = getCurrentWindow();
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let unlistenFn: (() => void) | null = null;

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
      if (intervalId !== null) return;
      poll();
      intervalId = setInterval(poll, POLL_INTERVAL_MS);
    };

    const stopPolling = () => {
      if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    startPolling();

    appWindow.onFocusChanged(({ payload: focused }) => {
      if (focused) startPolling();
      else stopPolling();
    }).then((fn) => {
      unlistenFn = fn;
    });

    return () => {
      if (intervalId !== null) clearInterval(intervalId);
      intervalId = null;
      if (unlistenFn) unlistenFn();
    };
  }, [addEntry]);
}
