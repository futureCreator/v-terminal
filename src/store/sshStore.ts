import { create } from "zustand";
import { v4 as uuidv4 } from "uuid";
import type { SshProfile } from "../types/terminal";

const STORAGE_KEY = "v-terminal:ssh-profiles";

function load(): SshProfile[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SshProfile[]) : [];
  } catch {
    return [];
  }
}

function save(profiles: SshProfile[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
  } catch {}
}

interface SshStore {
  profiles: SshProfile[];
  addProfile: (data: Omit<SshProfile, "id">) => SshProfile;
  removeProfile: (id: string) => void;
  updateProfile: (id: string, updates: Partial<Omit<SshProfile, "id">>) => void;
}

export const useSshStore = create<SshStore>((set) => ({
  profiles: load(),

  addProfile: (data) => {
    const profile: SshProfile = { id: uuidv4(), ...data };
    set((s) => {
      const profiles = [...s.profiles, profile];
      save(profiles);
      return { profiles };
    });
    return profile;
  },

  removeProfile: (id) => {
    set((s) => {
      const profiles = s.profiles.filter((p) => p.id !== id);
      save(profiles);
      return { profiles };
    });
  },

  updateProfile: (id, updates) => {
    set((s) => {
      const profiles = s.profiles.map((p) =>
        p.id === id ? { ...p, ...updates } : p
      );
      save(profiles);
      return { profiles };
    });
  },
}));
