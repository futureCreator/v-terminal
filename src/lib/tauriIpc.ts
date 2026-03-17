import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export interface PtyDataPayload {
  ptyId: string;
  data: number[];
}

export interface PtyExitPayload {
  ptyId: string;
}

// Centralized per-pty event dispatchers.
// Single global listener per event type, dispatch in-process to per-pty handlers.
const ptyDataHandlers = new Map<string, (data: Uint8Array) => void>();
const ptyExitHandlers = new Map<string, () => void>();
let ptyDataUnlisten: UnlistenFn | null = null;
let ptyExitUnlisten: UnlistenFn | null = null;
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
  async ptyCreate(
    cwd: string,
    cols: number,
    rows: number,
    shellProgram?: string,
    shellArgs?: string[],
  ): Promise<string> {
    return invoke<string>("pty_create", { cwd, cols, rows, shellProgram, shellArgs });
  },

  async ptyWrite(sessionId: string, data: Uint8Array): Promise<void> {
    return invoke("pty_write", { ptyId: sessionId, data: Array.from(data) });
  },

  async ptyResize(sessionId: string, cols: number, rows: number): Promise<void> {
    return invoke("pty_resize", { ptyId: sessionId, cols, rows });
  },

  async ptyKill(sessionId: string): Promise<void> {
    return invoke("pty_kill", { ptyId: sessionId });
  },

  async getWslDistros(): Promise<string[]> {
    return invoke<string[]>("get_wsl_distros");
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
};
