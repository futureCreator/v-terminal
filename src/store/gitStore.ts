import { create } from "zustand";
import { ipc, GitFileEntry, GitStatusResult } from "../lib/tauriIpc";

interface GitState {
  trackedSessionId: string | null;
  trackedCwd: string | null;
  isGitRepo: boolean;

  unstagedFiles: GitFileEntry[];
  stagedFiles: GitFileEntry[];

  selectedFile: { path: string; staged: boolean } | null;
  diffContent: string | null;

  loading: boolean;
  error: string | null;

  setTrackedSession: (sessionId: string | null) => void;
  setCwd: (cwd: string | null) => void;
  refreshStatus: () => Promise<void>;
  selectFile: (path: string, staged: boolean) => Promise<void>;
  clearSelection: () => void;
  clear: () => void;
}

export const useGitStore = create<GitState>((set, get) => ({
  trackedSessionId: null,
  trackedCwd: null,
  isGitRepo: false,
  unstagedFiles: [],
  stagedFiles: [],
  selectedFile: null,
  diffContent: null,
  loading: false,
  error: null,

  setTrackedSession: (sessionId) => {
    set({
      trackedSessionId: sessionId,
      trackedCwd: null,
      isGitRepo: false,
      unstagedFiles: [],
      stagedFiles: [],
      selectedFile: null,
      diffContent: null,
      error: null,
    });
  },

  setCwd: (cwd) => {
    const state = get();
    if (state.trackedCwd === cwd) return;
    set({ trackedCwd: cwd, selectedFile: null, diffContent: null });
    if (cwd) {
      get().refreshStatus();
    } else {
      set({ unstagedFiles: [], stagedFiles: [], isGitRepo: false });
    }
  },

  refreshStatus: async () => {
    const { trackedSessionId, trackedCwd } = get();
    if (!trackedSessionId || !trackedCwd) {
      set({ unstagedFiles: [], stagedFiles: [], isGitRepo: false, loading: false });
      return;
    }
    set({ loading: true, error: null });
    try {
      const result: GitStatusResult = await ipc.getGitStatus(trackedSessionId, trackedCwd);
      set({
        unstagedFiles: result.unstaged,
        stagedFiles: result.staged,
        isGitRepo: result.isGitRepo,
        loading: false,
      });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  selectFile: async (path, staged) => {
    const { trackedSessionId, trackedCwd } = get();
    if (!trackedSessionId || !trackedCwd) return;

    set({ selectedFile: { path, staged }, diffContent: null });
    try {
      const diff = await ipc.getGitDiff(trackedSessionId, trackedCwd, path, staged);
      set({ diffContent: diff });
    } catch (e) {
      set({ diffContent: `Error loading diff: ${e}` });
    }
  },

  clearSelection: () => {
    set({ selectedFile: null, diffContent: null });
  },

  clear: () => {
    set({
      trackedCwd: null,
      isGitRepo: false,
      unstagedFiles: [],
      stagedFiles: [],
      selectedFile: null,
      diffContent: null,
      loading: false,
      error: null,
    });
  },
}));
