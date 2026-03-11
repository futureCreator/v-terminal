import { create } from "zustand";
import { v4 as uuidv4 } from "uuid";
import type { Tab, Panel, Layout } from "../types/terminal";
import { panelCount } from "../lib/layoutMath";

// We import uuid lazily since we bundle it
function genId() {
  return uuidv4();
}

function makePanels(count: number): Panel[] {
  return Array.from({ length: count }, () => ({ id: genId(), ptyId: null }));
}

interface TabStore {
  tabs: Tab[];
  activeTabId: string;

  // Tab actions
  addTab: (cwd: string, label?: string, sshCommand?: string) => string;
  removeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  renameTab: (id: string, label: string) => void;
  reorderTabs: (fromId: string, toId: string) => void;

  // Layout actions
  setLayout: (tabId: string, layout: Layout) => { added: Panel[]; removed: Panel[] };

  // Panel actions
  setPtyId: (tabId: string, panelId: string, ptyId: string) => void;
  clearPtyId: (tabId: string, panelId: string) => void;

  // Activity indicator
  setTabActivity: (tabId: string, value: boolean) => void;

  // Broadcast
  toggleBroadcast: (tabId: string) => void;

  // Session picker
  resolveSessionPick: (
    tabId: string,
    existingSessionId?: string,
    shellProgram?: string,
    shellArgs?: string[],
    sshCommand?: string,
    label?: string,
  ) => void;

  // Session restore
  restoreFromSession: (
    tabs: Array<{ id: string; label: string; cwd: string; layout: Layout; broadcastEnabled: boolean; sshCommand?: string; shellProgram?: string; shellArgs?: string[] }>,
    activeTabId: string
  ) => void;
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

    addTab: (cwd, label?, sshCommand?) => {
      const id = genId();
      const layout: Layout = 1;
      const tab: Tab = {
        id,
        label: label ?? nextTabLabel(),
        cwd,
        layout,
        panels: makePanels(panelCount(layout)),
        broadcastEnabled: false,
        sshCommand,
        pendingSessionPick: !sshCommand, // show picker if no auto-SSH
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

    setActiveTab: (id) =>
      set((s) => ({
        activeTabId: id,
        tabs: s.tabs.map((t) => (t.id === id ? { ...t, hasActivity: false } : t)),
      })),

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
        const extra = makePanels(newCount - oldPanels.length);
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

    setTabActivity: (tabId, value) =>
      set((s) => ({
        tabs: s.tabs.map((t) => (t.id === tabId ? { ...t, hasActivity: value } : t)),
      })),

    toggleBroadcast: (tabId) =>
      set((s) => ({
        tabs: s.tabs.map((t) =>
          t.id === tabId
            ? { ...t, broadcastEnabled: !t.broadcastEnabled }
            : t
        ),
      })),

    resolveSessionPick: (tabId, existingSessionId?, shellProgram?, shellArgs?, sshCommand?, label?) => {
      set((s) => ({
        tabs: s.tabs.map((t) => {
          if (t.id !== tabId) return t;
          const panels = existingSessionId
            ? t.panels.map((p, i) =>
                i === 0 ? { ...p, existingSessionId } : p
              )
            : t.panels;
          return {
            ...t,
            pendingSessionPick: false,
            panels,
            shellProgram,
            shellArgs,
            sshCommand: sshCommand ?? t.sshCommand,
            label: label ?? t.label,
          };
        }),
      }));
    },

    restoreFromSession: (savedTabs, activeTabId) => {
      // Bump counter past any restored "Terminal N" labels
      for (const st of savedTabs) {
        const m = st.label.match(/^Terminal (\d+)$/);
        if (m) tabCounter = Math.max(tabCounter, parseInt(m[1]) + 1);
      }
      const tabs: Tab[] = savedTabs.map((st) => ({
        id: st.id,
        label: st.label,
        cwd: st.cwd,
        layout: st.layout,
        panels: makePanels(panelCount(st.layout)),
        broadcastEnabled: st.broadcastEnabled,
        sshCommand: st.sshCommand,
        shellProgram: st.shellProgram,
        shellArgs: st.shellArgs,
        pendingSessionPick: false,
      }));
      set({
        tabs: tabs.length > 0 ? tabs : [createDefaultTab()],
        activeTabId,
      });
    },
  };
});

// Re-export uuid for components that need it
export { uuidv4 as genId };
