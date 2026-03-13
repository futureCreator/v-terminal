import { useEffect, useRef, useState } from "react";
import { ipc } from "../../lib/tauriIpc";
import "./DaemonStatusBanner.css";

type BannerState = "reconnecting" | "reconnected" | null;

export function DaemonStatusBanner() {
  const [state, setState] = useState<BannerState>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let unlisten: (() => void) | null = null;

    ipc.onDaemonStatus((status) => {
      if (timerRef.current) clearTimeout(timerRef.current);

      if (status === "reconnecting") {
        setState("reconnecting");
      } else if (status === "connected") {
        setState((prev) => {
          if (prev === "reconnecting") {
            timerRef.current = setTimeout(() => setState(null), 2500);
            return "reconnected";
          }
          return null;
        });
      }
    }).then((fn) => { unlisten = fn; });

    return () => {
      unlisten?.();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (!state) return null;

  return (
    <div className={`daemon-banner daemon-banner--${state}`} role="status">
      {state === "reconnecting" && (
        <>
          <span className="daemon-banner__spinner" aria-hidden="true" />
          <span>Daemon disconnected. Reconnecting…</span>
        </>
      )}
      {state === "reconnected" && (
        <>
          <svg className="daemon-banner__check" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M3 8.5L6.5 12L13 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>Daemon reconnected</span>
        </>
      )}
    </div>
  );
}
