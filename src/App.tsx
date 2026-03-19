import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
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
import { SidePanel } from "./components/SidePanel/SidePanel";
import type { SidebarTab } from "./components/SidePanel/SidePanel";
import { LeftBrowserPanel } from "./components/LeftBrowserPanel/LeftBrowserPanel";
import { WelcomePage } from "./components/WelcomePage/WelcomePage";
import { useOnboardingStore } from "./store/onboardingStore";
import type { PanelNavHandle } from "./components/PanelGrid/PanelGrid";
import { useAlarmTick } from "./hooks/useAlarmTick";
import { useClipboardPolling } from "./hooks/useClipboardPolling";
import { useMigrations } from "./hooks/useMigrations";
import { useGlobalKeyboardShortcuts } from "./hooks/useGlobalKeyboardShortcuts";
import { useThemeApplication } from "./hooks/useThemeApplication";
import { useClipboardStore } from "./store/clipboardStore";
import { useTabStore } from "./store/tabStore";
import { useThemeStore } from "./store/themeStore";
import { useTerminalConfigStore } from "./store/terminalConfigStore";
import { useSshStore } from "./store/sshStore";
import { ipc } from "./lib/tauriIpc";
import { terminalRegistry } from "./components/TerminalPane/TerminalPane";
import { cleanupNotePanels } from "./lib/noteCleanup";
import {
  buildTabSection,
  buildTabListSection,
  buildLayoutSection,
  buildClipboardSection,
  buildConnectionSection,
} from "./lib/paletteCommands";
import type { Layout } from "./types/terminal";
import "./styles/theme.css";
import "./styles/globals.css";
import "./App.css";

export function App() {
  const { t } = useTranslation();
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
    if (stored === "todos" || stored === "timers") return stored;
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
  const [browserPanelOpen, setBrowserPanelOpen] = useState(() => {
    return localStorage.getItem("v-terminal:browser-panel-open") === "true";
  });
  const activePanelSessionIdRef = useRef<string | null>(null);
  const activePanelIdRef = useRef<string | null>(null);
  const [activePanelId, setActivePanelId] = useState<string | null>(null);
  const panelNavRef = useRef<PanelNavHandle | null>(null);

  const showWelcome = !onboardingDone && tabs.some((t) => t.pendingSessionPick);

  const handleWelcomeDone = useCallback(() => {
    markOnboardingDone();
  }, [markOnboardingDone]);

  // ── Startup hooks ─────────────────────────────────────────────
  useMigrations();
  useAlarmTick();
  useClipboardPolling();
  useThemeApplication(themeId);

  // Prefetch WSL distros on startup
  useEffect(() => {
    ipc.getWslDistros().catch(() => {});
  }, []);

  // ── Sidebar & browser panel toggles ───────────────────────────

  const handleToggleToolkit = useCallback(() => {
    const next = !sidebarOpen;
    setSidebarOpen(next);
    localStorage.setItem("v-terminal:sidebar-open", String(next));
  }, [sidebarOpen]);

  const handleCloseSidebar = useCallback(() => {
    setSidebarOpen(false);
    localStorage.setItem("v-terminal:sidebar-open", "false");
  }, []);

  const handleToggleBrowserPanel = useCallback(() => {
    const next = !browserPanelOpen;
    setBrowserPanelOpen(next);
    localStorage.setItem("v-terminal:browser-panel-open", String(next));
  }, [browserPanelOpen]);

  const handleCloseBrowserPanel = useCallback(() => {
    setBrowserPanelOpen(false);
    localStorage.setItem("v-terminal:browser-panel-open", "false");
  }, []);

  const handleSidebarTabChange = useCallback((tab: SidebarTab) => {
    setSidebarTab(tab);
    localStorage.setItem("v-terminal:sidebar-tab", tab);
  }, []);

  // ── Global keyboard shortcuts ─────────────────────────────────

  const handleNewTab = useCallback(async () => {
    let cwd: string;
    try { cwd = await homeDir(); } catch { cwd = "~"; }
    addTab(cwd);
  }, [addTab]);

  useGlobalKeyboardShortcuts(
    useMemo(() => ({
      togglePalette: () => setPaletteOpen((open) => !open),
      newTab: handleNewTab,
      toggleSidebar: () => {
        setSidebarOpen((prev) => {
          const next = !prev;
          localStorage.setItem("v-terminal:sidebar-open", String(next));
          return next;
        });
      },
      toggleBrowserPanel: () => {
        setBrowserPanelOpen((prev) => {
          const next = !prev;
          localStorage.setItem("v-terminal:browser-panel-open", String(next));
          return next;
        });
      },
      fontIncrease,
      fontDecrease,
      fontReset,
    }), [handleNewTab, fontIncrease, fontDecrease, fontReset]),
    showWelcome,
  );

  // ── Tab & panel actions ───────────────────────────────────────

  const activateTab = useCallback((tabId: string) => {
    setActiveTab(tabId);
  }, [setActiveTab]);

  const handleNewSession = useCallback((tabId: string, result: SessionPickResult) => {
    resolveSessionPick(tabId, result.layout, result.panelConnections);
  }, [resolveSessionPick]);

  const handleLayoutChange = useCallback((layout: Layout) => {
    if (!activeTab) return;
    const { removed } = setLayout(activeTab.id, layout);
    removed
      .filter((p) => p.sessionId !== null)
      .forEach((p) => ipc.sessionKill(p.sessionId!).catch(() => {}));
    cleanupNotePanels(removed);
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

  // ── Command palette sections ──────────────────────────────────

  const tabPaletteSection = useMemo(() => buildTabSection({
    activeTab,
    tabs,
    sidebarOpen,
    browserPanelOpen,
    panelCount: activeTab?.panels.length ?? 0,
    onNewTab: handleNewTab,
    onCloseTab: handleCloseCurrentTab,
    onToggleBroadcast: handleToggleBroadcast,
    onPrevTab: handlePrevTab,
    onNextTab: handleNextTab,
    onToggleToolkit: handleToggleToolkit,
    onToggleBrowserPanel: handleToggleBrowserPanel,
    onOpenSshProfiles: () => setSshModalOpen(true),
    onOpenSettings: () => setSettingsModalOpen(true),
    onTogglePanelZoom: handleTogglePanelZoom,
    onPrevPanel: () => panelNavRef.current?.prevPanel(),
    onNextPanel: () => panelNavRef.current?.nextPanel(),
  }, t), [handleNewTab, handleToggleBroadcast, handleCloseCurrentTab, handleTogglePanelZoom, handlePrevTab, handleNextTab, handleToggleToolkit, activeTab, tabs, sidebarOpen, browserPanelOpen, handleToggleBrowserPanel, t]);

  const tabListPaletteSection = useMemo(
    () => buildTabListSection(tabs, activeTabId, setActiveTab, t),
    [tabs, activeTabId, setActiveTab, t],
  );

  const layoutPaletteSection = useMemo(
    () => buildLayoutSection(activeTab, handleLayoutChange, t),
    [activeTab, handleLayoutChange, t],
  );

  const clipboardEntries = useClipboardStore((s) => s.entries);
  const clearClipboardHistory = useClipboardStore((s) => s.clearHistory);
  const clipboardPaletteSection = useMemo(
    () => buildClipboardSection(clipboardEntries, clearClipboardHistory, t),
    [clipboardEntries, clearClipboardHistory, t],
  );

  const activePanel = useMemo(() => {
    if (!activeTab || !activePanelId) return null;
    return activeTab.panels.find((p) => p.id === activePanelId) ?? null;
  }, [activeTab, activePanelId]);

  const [wslDistros, setWslDistros] = useState<string[]>([]);
  useEffect(() => {
    ipc.getWslDistros().then(setWslDistros).catch(() => setWslDistros([]));
  }, []);

  const switchConnectionPaletteSection = useMemo(
    () => buildConnectionSection({
      activeTab,
      activePanelId,
      activePanel,
      wslDistros,
      sshProfiles,
      switchPanelConnection,
    }, t),
    [activeTab, activePanelId, activePanel, switchPanelConnection, wslDistros, sshProfiles, t],
  );

  // ── Tab close / kill ──────────────────────────────────────────

  const handleTabClose = (tabId: string) => {
    const tab = tabs.find((t) => t.id === tabId);
    if (tab) cleanupNotePanels(tab.panels);
    removeTab(tabId);
  };

  const handleTabKill = (tabId: string) => {
    const tab = tabs.find((t) => t.id === tabId);
    if (tab) {
      tab.panels
        .filter((p) => p.sessionId !== null)
        .forEach((p) => ipc.sessionKill(p.sessionId!).catch(() => {}));
      cleanupNotePanels(tab.panels);
    }
    removeTab(tabId);
  };

  // ── Render ────────────────────────────────────────────────────

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
        <LeftBrowserPanel
          isVisible={browserPanelOpen}
          overlayActive={paletteOpen || settingsModalOpen || sshModalOpen || showWelcome}
          onClose={handleCloseBrowserPanel}
        />
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
        extraSections={[
          tabPaletteSection,
          tabListPaletteSection,
          ...(switchConnectionPaletteSection ? [switchConnectionPaletteSection] : []),
          layoutPaletteSection,
          clipboardPaletteSection,
        ]}
      />
      {showWelcome && <WelcomePage onDone={handleWelcomeDone} />}
    </div>
  );
}
