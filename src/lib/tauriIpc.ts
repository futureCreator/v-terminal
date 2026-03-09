import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { SessionData } from "../types/terminal";

export interface PtyDataPayload {
  ptyId: string;
  data: number[];
}

export interface PtyExitPayload {
  ptyId: string;
}

export const ipc = {
  async ptyCreate(cwd: string, cols: number, rows: number): Promise<string> {
    return invoke<string>("pty_create", { cwd, cols, rows });
  },

  async ptyWrite(ptyId: string, data: Uint8Array): Promise<void> {
    return invoke("pty_write", { ptyId, data: Array.from(data) });
  },

  async ptyResize(ptyId: string, cols: number, rows: number): Promise<void> {
    return invoke("pty_resize", { ptyId, cols, rows });
  },

  async ptyKill(ptyId: string): Promise<void> {
    return invoke("pty_kill", { ptyId });
  },

  async saveSession(data: SessionData): Promise<void> {
    return invoke("save_session", { data });
  },

  async loadSession(): Promise<SessionData | null> {
    return invoke<SessionData | null>("load_session");
  },

  onPtyData(handler: (payload: PtyDataPayload) => void): Promise<UnlistenFn> {
    return listen<PtyDataPayload>("pty-data", (event) => handler(event.payload));
  },

  onPtyExit(handler: (payload: PtyExitPayload) => void): Promise<UnlistenFn> {
    return listen<PtyExitPayload>("pty-exit", (event) => handler(event.payload));
  },
};
