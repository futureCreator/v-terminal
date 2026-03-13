import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { DaemonSessionInfo } from "../types/terminal";

export interface PtyDataPayload {
  ptyId: string;
  data: number[];
}

export interface PtyExitPayload {
  ptyId: string;
}

// Centralized per-pty event dispatchers.
// Instead of registering N Tauri listeners (one per panel), we maintain a single
// global listener per event type and dispatch in-process to per-pty handlers.
// This reduces event processing from O(N²) to O(N) for N concurrent panels.
const ptyDataHandlers = new Map<string, (data: Uint8Array) => void>();
const ptyExitHandlers = new Map<string, () => void>();
let ptyDataUnlisten: UnlistenFn | null = null;
let ptyExitUnlisten: UnlistenFn | null = null;
// In-flight promises prevent duplicate registrations when multiple panels mount concurrently.
let ptyDataListenerPromise: Promise<void> | null = null;
let ptyExitListenerPromise: Promise<void> | null = null;

async function ensurePtyDataListener(): Promise<void> {
  if (ptyDataUnlisten) return;
  if (!ptyDataListenerPromise) {
    ptyDataListenerPromise = listen<PtyDataPayload>("pty-data", (event) => {
      const { ptyId, data } = event.payload;
      ptyDataHandlers.get(ptyId)?.(new Uint8Array(data));
    }).then((unlisten) => { ptyDataUnlisten = unlisten; });
  }
  return ptyDataListenerPromise;
}

async function ensurePtyExitListener(): Promise<void> {
  if (ptyExitUnlisten) return;
  if (!ptyExitListenerPromise) {
    ptyExitListenerPromise = listen<PtyExitPayload>("pty-exit", (event) => {
      ptyExitHandlers.get(event.payload.ptyId)?.();
    }).then((unlisten) => { ptyExitUnlisten = unlisten; });
  }
  return ptyExitListenerPromise;
}

export const ipc = {
  async daemonListSessions(): Promise<DaemonSessionInfo[]> {
    return invoke<DaemonSessionInfo[]>("daemon_list_sessions");
  },

  async daemonCreateSession(
    cwd: string,
    cols: number,
    rows: number,
    label?: string,
    shellProgram?: string,
    shellArgs?: string[]
  ): Promise<string> {
    return invoke<string>("daemon_create_session", { cwd, cols, rows, label, shellProgram, shellArgs });
  },

  async getWslDistros(): Promise<string[]> {
    return invoke<string[]>("get_wsl_distros");
  },

  async daemonAttach(sessionId: string): Promise<number[]> {
    return invoke<number[]>("daemon_attach", { sessionId });
  },

  async daemonDetach(sessionId: string): Promise<void> {
    return invoke("daemon_detach", { sessionId });
  },

  async daemonWrite(sessionId: string, data: Uint8Array): Promise<void> {
    return invoke("daemon_write", { sessionId, data: Array.from(data) });
  },

  async daemonResize(sessionId: string, cols: number, rows: number): Promise<void> {
    return invoke("daemon_resize", { sessionId, cols, rows });
  },

  async daemonKillSession(sessionId: string): Promise<void> {
    return invoke("daemon_kill_session", { sessionId });
  },

  /** Register a per-pty data handler. One global Tauri listener is shared across all panels. */
  async onPtyData(ptyId: string, handler: (data: Uint8Array) => void): Promise<() => void> {
    await ensurePtyDataListener();
    ptyDataHandlers.set(ptyId, handler);
    return () => { ptyDataHandlers.delete(ptyId); };
  },

  /** Register a per-pty exit handler. One global Tauri listener is shared across all panels. */
  async onPtyExit(ptyId: string, handler: () => void): Promise<() => void> {
    await ensurePtyExitListener();
    ptyExitHandlers.set(ptyId, handler);
    return () => { ptyExitHandlers.delete(ptyId); };
  },

  async getDaemonStatus(): Promise<"connected" | "reconnecting"> {
    return invoke<string>("get_daemon_status") as Promise<"connected" | "reconnecting">;
  },

  onDaemonStatus(handler: (status: "connected" | "reconnecting") => void): Promise<UnlistenFn> {
    return listen<string>("daemon-status", (event) =>
      handler(event.payload as "connected" | "reconnecting")
    );
  },
};
