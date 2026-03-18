import { create } from "zustand";
import { ipc, type ClaudeMdFile } from "../lib/tauriIpc";

interface ClaudeCodeState {
  trackedSessionId: string | null;
  trackedCwd: string | null;
  files: ClaudeMdFile[];
  loading: boolean;
  error: string | null;

  setTrackedSession: (sessionId: string | null) => void;
  setCwd: (cwd: string) => void;
  refreshFiles: () => Promise<void>;
  saveFile: (path: string, content: string) => Promise<void>;
}

export const useClaudeCodeStore = create<ClaudeCodeState>((set, get) => ({
  trackedSessionId: null,
  trackedCwd: null,
  files: [],
  loading: false,
  error: null,

  setTrackedSession: (sessionId) => {
    set({ trackedSessionId: sessionId, files: [], trackedCwd: null, error: null });
  },

  setCwd: (cwd) => {
    const state = get();
    if (state.trackedCwd === cwd) return;
    set({ trackedCwd: cwd });
    get().refreshFiles();
  },

  refreshFiles: async () => {
    const { trackedSessionId, trackedCwd } = get();
    if (!trackedSessionId || !trackedCwd) {
      set({ files: [], loading: false });
      return;
    }
    set({ loading: true, error: null });
    try {
      const files = await ipc.discoverClaudeMd(trackedSessionId, trackedCwd);
      set({ files, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  saveFile: async (path, content) => {
    const { trackedSessionId, files } = get();
    if (!trackedSessionId) return;
    const file = files.find((f) => f.path === path);
    const expectedMtime = file?.lastModified;
    try {
      await ipc.writeClaudeMd(trackedSessionId, path, content, expectedMtime);
      get().refreshFiles();
    } catch (e) {
      const errStr = String(e);
      if (errStr.includes("CONFLICT")) {
        set({ error: `File changed externally: ${path}` });
      } else {
        set({ error: errStr });
      }
      throw e;
    }
  },
}));
