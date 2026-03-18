import { useEffect, useRef, useState } from "react";
import { ipc } from "../lib/tauriIpc";

/**
 * Shared hook for tracking a session's current working directory.
 * Fetches CWD on mount and subscribes to CWD change events.
 */
export function useSessionCwd(sessionId: string | null): string | null {
  const [cwd, setCwd] = useState<string | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    // Clean up previous subscription
    unsubRef.current?.();
    unsubRef.current = null;
    setCwd(null);

    if (!sessionId) return;

    // Fetch initial CWD
    ipc.getSessionCwd(sessionId).then((result) => {
      if ("value" in result) {
        setCwd(result.value);
      }
    });

    // Subscribe to CWD changes
    ipc.onSessionCwd(sessionId, (newCwd) => {
      setCwd(newCwd);
    }).then((unsub) => {
      unsubRef.current = unsub;
    });

    return () => {
      unsubRef.current?.();
      unsubRef.current = null;
    };
  }, [sessionId]);

  return cwd;
}
