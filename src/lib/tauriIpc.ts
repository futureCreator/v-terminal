import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export interface SessionDataPayload { sessionId: string; data: number[]; }
export interface SessionExitPayload { sessionId: string; code?: number; }
export interface SshConnectionStatusPayload { connectionId: string; status: string; error?: string; }
export interface SessionCreateResult { sessionId: string; connectionId?: string; }

export interface SessionCreateParams {
  type: 'local' | 'ssh' | 'wsl';
  cwd?: string;
  cols: number;
  rows: number;
  shellProgram?: string;
  shellArgs?: string[];
  ssh?: { host: string; port: number; username: string; identityFile?: string; };
}

export interface SessionCreateWithPasswordParams {
  host: string; port: number; username: string; password: string;
  cols: number; rows: number;
}

export interface ClaudeMdFile {
  path: string;
  level: "user" | "project" | "directory" | "parent";
  content: string;
  lastModified: number;
  readonly: boolean;
}

export type CwdResult =
  | { type: "resolved"; value: string }
  | { type: "pending" };

const sessionDataHandlers = new Map<string, (data: Uint8Array) => void>();
const sessionExitHandlers = new Map<string, (code?: number) => void>();
const sshStatusHandlers = new Map<string, (status: string, error?: string) => void>();
let sessionDataUnlisten: UnlistenFn | null = null;
let sessionExitUnlisten: UnlistenFn | null = null;
let sshStatusUnlisten: UnlistenFn | null = null;
let sessionDataListenerPromise: Promise<void> | null = null;
let sessionExitListenerPromise: Promise<void> | null = null;
let sshStatusListenerPromise: Promise<void> | null = null;

async function ensureSessionDataListener(): Promise<void> {
  if (sessionDataUnlisten) return;
  if (!sessionDataListenerPromise) {
    sessionDataListenerPromise = listen<SessionDataPayload>("session-data", (event) => {
      const { sessionId, data } = event.payload;
      sessionDataHandlers.get(sessionId)?.(new Uint8Array(data));
    }).then((unlisten) => { sessionDataUnlisten = unlisten; });
  }
  return sessionDataListenerPromise;
}

async function ensureSessionExitListener(): Promise<void> {
  if (sessionExitUnlisten) return;
  if (!sessionExitListenerPromise) {
    sessionExitListenerPromise = listen<SessionExitPayload>("session-exit", (event) => {
      const { sessionId, code } = event.payload;
      sessionExitHandlers.get(sessionId)?.(code);
    }).then((unlisten) => { sessionExitUnlisten = unlisten; });
  }
  return sessionExitListenerPromise;
}

async function ensureSshStatusListener(): Promise<void> {
  if (sshStatusUnlisten) return;
  if (!sshStatusListenerPromise) {
    sshStatusListenerPromise = listen<SshConnectionStatusPayload>("ssh-connection-status", (event) => {
      const { connectionId, status, error } = event.payload;
      sshStatusHandlers.get(connectionId)?.(status, error);
    }).then((unlisten) => { sshStatusUnlisten = unlisten; });
  }
  return sshStatusListenerPromise;
}

const sessionCwdHandlers = new Map<string, (cwd: string) => void>();
let sessionCwdUnlisten: UnlistenFn | null = null;
let sessionCwdListenerPromise: Promise<void> | null = null;

async function ensureSessionCwdListener(): Promise<void> {
  if (sessionCwdUnlisten) return;
  if (!sessionCwdListenerPromise) {
    sessionCwdListenerPromise = listen<{ sessionId: string; cwd: string }>("session-cwd", (event) => {
      const { sessionId, cwd } = event.payload;
      sessionCwdHandlers.get(sessionId)?.(cwd);
    }).then((unlisten) => { sessionCwdUnlisten = unlisten; });
  }
  return sessionCwdListenerPromise;
}

const claudeMdChangedHandlers: Array<(path: string) => void> = [];
let claudeMdChangedUnlisten: UnlistenFn | null = null;
let claudeMdChangedListenerPromise: Promise<void> | null = null;

async function ensureClaudeMdChangedListener(): Promise<void> {
  if (claudeMdChangedUnlisten) return;
  if (!claudeMdChangedListenerPromise) {
    claudeMdChangedListenerPromise = listen<{ path: string }>("claude-md-changed", (event) => {
      const { path } = event.payload;
      for (const handler of claudeMdChangedHandlers) handler(path);
    }).then((unlisten) => { claudeMdChangedUnlisten = unlisten; });
  }
  return claudeMdChangedListenerPromise;
}

export const ipc = {
  async sessionCreate(params: SessionCreateParams): Promise<SessionCreateResult> {
    return invoke<SessionCreateResult>("session_create", params as unknown as Record<string, unknown>);
  },
  async sessionCreateWithPassword(params: SessionCreateWithPasswordParams): Promise<SessionCreateResult> {
    return invoke<SessionCreateResult>("session_create_with_password", params as unknown as Record<string, unknown>);
  },
  async sessionWrite(sessionId: string, data: Uint8Array): Promise<void> {
    return invoke("session_write", { sessionId, data: Array.from(data) });
  },
  async sessionResize(sessionId: string, cols: number, rows: number): Promise<void> {
    return invoke("session_resize", { sessionId, cols, rows });
  },
  async sessionKill(sessionId: string): Promise<void> {
    return invoke("session_kill", { sessionId });
  },
  async getWslDistros(): Promise<string[]> {
    return invoke<string[]>("get_wsl_distros");
  },
  async onSessionData(sessionId: string, handler: (data: Uint8Array) => void): Promise<() => void> {
    await ensureSessionDataListener();
    sessionDataHandlers.set(sessionId, handler);
    return () => { sessionDataHandlers.delete(sessionId); };
  },
  async onSessionExit(sessionId: string, handler: (code?: number) => void): Promise<() => void> {
    await ensureSessionExitListener();
    sessionExitHandlers.set(sessionId, handler);
    return () => { sessionExitHandlers.delete(sessionId); };
  },
  async onSshConnectionStatus(connectionId: string, handler: (status: string, error?: string) => void): Promise<() => void> {
    await ensureSshStatusListener();
    sshStatusHandlers.set(connectionId, handler);
    return () => { sshStatusHandlers.delete(connectionId); };
  },
  async getSessionCwd(sessionId: string): Promise<CwdResult> {
    return invoke<CwdResult>("get_session_cwd", { sessionId });
  },
  async discoverClaudeMd(sessionId: string, cwd: string): Promise<ClaudeMdFile[]> {
    return invoke<ClaudeMdFile[]>("discover_claude_md", { sessionId, cwd });
  },
  async readClaudeMd(sessionId: string, path: string): Promise<string> {
    return invoke<string>("read_claude_md", { sessionId, path });
  },
  async writeClaudeMd(sessionId: string, path: string, content: string, expectedMtime?: number): Promise<void> {
    return invoke("write_claude_md", { sessionId, path, content, expectedMtime: expectedMtime ?? null });
  },
  async onSessionCwd(sessionId: string, handler: (cwd: string) => void): Promise<() => void> {
    await ensureSessionCwdListener();
    sessionCwdHandlers.set(sessionId, handler);
    return () => { sessionCwdHandlers.delete(sessionId); };
  },
  async onClaudeMdChanged(handler: (path: string) => void): Promise<() => void> {
    await ensureClaudeMdChangedListener();
    claudeMdChangedHandlers.push(handler);
    return () => {
      const idx = claudeMdChangedHandlers.indexOf(handler);
      if (idx >= 0) claudeMdChangedHandlers.splice(idx, 1);
    };
  },
};
