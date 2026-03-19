import { create } from "zustand";
import { v4 as uuidv4 } from "uuid";
import type { Tab, Panel, Layout, PanelConnection } from "../types/terminal";
import { panelCount } from "../lib/layoutMath";

const WORKSPACE_KEY = "v-terminal:workspace";
const WORKSPACE_SAVE_DEBOUNCE_MS = 300;

interface WorkspaceState {
  version: 1;
  tabs: Array<{
    id: string;
    label: string;
    cwd: string;
    layout: Layout;
    broadcastEnabled: boolean;
    panels: Array<{
      id: string;
      connection?: PanelConnection;
    }>;
  }>;
  activeTabId: string;
}

// We import uuid lazily since we bundle it
function genId() {
  return uuidv4();
}

function makePanels(count: number): Panel[] {
  return Array.from({ length: count }, () => ({ id: genId(), sessionId: null }));
}

interface TabStore {
  tabs: Tab[];
  activeTabId: string;

  // Tab actions
  addTab: (cwd: string, label?: string) => string;
  removeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  renameTab: (id: string, label: string) => void;
  reorderTabs: (fromId: string, toId: string) => void;

  // Layout actions
  setLayout: (tabId: string, layout: Layout) => { added: Panel[]; removed: Panel[] };

  // Panel actions
  setSessionId: (tabId: string, panelId: string, sessionId: string, connectionId?: string) => void;
  clearSessionId: (tabId: string, panelId: string) => void;
  switchPanelConnection: (tabId: string, panelId: string, connection: PanelConnection) => void;

  // Broadcast
  toggleBroadcast: (tabId: string) => void;

  // Session pick
  resolveSessionPick: (tabId: string, layout: Layout, panelConnections: PanelConnection[]) => void;
}

const DEFAULT_CWD = "~";

let tabCounter = 1;

function nextTabLabel() {
  return `Terminal ${tabCounter++}`;
}

let workspaceSaveTimer: ReturnType<typeof setTimeout> | null = null;

function saveWorkspace(tabs: Tab[], activeTabId: string) {
  if (workspaceSaveTimer) clearTimeout(workspaceSaveTimer);
  workspaceSaveTimer = setTimeout(() => {
    try {
      const state: WorkspaceState = {
        version: 1,
        tabs: tabs
          .filter((t) => !t.pendingSessionPick)
          .map((t) => ({
            id: t.id,
            label: t.label,
            cwd: t.cwd,
            layout: t.layout,
            broadcastEnabled: t.broadcastEnabled,
            panels: t.panels.map((p) => ({
              id: p.id,
              connection: p.connection,
            })),
          })),
        activeTabId,
      };
      localStorage.setItem(WORKSPACE_KEY, JSON.stringify(state));
    } catch {}
  }, WORKSPACE_SAVE_DEBOUNCE_MS);
}

function loadWorkspace(): { tabs: Tab[]; activeTabId: string } | null {
  try {
    const raw = localStorage.getItem(WORKSPACE_KEY);
    if (!raw) return null;
    const state = JSON.parse(raw) as WorkspaceState;
    if (state.version !== 1 || !Array.isArray(state.tabs) || state.tabs.length === 0) return null;

    const tabs: Tab[] = state.tabs.map((t) => ({
      id: t.id,
      label: t.label,
      cwd: t.cwd,
      layout: t.layout,
      broadcastEnabled: t.broadcastEnabled,
      pendingSessionPick: false,
      panels: t.panels.map((p) => ({
        id: p.id,
        sessionId: null,
        connection: p.connection,
      })),
    }));

    const maxNum = tabs.reduce((max, t) => {
      const match = t.label.match(/^Terminal (\d+)$/);
      return match ? Math.max(max, parseInt(match[1], 10)) : max;
    }, 0);
    tabCounter = maxNum + 1;

    return { tabs, activeTabId: state.activeTabId };
  } catch {
    return null;
  }
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
  const restored = loadWorkspace();
  const initialTabs = restored?.tabs ?? [createDefaultTab()];
  const initialActiveTabId = restored?.activeTabId ?? initialTabs[0].id;

  const activeTabId = initialTabs.find((t) => t.id === initialActiveTabId)
    ? initialActiveTabId
    : initialTabs[0].id;

  return {
    tabs: initialTabs,
    activeTabId,

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
        const firstConn = oldPanels[0]?.connection;
        const baseConnection = (firstConn?.type === "note" || firstConn?.type === "browser") ? undefined : firstConn;
        const extra: Panel[] = Array.from(
          { length: newCount - oldPanels.length },
          () => ({
            id: genId(),
            sessionId: null,
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

    setSessionId: (tabId, panelId, sessionId, connectionId?) =>
      set((s) => ({
        tabs: s.tabs.map((t) =>
          t.id === tabId
            ? {
                ...t,
                panels: t.panels.map((p) =>
                  p.id === panelId ? { ...p, sessionId, connectionId } : p
                ),
              }
            : t
        ),
      })),

    clearSessionId: (tabId, panelId) =>
      set((s) => ({
        tabs: s.tabs.map((t) =>
          t.id === tabId
            ? {
                ...t,
                panels: t.panels.map((p) =>
                  p.id === panelId ? { ...p, sessionId: null, connectionId: null } : p
                ),
              }
            : t
        ),
      })),

    switchPanelConnection: (tabId, panelId, connection) =>
      set((s) => ({
        tabs: s.tabs.map((t) =>
          t.id === tabId
            ? {
                ...t,
                panels: t.panels.map((p) =>
                  p.id === panelId
                    ? { ...p, connection, sessionId: null, connectionId: null }
                    : p
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
        sessionId: null,
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

  };
});

// Persist workspace state on every change
useTabStore.subscribe((state) => {
  saveWorkspace(state.tabs, state.activeTabId);
});

// Re-export uuid for components that need it
export { uuidv4 as genId };
