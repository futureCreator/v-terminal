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

export const ipc = {
  // Daemon session management
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

  onPtyData(handler: (payload: PtyDataPayload) => void): Promise<UnlistenFn> {
    return listen<PtyDataPayload>("pty-data", (event) => handler(event.payload));
  },

  onPtyExit(handler: (payload: PtyExitPayload) => void): Promise<UnlistenFn> {
    return listen<PtyExitPayload>("pty-exit", (event) => handler(event.payload));
  },
};
