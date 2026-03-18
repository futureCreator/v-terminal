import { create } from "zustand";
import { ipc, type DashboardStats } from "../lib/tauriIpc";

interface DashboardState {
  stats: DashboardStats | null;
  loading: boolean;
  error: string | null;
  refresh: (sessionId: string) => Promise<void>;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  stats: null,
  loading: false,
  error: null,

  refresh: async (sessionId: string) => {
    set({ loading: true, error: null });
    try {
      const stats = await ipc.getDashboardStats(sessionId);
      set({ stats, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },
}));
