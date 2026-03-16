import { create } from "zustand";
import { v4 as uuidv4 } from "uuid";
import type { Tab, Panel, Layout, SavedTab, PanelConnection } from "../types/terminal";
import { panelCount } from "../lib/layoutMath";

// We import uuid lazily since we bundle it
function genId() {
  return uuidv4();
}

const SAVED_TABS_KEY = "v-terminal:saved-tabs";

function loadSavedTabs(): SavedTab[] {
  try {
    const raw = localStorage.getItem(SAVED_TABS_KEY);
    return raw ? (JSON.parse(raw) as SavedTab[]) : [];
  } catch {
    return [];
  }
}

function persistSavedTabs(savedTabs: SavedTab[]) {
  try {
    localStorage.setItem(SAVED_TABS_KEY, JSON.stringify(savedTabs));
  } catch {}
}

function makePanels(count: number): Panel[] {
  return Array.from({ length: count }, () => ({ id: genId(), ptyId: null }));
}

interface TabStore {
  tabs: Tab[];
  activeTabId: string;
  savedTabs: SavedTab[];

  // Tab actions
  addTab: (cwd: string, label?: string) => string;
  removeTab: (id: string) => void;
  saveAndRemoveTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  renameTab: (id: string, label: string) => void;
  reorderTabs: (fromId: string, toId: string) => void;

  // Saved tab actions
  removeSavedTab: (id: string) => void;
  restoreSavedTab: (savedTabId: string) => string;

  // Layout actions
  setLayout: (tabId: string, layout: Layout) => { added: Panel[]; removed: Panel[] };

  // Panel actions
  setPtyId: (tabId: string, panelId: string, ptyId: string) => void;
  clearPtyId: (tabId: string, panelId: string) => void;

  // Broadcast
  toggleBroadcast: (tabId: string) => void;

  // Session picker
  resolveSessionPick: (
    tabId: string,
    layout: Layout,
    panelConnections: PanelConnection[],
  ) => void;

  // App lifecycle
  saveAllOpenTabsToBackground: () => void;
}

const DEFAULT_CWD = "~";

let tabCounter = 1;

function nextTabLabel() {
  return `Terminal ${tabCounter++}`;
}

function createDefaultTab(): Tab {
  const layout: Layout = 1;
  return {
    id: genId(),
    label: nextTabLabel(),
    cwd: DEFAULT_CWD,
    layout,
    panels: makePanels(panelCount(layout)),
    broadcastEnabled: false,
    pendingSessionPick: true,
  };
}

export const useTabStore = create<TabStore>((set, get) => {
  const defaultTab = createDefaultTab();

  return {
    tabs: [defaultTab],
    activeTabId: defaultTab.id,
    savedTabs: loadSavedTabs(),

    addTab: (cwd, label?) => {
      const id = genId();
      const layout: Layout = 1;
      const tab: Tab = {
        id,
        label: label ?? nextTabLabel(),
        cwd,
        layout,
        panels: makePanels(panelCount(layout)),
        broadcastEnabled: false,
        pendingSessionPick: true,
      };
      set((s) => ({ tabs: [...s.tabs, tab], activeTabId: id }));
      return id;
    },

    removeTab: (id) => {
      set((s) => {
        const newTabs = s.tabs.filter((t) => t.id !== id);
        if (newTabs.length === 0) {
          const t = createDefaultTab();
          return { tabs: [t], activeTabId: t.id };
        }
        const activeTabId =
          s.activeTabId === id
            ? newTabs[Math.max(0, s.tabs.findIndex((t) => t.id === id) - 1)]?.id ??
              newTabs[0].id
            : s.activeTabId;
        return { tabs: newTabs, activeTabId };
      });
    },

    saveAndRemoveTab: (id) => {
      set((s) => {
        const tab = s.tabs.find((t) => t.id === id);
        const savablePanels = tab?.panels.filter(
          (p) => p.ptyId !== null || p.connection?.type === 'browser'
        ) ?? [];

        let newSavedTabs = s.savedTabs;
        if (tab && savablePanels.length > 0) {
          const savedTab: SavedTab = {
            id: genId(),
            label: tab.label,
            layout: tab.layout,
            panels: savablePanels.map((p) => ({
              panelId: p.id,
              ptyId: p.ptyId,
              connection: p.connection,
            })),
            savedAt: Date.now(),
          };
          newSavedTabs = [...s.savedTabs, savedTab];
          persistSavedTabs(newSavedTabs);
        }

        const newTabs = s.tabs.filter((t) => t.id !== id);
        if (newTabs.length === 0) {
          const t = createDefaultTab();
          return { tabs: [t], activeTabId: t.id, savedTabs: newSavedTabs };
        }

        const activeTabId =
          s.activeTabId === id
            ? newTabs[Math.max(0, s.tabs.findIndex((t) => t.id === id) - 1)]?.id ??
              newTabs[0].id
            : s.activeTabId;

        return { tabs: newTabs, activeTabId, savedTabs: newSavedTabs };
      });
    },

    removeSavedTab: (id) =>
      set((s) => {
        const savedTabs = s.savedTabs.filter((t) => t.id !== id);
        persistSavedTabs(savedTabs);
        return { savedTabs };
      }),

    restoreSavedTab: (savedTabId) => {
      const savedTab = get().savedTabs.find((t) => t.id === savedTabId);
      if (!savedTab) return "";

      const newTabId = genId();
      const totalPanels = panelCount(savedTab.layout);
      const panels: Panel[] = [];

      for (let i = 0; i < totalPanels; i++) {
        const sp = savedTab.panels[i];
        panels.push({
          id: genId(),
          ptyId: null,
          ...(sp?.connection?.type === 'browser'
            ? { connection: sp.connection }
            : { existingSessionId: sp?.ptyId ?? undefined }
          ),
        });
      }

      const tab: Tab = {
        id: newTabId,
        label: savedTab.label,
        cwd: DEFAULT_CWD,
        layout: savedTab.layout,
        panels,
        broadcastEnabled: false,
        pendingSessionPick: false,
      };

      set((s) => {
        const savedTabs = s.savedTabs.filter((t) => t.id !== savedTabId);
        persistSavedTabs(savedTabs);
        return {
          tabs: [...s.tabs, tab],
          activeTabId: newTabId,
          savedTabs,
        };
      });

      return newTabId;
    },

    setActiveTab: (id) => set({ activeTabId: id }),

    renameTab: (id, label) =>
      set((s) => ({
        tabs: s.tabs.map((t) => (t.id === id ? { ...t, label } : t)),
      })),

    reorderTabs: (fromId, toId) => {
      set((s) => {
        const from = s.tabs.findIndex((t) => t.id === fromId);
        const to = s.tabs.findIndex((t) => t.id === toId);
        if (from === -1 || to === -1 || from === to) return s;
        const tabs = [...s.tabs];
        const [moved] = tabs.splice(from, 1);
        tabs.splice(to, 0, moved);
        return { tabs };
      });
    },

    setLayout: (tabId, layout) => {
      const tab = get().tabs.find((t) => t.id === tabId);
      if (!tab) return { added: [], removed: [] };

      const newCount = panelCount(layout);
      const oldPanels = tab.panels;
      let added: Panel[] = [];
      let removed: Panel[] = [];

      let newPanels: Panel[];
      if (newCount > oldPanels.length) {
        // Inherit connection from the first panel so new panels match (e.g. SSH)
        const baseConnection = oldPanels[0]?.connection;
        const extra: Panel[] = Array.from(
          { length: newCount - oldPanels.length },
          () => ({
            id: genId(),
            ptyId: null,
            ...(baseConnection ? { connection: { ...baseConnection } } : {}),
          }),
        );
        added = extra;
        newPanels = [...oldPanels, ...extra];
      } else if (newCount < oldPanels.length) {
        removed = oldPanels.slice(newCount);
        newPanels = oldPanels.slice(0, newCount);
      } else {
        newPanels = oldPanels;
      }

      set((s) => ({
        tabs: s.tabs.map((t) =>
          t.id === tabId ? { ...t, layout, panels: newPanels } : t
        ),
      }));

      return { added, removed };
    },

    setPtyId: (tabId, panelId, ptyId) =>
      set((s) => ({
        tabs: s.tabs.map((t) =>
          t.id === tabId
            ? {
                ...t,
                panels: t.panels.map((p) =>
                  p.id === panelId ? { ...p, ptyId } : p
                ),
              }
            : t
        ),
      })),

    clearPtyId: (tabId, panelId) =>
      set((s) => ({
        tabs: s.tabs.map((t) =>
          t.id === tabId
            ? {
                ...t,
                panels: t.panels.map((p) =>
                  p.id === panelId ? { ...p, ptyId: null } : p
                ),
              }
            : t
        ),
      })),

    toggleBroadcast: (tabId) =>
      set((s) => ({
        tabs: s.tabs.map((t) =>
          t.id === tabId
            ? { ...t, broadcastEnabled: !t.broadcastEnabled }
            : t
        ),
      })),

    resolveSessionPick: (tabId, layout, panelConnections) => {
      const count = panelCount(layout);
      const panels: Panel[] = Array.from({ length: count }, (_, i) => ({
        id: genId(),
        ptyId: null,
        connection: panelConnections[i],
      }));

      set((s) => ({
        tabs: s.tabs.map((t) => {
          if (t.id !== tabId) return t;
          const label = panelConnections.find((c) => c?.label)?.label ?? t.label;
          return {
            ...t,
            pendingSessionPick: false,
            layout,
            panels,
            label,
          };
        }),
      }));
    },

    saveAllOpenTabsToBackground: () => {
      set((s) => {
        const newSaved = s.tabs
          .filter((t) => !t.pendingSessionPick)
          .flatMap((t) => {
            const savablePanels = t.panels.filter(
              (p) => p.ptyId !== null || p.connection?.type === 'browser'
            );
            if (savablePanels.length === 0) return [];
            const savedTab: SavedTab = {
              id: genId(),
              label: t.label,
              layout: t.layout,
              panels: savablePanels.map((p) => ({
                panelId: p.id,
                ptyId: p.ptyId,
                connection: p.connection,
              })),
              savedAt: Date.now(),
            };
            return [savedTab];
          });
        if (newSaved.length === 0) return s;
        const allSaved = [...s.savedTabs, ...newSaved];
        persistSavedTabs(allSaved);
        return { savedTabs: allSaved };
      });
    },

  };
});

// Re-export uuid for components that need it
export { uuidv4 as genId };
