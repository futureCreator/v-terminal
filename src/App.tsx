import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { homeDir } from "@tauri-apps/api/path";
import { TitleBar } from "./components/TitleBar/TitleBar";
import { TabBar } from "./components/TabBar/TabBar";
import { SplitToolbar } from "./components/SplitToolbar/SplitToolbar";
import { PanelGrid } from "./components/PanelGrid/PanelGrid";
import { SessionPicker } from "./components/SessionPicker/SessionPicker";
import type { SessionPickResult } from "./components/SessionPicker/SessionPicker";
import { SshManagerModal } from "./components/SshManager/SshManagerModal";
import { SettingsModal } from "./components/SettingsModal/SettingsModal";
import { CommandPalette } from "./components/CommandPalette/CommandPalette";
import type { PaletteSection } from "./components/CommandPalette/CommandPalette";
import { SidePanel } from "./components/SidePanel/SidePanel";
import type { SidebarTab } from "./components/SidePanel/SidePanel";
import { WelcomePage } from "./components/WelcomePage/WelcomePage";
import { useOnboardingStore } from "./store/onboardingStore";
import type { PanelNavHandle } from "./components/PanelGrid/PanelGrid";
import { useAlarmTick } from "./hooks/useAlarmTick";
import { useClipboardPolling } from "./hooks/useClipboardPolling";
import { useClipboardStore } from "./store/clipboardStore";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { allTopics } from "./data/cheatsheets";
import { useTabStore } from "./store/tabStore";
import { useNoteStore } from "./store/noteStore";
import { useThemeStore, resolveThemeDefinition } from "./store/themeStore";
import { useTerminalConfigStore } from "./store/terminalConfigStore";
import { useSshStore } from "./store/sshStore";
import { ipc } from "./lib/tauriIpc";
import { terminalRegistry } from "./components/TerminalPane/TerminalPane";
import type { Layout } from "./types/terminal";
import "./styles/theme.css";
import "./styles/globals.css";
import "./App.css";

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (seconds < 60) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

export function App() {
  const { tabs, activeTabId, addTab, removeTab, setLayout, toggleBroadcast, setActiveTab, switchPanelConnection, resolveSessionPick } =
    useTabStore();
  const { themeId } = useThemeStore();
  const { increaseFontSize: fontIncrease, decreaseFontSize: fontDecrease, resetFontSize: fontReset } = useTerminalConfigStore();
  const { profiles: sshProfiles } = useSshStore();
  const { isDone: onboardingDone, markDone: markOnboardingDone } = useOnboardingStore();
  const activeTab = useMemo(
    () => tabs.find((t) => t.id === activeTabId) ?? tabs[0],
    [tabs, activeTabId]
  );

  const [sshModalOpen, setSshModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    const stored = localStorage.getItem("v-terminal:sidebar-open");
    if (stored !== null) return stored === "true";
    return localStorage.getItem("v-terminal:note-open") === "true" || localStorage.getItem("v-terminal:alarm-open") === "true";
  });
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>(() => {
    const stored = localStorage.getItem("v-terminal:sidebar-tab");
    if (stored === "todos" || stored === "timers" || stored === "cheatsheet") return stored;
    if (stored === "notes") {
      localStorage.setItem("v-terminal:sidebar-tab", "todos");
      return "todos";
    }
    if (stored === "pomodoro" || stored === "timer" || stored === "recurring" || stored === "alerts") {
      localStorage.setItem("v-terminal:sidebar-tab", "timers");
      return "timers";
    }
    return localStorage.getItem("v-terminal:alarm-open") === "true" ? "timers" : "todos";
  });
  const activePanelSessionIdRef = useRef<string | null>(null);
  const activePanelIdRef = useRef<string | null>(null);
  const [activePanelId, setActivePanelId] = useState<string | null>(null);
  const [cheatsheetTopic, setCheatsheetTopic] = useState<string | null>(null);
  const panelNavRef = useRef<PanelNavHandle | null>(null);

  const showWelcome = !onboardingDone && tabs.some((t) => t.pendingSessionPick);
  const showWelcomeRef = useRef(showWelcome);
  useEffect(() => { showWelcomeRef.current = showWelcome; }, [showWelcome]);

  const handleWelcomeDone = useCallback(() => {
    markOnboardingDone();
  }, [markOnboardingDone]);

  // Prefetch WSL distros on startup to warm the Rust-side cache
  useEffect(() => {
    ipc.getWslDistros().catch(() => {});
  }, []);

  // One-time migration from old per-tab notes+todos to new format
  useEffect(() => {
    const MIGRATION_KEY = "v-terminal:migration-note-panel-done";
    if (localStorage.getItem(MIGRATION_KEY)) return;

    const oldNotesRaw = localStorage.getItem("v-terminal:tab-notes");
    if (oldNotesRaw) {
      try {
        const oldNotes = JSON.parse(oldNotesRaw) as Record<string, { markdown: string; todos: Array<{ id: string; text: string; completed: boolean }> }>;
        const allTodos: Array<{ id: string; text: string; completed: boolean }> = [];
        const seenTexts = new Set<string>();

        for (const tabNote of Object.values(oldNotes)) {
          if (tabNote.todos) {
            for (const todo of tabNote.todos) {
              const key = todo.text.trim().toLowerCase();
              if (!seenTexts.has(key)) {
                seenTexts.add(key);
                allTodos.push(todo);
              }
            }
          }
        }

        if (allTodos.length > 0) {
          const existingRaw = localStorage.getItem("v-terminal:todos");
          const existing = existingRaw ? JSON.parse(existingRaw) as Array<{ id: string; text: string; completed: boolean }> : [];
          localStorage.setItem("v-terminal:todos", JSON.stringify([...existing, ...allTodos]));
        }

        localStorage.removeItem("v-terminal:tab-notes");
      } catch {}
    }

    localStorage.removeItem("v-terminal:note-content");
    localStorage.setItem(MIGRATION_KEY, "true");
  }, []);

  // Alarm tick engine
  useAlarmTick();
  useClipboardPolling();

  const sidebarOpenRef = useRef(sidebarOpen);
  useEffect(() => { sidebarOpenRef.current = sidebarOpen; }, [sidebarOpen]);

  const handleToggleToolkit = useCallback(() => {
    const next = !sidebarOpen;
    setSidebarOpen(next);
    localStorage.setItem("v-terminal:sidebar-open", String(next));
  }, [sidebarOpen]);

  const handleCloseSidebar = useCallback(() => {
    setSidebarOpen(false);
    localStorage.setItem("v-terminal:sidebar-open", "false");
  }, []);

  const handleSidebarTabChange = useCallback((tab: SidebarTab) => {
    setSidebarTab(tab);
    localStorage.setItem("v-terminal:sidebar-tab", tab);
  }, []);

  // Global keyboard shortcuts — intercept before xterm sees the event
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Skip all global shortcuts while onboarding welcome overlay is active
      if (showWelcomeRef.current) return;

      if (e.ctrlKey && e.key === "k") {
        e.preventDefault();
        e.stopPropagation();
        setPaletteOpen((open) => !open);
      }
      if (e.ctrlKey && e.shiftKey && e.key === "T") {
        e.preventDefault();
        e.stopPropagation();
        handleNewTabRef.current();
      }
      if (e.ctrlKey && e.shiftKey && e.key === "N") {
        e.preventDefault();
        e.stopPropagation();
        const next = !sidebarOpenRef.current;
        setSidebarOpen(next);
        localStorage.setItem("v-terminal:sidebar-open", String(next));
      }
      // Terminal font size: Ctrl+= / Ctrl+- / Ctrl+0
      if (e.ctrlKey && !e.shiftKey && (e.key === "=" || e.key === "+")) {
        e.preventDefault();
        e.stopPropagation();
        fontIncrease();
      }
      if (e.ctrlKey && !e.shiftKey && e.key === "-") {
        e.preventDefault();
        e.stopPropagation();
        fontDecrease();
      }
      if (e.ctrlKey && !e.shiftKey && e.key === "0") {
        e.preventDefault();
        e.stopPropagation();
        fontReset();
      }
    };
    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, []);

  // Apply theme CSS variables to document and update all open terminals
  useEffect(() => {
    const applyTheme = () => {
      const def = resolveThemeDefinition(themeId);
      const el = document.documentElement;
      Object.entries(def.cssVars).forEach(([key, val]) => el.style.setProperty(key, val));
      for (const term of terminalRegistry.values()) {
        term.options.theme = def.xterm;
      }
    };

    applyTheme();

    if (themeId === "auto") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      mq.addEventListener("change", applyTheme);
      return () => mq.removeEventListener("change", applyTheme);
    }
  }, [themeId]);

  const activateTab = useCallback((tabId: string) => {
    setActiveTab(tabId);
  }, [setActiveTab]);

  const handleNewTab = useCallback(async () => {
    let cwd: string;
    try { cwd = await homeDir(); } catch { cwd = "~"; }
    addTab(cwd);
  }, [addTab]);

  const handleNewTabRef = useRef(handleNewTab);
  useEffect(() => { handleNewTabRef.current = handleNewTab; }, [handleNewTab]);

  const handleNewSession = useCallback((tabId: string, result: SessionPickResult) => {
    resolveSessionPick(tabId, result.layout, result.panelConnections);
  }, [resolveSessionPick]);

  const handleLayoutChange = useCallback((layout: Layout) => {
    if (!activeTab) return;
    const { removed } = setLayout(activeTab.id, layout);
    removed
      .filter((p) => p.sessionId !== null)
      .forEach((p) => ipc.sessionKill(p.sessionId!).catch(() => {}));
    const removedNotePanelIds = removed
      .filter((p) => p.connection?.type === "note")
      .map((p) => p.id);
    if (removedNotePanelIds.length > 0) {
      useNoteStore.getState().removeNotes(removedNotePanelIds);
    }
    const removedBrowserPanelIds = removed
      .filter((p) => p.connection?.type === "browser")
      .map((p) => p.id);
    for (const id of removedBrowserPanelIds) {
      ipc.browserDestroy(`browser-${id}`).catch(() => {});
    }
  }, [activeTab, setLayout]);

  const handleToggleBroadcast = useCallback(() => {
    if (activeTab) toggleBroadcast(activeTab.id);
  }, [activeTab, toggleBroadcast]);

  const handleCloseCurrentTab = useCallback(() => {
    if (activeTab) removeTab(activeTab.id);
  }, [activeTab, removeTab]);

  const handleTogglePanelZoom = useCallback(() => {
    panelNavRef.current?.toggleZoom();
  }, []);

  const handlePrevTab = useCallback(() => {
    const idx = tabs.findIndex((t) => t.id === activeTabId);
    if (idx === -1 || tabs.length < 2) return;
    const prevIdx = (idx - 1 + tabs.length) % tabs.length;
    setActiveTab(tabs[prevIdx].id);
  }, [tabs, activeTabId, setActiveTab]);

  const handleNextTab = useCallback(() => {
    const idx = tabs.findIndex((t) => t.id === activeTabId);
    if (idx === -1 || tabs.length < 2) return;
    const nextIdx = (idx + 1) % tabs.length;
    setActiveTab(tabs[nextIdx].id);
  }, [tabs, activeTabId, setActiveTab]);

  const handleActivePanelChanged = useCallback((sessionId: string | null, panelId?: string) => {
    activePanelSessionIdRef.current = sessionId;
    activePanelIdRef.current = panelId ?? null;
    setActivePanelId(panelId ?? null);
  }, []);

  const handlePaletteClose = useCallback(() => {
    setPaletteOpen(false);
    requestAnimationFrame(() => {
      const sessionId = activePanelSessionIdRef.current;
      if (sessionId) terminalRegistry.get(sessionId)?.focus();
    });
  }, []);

  const tabPaletteSection = useMemo<PaletteSection>(() => ({
    category: "Tab",
    commands: [
      {
        id: "tab:new",
        label: "New Tab",
        description: "Open a new terminal tab",
        meta: "Ctrl+Shift+T",
        icon: (
          <span className="cp-cmd-icon">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </span>
        ),
        action: handleNewTab,
      },
      {
        id: "tab:close",
        label: "Close Current Tab",
        description: "Close the active tab",
        icon: (
          <span className="cp-cmd-icon">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M4 4l6 6M10 4l-6 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
          </span>
        ),
        action: handleCloseCurrentTab,
      },
      {
        id: "tab:broadcast",
        label: activeTab?.broadcastEnabled ? "Disable Broadcast" : "Enable Broadcast",
        description: "Send keyboard input to all panels in the current tab simultaneously",
        icon: (
          <span className="cp-cmd-icon">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="1.5" fill="currentColor" />
              <path d="M4 7a3 3 0 0 1 3-3M10 7a3 3 0 0 1-3 3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
              <path d="M1.5 7A5.5 5.5 0 0 1 7 1.5M12.5 7A5.5 5.5 0 0 1 7 12.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
            </svg>
          </span>
        ),
        isActive: activeTab?.broadcastEnabled,
        action: handleToggleBroadcast,
      },
      ...(tabs.length > 1 ? [
        {
          id: "tab:prev",
          label: "Previous Tab",
          description: "Switch to the tab on the left",
          icon: (
            <span className="cp-cmd-icon">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M8 3L4 7l4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                <rect x="9" y="3" width="2" height="8" rx="0.8" fill="currentColor" opacity="0.35" />
              </svg>
            </span>
          ),
          action: handlePrevTab,
        },
        {
          id: "tab:next",
          label: "Next Tab",
          description: "Switch to the tab on the right",
          icon: (
            <span className="cp-cmd-icon">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M6 3l4 4-4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                <rect x="3" y="3" width="2" height="8" rx="0.8" fill="currentColor" opacity="0.35" />
              </svg>
            </span>
          ),
          action: handleNextTab,
        },
      ] : []),
      {
        id: "view:toolkit",
        label: sidebarOpen ? "Hide Toolkit" : "Show Toolkit",
        description: "Toggle the side panel with notes, timers, and tools",
        meta: "Ctrl+Shift+N",
        icon: (
          <span className="cp-cmd-icon">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="1" y="1" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.1" />
              <rect x="8" y="1" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.1" />
              <rect x="1" y="8" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.1" />
              <rect x="8" y="8" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.1" />
            </svg>
          </span>
        ),
        isActive: sidebarOpen,
        action: handleToggleToolkit,
      },
      {
        id: "ssh:profiles",
        label: "SSH Profiles",
        description: "Manage and connect to saved SSH servers",
        icon: (
          <span className="cp-cmd-icon">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="1" y="3" width="12" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
              <path d="M1 5.5h12" stroke="currentColor" strokeWidth="1.3" />
              <circle cx="3" cy="4.25" r="0.6" fill="currentColor" />
              <circle cx="5" cy="4.25" r="0.6" fill="currentColor" />
              <path d="M3.5 8.5l2 1.5-2 1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M8 11.5h2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </span>
        ),
        action: () => setSshModalOpen(true),
      },
      {
        id: "settings",
        label: "Settings",
        description: "Configure appearance, terminal, and font settings",
        icon: (
          <span className="cp-cmd-icon">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="2.5" stroke="currentColor" strokeWidth="1.3" />
              <path d="M7 1v1.5M7 11.5V13M1 7h1.5M11.5 7H13M3.05 3.05l1.06 1.06M9.89 9.89l1.06 1.06M10.95 3.05l-1.06 1.06M4.11 9.89l-1.06 1.06" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
          </span>
        ),
        action: () => setSettingsModalOpen(true),
      },
      ...(activeTab && activeTab.panels.length > 1 ? [
        {
          id: "panel:zoom",
          label: "Zoom Current Panel",
          description: "Toggle fullscreen for the focused panel",
          icon: (
            <span className="cp-cmd-icon">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M1 5V2h3M10 2h3v3M13 9v3h-3M4 13H1v-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          ),
          action: handleTogglePanelZoom,
        },
        {
          id: "panel:prev",
          label: "Previous Panel",
          description: "Move focus to the previous panel",
          icon: (
            <span className="cp-cmd-icon">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <rect x="1" y="1" width="5.5" height="12" rx="1" stroke="currentColor" strokeWidth="1.2" />
                <rect x="7.5" y="1" width="5.5" height="12" rx="1" stroke="currentColor" strokeWidth="1.2" opacity="0.4" />
                <path d="M4.5 7H11M4.5 7L6.5 5M4.5 7L6.5 9" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          ),
          action: () => panelNavRef.current?.prevPanel(),
        },
        {
          id: "panel:next",
          label: "Next Panel",
          description: "Move focus to the next panel",
          icon: (
            <span className="cp-cmd-icon">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <rect x="1" y="1" width="5.5" height="12" rx="1" stroke="currentColor" strokeWidth="1.2" opacity="0.4" />
                <rect x="7.5" y="1" width="5.5" height="12" rx="1" stroke="currentColor" strokeWidth="1.2" />
                <path d="M9.5 7H3M9.5 7L7.5 5M9.5 7L7.5 9" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          ),
          action: () => panelNavRef.current?.nextPanel(),
        },
      ] : []),
    ],
  }), [handleNewTab, handleToggleBroadcast, handleCloseCurrentTab, handleTogglePanelZoom, handlePrevTab, handleNextTab, handleToggleToolkit, activeTab, tabs, sidebarOpen]);

  const tabListPaletteSection = useMemo<PaletteSection>(() => ({
    category: "Tab List",
    commands: tabs.map((tab) => ({
      id: `tab:switch:${tab.id}`,
      label: tab.label,
      icon: (
        <span className="cp-cmd-icon">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <rect x="1" y="3" width="12" height="9" rx="1.2" stroke="currentColor" strokeWidth="1.2" />
            <path d="M1 6h12" stroke="currentColor" strokeWidth="1.2" />
            <path d="M4 4.5V1.5M10 4.5V1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </span>
      ),
      isActive: tab.id === activeTabId,
      action: () => setActiveTab(tab.id),
    })),
  }), [tabs, activeTabId, setActiveTab]);

  const layoutPaletteSection = useMemo<PaletteSection>(() => {
    const LAYOUT_OPTIONS: Array<{ value: Layout; label: string; icon: React.ReactNode }> = [
      {
        value: 1,
        label: "1 Panel",
        icon: (
          <span className="cp-cmd-icon">
            <svg width="16" height="12" viewBox="0 0 18 14" fill="none">
              <rect x="1" y="1" width="16" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
            </svg>
          </span>
        ),
      },
      {
        value: 2,
        label: "2 Panels",
        icon: (
          <span className="cp-cmd-icon">
            <svg width="16" height="12" viewBox="0 0 18 14" fill="none">
              <rect x="1" y="1" width="7" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
              <rect x="10" y="1" width="7" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
            </svg>
          </span>
        ),
      },
      {
        value: 3,
        label: "3 Panels",
        icon: (
          <span className="cp-cmd-icon">
            <svg width="16" height="12" viewBox="0 0 18 14" fill="none">
              <rect x="1" y="1" width="7" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
              <rect x="10" y="1" width="7" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.2" />
              <rect x="10" y="7.5" width="7" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.2" />
            </svg>
          </span>
        ),
      },
      {
        value: 4,
        label: "4 Panels",
        icon: (
          <span className="cp-cmd-icon">
            <svg width="16" height="12" viewBox="0 0 18 14" fill="none">
              <rect x="1" y="1" width="7" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.2" />
              <rect x="10" y="1" width="7" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.2" />
              <rect x="1" y="7.5" width="7" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.2" />
              <rect x="10" y="7.5" width="7" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.2" />
            </svg>
          </span>
        ),
      },
      {
        value: "4c",
        label: "4 Columns",
        icon: (
          <span className="cp-cmd-icon">
            <svg width="16" height="12" viewBox="0 0 22 14" fill="none">
              <rect x="1" y="1" width="4.25" height="12" rx="1" stroke="currentColor" strokeWidth="1.1" />
              <rect x="6.25" y="1" width="4.25" height="12" rx="1" stroke="currentColor" strokeWidth="1.1" />
              <rect x="11.5" y="1" width="4.25" height="12" rx="1" stroke="currentColor" strokeWidth="1.1" />
              <rect x="16.75" y="1" width="4.25" height="12" rx="1" stroke="currentColor" strokeWidth="1.1" />
            </svg>
          </span>
        ),
      },
      {
        value: 6,
        label: "6 Panels",
        icon: (
          <span className="cp-cmd-icon">
            <svg width="16" height="12" viewBox="0 0 20 14" fill="none">
              <rect x="1" y="1" width="5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.1" />
              <rect x="7.5" y="1" width="5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.1" />
              <rect x="14" y="1" width="5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.1" />
              <rect x="1" y="7.5" width="5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.1" />
              <rect x="7.5" y="7.5" width="5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.1" />
              <rect x="14" y="7.5" width="5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.1" />
            </svg>
          </span>
        ),
      },
      {
        value: 9,
        label: "9 Panels",
        icon: (
          <span className="cp-cmd-icon">
            <svg width="14" height="14" viewBox="0 0 20 16" fill="none">
              {[0, 1, 2].map((col) =>
                [0, 1, 2].map((row) => (
                  <rect
                    key={`${col}-${row}`}
                    x={1 + col * 6.5}
                    y={1 + row * 4.8}
                    width="5"
                    height="3.6"
                    rx="0.8"
                    stroke="currentColor"
                    strokeWidth="1"
                  />
                ))
              )}
            </svg>
          </span>
        ),
      },
    ];

    return {
      category: "Layout",
      commands: LAYOUT_OPTIONS.map(({ value, label, icon }) => ({
        id: `layout:${value}`,
        label,
        description: `Split the current tab into ${label.toLowerCase()}`,
        icon,
        isActive: activeTab?.layout === value,
        action: () => handleLayoutChange(value),
      })),
    };
  }, [activeTab, handleLayoutChange]);

  const clipboardEntries = useClipboardStore((s) => s.entries);
  const clearClipboardHistory = useClipboardStore((s) => s.clearHistory);

  const clipboardPaletteSection = useMemo<PaletteSection>(() => {
    const commands = clipboardEntries.map((entry) => {
      const preview = entry.text.split("\n")[0].slice(0, 80);
      return {
        id: `clip:${entry.id}`,
        label: preview,
        meta: formatRelativeTime(entry.copiedAt),
        icon: (
          <span className="cp-cmd-icon">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="3" y="1" width="8" height="2" rx="1" stroke="currentColor" strokeWidth="1.1" />
              <rect x="2" y="2.5" width="10" height="10.5" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
            </svg>
          </span>
        ),
        action: async () => {
          try {
            await writeText(entry.text);
          } catch {
            // write failed — silently ignore
          }
        },
      };
    });

    // Add "Clear History" action at the end if there are entries
    if (clipboardEntries.length > 0) {
      commands.push({
        id: "clip:clear",
        label: "Clear Clipboard History",
        meta: "",
        icon: (
          <span className="cp-cmd-icon">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3 4h8M5.5 4V3h3v1M4 4v7.5a1 1 0 001 1h4a1 1 0 001-1V4" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        ),
        action: async () => { clearClipboardHistory(); },
      });
    }

    return { category: "Clipboard", commands };
  }, [clipboardEntries, clearClipboardHistory]);

  const cheatsheetPaletteSection = useMemo<PaletteSection>(() => {
    const cheatsheetIcon = (
      <span className="cp-cmd-icon">
        <svg width="14" height="14" viewBox="0 0 15 15" fill="none">
          <path d="M5.5 3.5L2.5 7.5l3 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M9.5 3.5l3 4-3 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </span>
    );

    // Topic list (no topic selected yet)
    if (!cheatsheetTopic) {
      // Topic entries for browsing
      const topicCommands = allTopics.map((topic) => ({
        id: `cheatsheet-topic:${topic.id}`,
        label: topic.name,
        description: `Browse ${topic.name} cheatsheet`,
        icon: cheatsheetIcon,
        action: () => {}, // handled by CommandPalette drill-down
      }));

      // Also include ALL items from ALL topics for cross-topic fuzzy search
      // (these only appear when user types a query like `?rebase`)
      const allItems = allTopics.flatMap((topic) =>
        topic.categories.flatMap((cat) =>
          cat.items.map((item) => ({
            id: `cheatsheet:${topic.id}:${cat.name}:${item.command}`,
            label: item.command,
            description: item.description,
            meta: `${topic.name} — ${cat.name}`,
            icon: cheatsheetIcon,
            action: async () => {
              try { await writeText(item.command); } catch {}
            },
          }))
        )
      );

      return {
        category: "Cheatsheet Topics",
        commands: [...topicCommands, ...allItems],
      };
    }

    // Specific topic selected — show all items grouped by category
    const topic = allTopics.find((t) => t.id === cheatsheetTopic);
    if (!topic) return { category: "Cheatsheet", commands: [] };

    const commands = topic.categories.flatMap((cat) =>
      cat.items.map((item) => ({
        id: `cheatsheet:${topic.id}:${cat.name}:${item.command}`,
        label: item.command,
        description: item.description,
        meta: cat.name,
        icon: cheatsheetIcon,
        action: async () => {
          try {
            await writeText(item.command);
          } catch {
            // write failed
          }
        },
      }))
    );

    return { category: "Cheatsheet", commands };
  }, [cheatsheetTopic]);

  const activePanel = useMemo(() => {
    if (!activeTab || !activePanelId) return null;
    return activeTab.panels.find((p) => p.id === activePanelId) ?? null;
  }, [activeTab, activePanelId]);

  const [wslDistros, setWslDistros] = useState<string[]>([]);
  useEffect(() => {
    ipc.getWslDistros().then(setWslDistros).catch(() => setWslDistros([]));
  }, []);

  const switchConnectionPaletteSection = useMemo<PaletteSection | null>(() => {
    if (!activeTab || !activePanelId) return null;

    const conn = activePanel?.connection;
    const connType = conn?.type ?? "local";

    const isActiveLocal = connType === "local";

    const commands = [
      // Local Shell
      {
        id: "conn:local",
        label: "Local Shell",
        description: "Switch to a local terminal session",
        meta: "PowerShell",
        icon: (
          <span className="cp-cmd-icon">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="1" y="2" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
              <path d="M3.5 6l2 1.5-2 1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M7.5 9.5h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </span>
        ),
        isActive: isActiveLocal,
        action: () => {
          if (isActiveLocal) return; // no-op if already active
          // Clean up note data if switching away from note panel
          if (connType === "note") {
            useNoteStore.getState().removeNote(activePanelId);
          }
          if (connType === "browser") {
            ipc.browserDestroy(`browser-${activePanelId}`).catch(() => {});
          }
          switchPanelConnection(activeTab.id, activePanelId, { type: "local" });
        },
      },
      // Note
      {
        id: "conn:note",
        label: "Note",
        description: "Switch to a markdown note editor",
        meta: "Markdown",
        icon: (
          <span className="cp-cmd-icon">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="2" y="1" width="10" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
              <line x1="4.5" y1="4" x2="9.5" y2="4" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
              <line x1="4.5" y1="6.5" x2="9.5" y2="6.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
              <line x1="4.5" y1="9" x2="7.5" y2="9" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
            </svg>
          </span>
        ),
        isActive: connType === "note",
        action: () => {
          if (connType === "note") return;
          if (connType === "browser") {
            ipc.browserDestroy(`browser-${activePanelId}`).catch(() => {});
          }
          switchPanelConnection(activeTab.id, activePanelId, { type: "note" });
        },
      },
      // Browser
      {
        id: "conn:browser",
        label: "Browser",
        description: "Open a web browser in this panel",
        meta: "Web",
        icon: (
          <span className="cp-cmd-icon">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.2" />
              <ellipse cx="7" cy="7" rx="2.5" ry="5.5" stroke="currentColor" strokeWidth="1" />
              <line x1="1.5" y1="7" x2="12.5" y2="7" stroke="currentColor" strokeWidth="1" />
            </svg>
          </span>
        ),
        isActive: connType === "browser",
        action: () => {
          if (connType === "browser") return;
          if (connType === "note") {
            useNoteStore.getState().removeNote(activePanelId);
          }
          switchPanelConnection(activeTab.id, activePanelId, { type: "browser" });
        },
      },
      // WSL distros
      ...wslDistros.map((distro) => {
        const isActiveWsl = connType === "wsl"
          && conn?.wslDistro === distro;
        return {
          id: `conn:wsl:${distro}`,
          label: distro,
          description: `Switch to WSL: ${distro}`,
          meta: "WSL",
          icon: (
            <span className="cp-cmd-icon">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.2" />
                <path d="M4 5.5c.5-1 1.5-1.5 3-1.5s2.5.5 3 1.5M4 8.5c.5 1 1.5 1.5 3 1.5s2.5-.5 3-1.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
              </svg>
            </span>
          ),
          isActive: isActiveWsl,
          action: () => {
            if (isActiveWsl) return;
            // Clean up note data if switching away from note panel
            if (connType === "note") {
              useNoteStore.getState().removeNote(activePanelId);
            }
            if (connType === "browser") {
              ipc.browserDestroy(`browser-${activePanelId}`).catch(() => {});
            }
            switchPanelConnection(activeTab.id, activePanelId, {
              type: "wsl",
              wslDistro: distro,
            });
          },
        };
      }),
      // SSH profiles
      ...sshProfiles.map((profile) => {
        const isActiveSsh = connType === "ssh" && conn?.sshProfileId === profile.id;
        return {
          id: `conn:ssh:${profile.id}`,
          label: profile.name,
          description: `Switch to SSH: ${profile.username}@${profile.host}${profile.port !== 22 ? `:${profile.port}` : ""}`,
          meta: `${profile.username}@${profile.host}`,
          icon: (
            <span className="cp-cmd-icon">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <rect x="1" y="3" width="12" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
                <path d="M1 5.5h12" stroke="currentColor" strokeWidth="1.3" />
                <circle cx="3" cy="4.25" r="0.6" fill="currentColor" />
                <circle cx="5" cy="4.25" r="0.6" fill="currentColor" />
                <path d="M3.5 8.5l2 1.5-2 1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M8 11.5h2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
            </span>
          ),
          isActive: isActiveSsh,
          action: () => {
            if (isActiveSsh) return;
            // Clean up note data if switching away from note panel
            if (connType === "note") {
              useNoteStore.getState().removeNote(activePanelId);
            }
            if (connType === "browser") {
              ipc.browserDestroy(`browser-${activePanelId}`).catch(() => {});
            }
            switchPanelConnection(activeTab.id, activePanelId, {
              type: "ssh",
              sshProfileId: profile.id,
            });
          },
        };
      }),
    ];

    return { category: "Switch Connection", commands };
  }, [activeTab, activePanelId, activePanel, switchPanelConnection, wslDistros, sshProfiles]);

  const handleTabClose = (tabId: string) => {
    const tab = tabs.find((t) => t.id === tabId);
    if (tab) {
      const notePanelIds = tab.panels
        .filter((p) => p.connection?.type === "note")
        .map((p) => p.id);
      if (notePanelIds.length > 0) {
        useNoteStore.getState().removeNotes(notePanelIds);
      }
      const browserPanelIds = tab.panels
        .filter((p) => p.connection?.type === "browser")
        .map((p) => p.id);
      for (const id of browserPanelIds) {
        ipc.browserDestroy(`browser-${id}`).catch(() => {});
      }
    }
    removeTab(tabId);
  };

  const handleTabKill = (tabId: string) => {
    const tab = tabs.find((t) => t.id === tabId);
    if (tab) {
      tab.panels
        .filter((p) => p.sessionId !== null)
        .forEach((p) => ipc.sessionKill(p.sessionId!).catch(() => {}));
      const notePanelIds = tab.panels
        .filter((p) => p.connection?.type === "note")
        .map((p) => p.id);
      if (notePanelIds.length > 0) {
        useNoteStore.getState().removeNotes(notePanelIds);
      }
      const browserPanelIds = tab.panels
        .filter((p) => p.connection?.type === "browser")
        .map((p) => p.id);
      for (const id of browserPanelIds) {
        ipc.browserDestroy(`browser-${id}`).catch(() => {});
      }
    }
    removeTab(tabId);
  };

  return (
    <div className="app">
      <TitleBar />
      <div className="topbar">
        <TabBar
          onCloseTab={handleTabClose}
          onKillTab={handleTabKill}
          onActivateTab={activateTab}
          onOpenPalette={() => setPaletteOpen(true)}
        />
        <SplitToolbar
          activeLayout={activeTab?.layout ?? 1}
          broadcastEnabled={activeTab?.broadcastEnabled ?? false}
          sidebarOpen={sidebarOpen}
          onLayoutChange={handleLayoutChange}
          onToggleBroadcast={handleToggleBroadcast}
          onToggleToolkit={handleToggleToolkit}
          onOpenPalette={() => setPaletteOpen(true)}
          onOpenSshManager={() => setSshModalOpen(true)}
          onOpenSettings={() => setSettingsModalOpen(true)}
          onAddTab={handleNewTab}
        />
      </div>
      <div className="app-content">
        <div className="app-terminal-area">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className="tab-viewport"
            style={{ display: tab.id === activeTabId ? "flex" : "none" }}
          >
            {tab.pendingSessionPick ? (
              <SessionPicker
                onNewSession={(result) => handleNewSession(tab.id, result)}
              />
            ) : (
              <PanelGrid
                tab={tab}
                isVisible={tab.id === activeTabId}
                overlayActive={paletteOpen || settingsModalOpen || sshModalOpen}
                onActivePanelChanged={tab.id === activeTabId ? handleActivePanelChanged : undefined}
                navRef={tab.id === activeTabId ? panelNavRef : undefined}
              />
            )}
          </div>
        ))}
        </div>
        {sidebarOpen && (
          <SidePanel
            activeTab={sidebarTab}
            onTabChange={handleSidebarTabChange}
            onClose={handleCloseSidebar}
          />
        )}
      </div>{/* end app-content */}
      {sshModalOpen && (
        <SshManagerModal
          onClose={() => setSshModalOpen(false)}
        />
      )}
      <SettingsModal
        isOpen={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
      />
      <CommandPalette
        isOpen={paletteOpen}
        onClose={handlePaletteClose}
        onCheatsheetTopicChange={setCheatsheetTopic}
        extraSections={[
          tabPaletteSection,
          tabListPaletteSection,
          ...(switchConnectionPaletteSection ? [switchConnectionPaletteSection] : []),
          layoutPaletteSection,
          clipboardPaletteSection,
          cheatsheetPaletteSection,
        ]}
      />
      {showWelcome && <WelcomePage onDone={handleWelcomeDone} />}
    </div>
  );
}
