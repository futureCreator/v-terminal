import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { homeDir } from "@tauri-apps/api/path";
import { TitleBar } from "./components/TitleBar/TitleBar";
import { TabBar } from "./components/TabBar/TabBar";
import { SplitToolbar } from "./components/SplitToolbar/SplitToolbar";
import { PanelGrid } from "./components/PanelGrid/PanelGrid";
import { SessionPicker } from "./components/SessionPicker/SessionPicker";
import { SshManagerModal } from "./components/SshManager/SshManagerModal";
import { DaemonStatusBanner } from "./components/DaemonStatusBanner/DaemonStatusBanner";
import { CommandPalette } from "./components/CommandPalette/CommandPalette";
import type { PaletteSection } from "./components/CommandPalette/CommandPalette";
import type { PanelNavHandle } from "./components/PanelGrid/PanelGrid";
import { useTabStore } from "./store/tabStore";
import { useThemeStore, resolveThemeDefinition } from "./store/themeStore";
import { useSshStore } from "./store/sshStore";
import { ipc } from "./lib/tauriIpc";
import { buildSshCommand } from "./lib/sshUtils";
import { terminalRegistry } from "./components/TerminalPane/TerminalPane";
import type { Layout, SshProfile } from "./types/terminal";
import "./styles/theme.css";
import "./styles/globals.css";
import "./App.css";

const encoder = new TextEncoder();

export function App() {
  const { tabs, activeTabId, savedTabs, addTab, removeTab, saveAndRemoveTab, removeSavedTab, restoreSavedTab, setLayout, toggleBroadcast, resolveSessionPick, setActiveTab, saveAllOpenTabsToBackground } =
    useTabStore();
  const { themeId } = useThemeStore();
  const { profiles: sshProfiles } = useSshStore();

  const activeTab = useMemo(
    () => tabs.find((t) => t.id === activeTabId) ?? tabs[0],
    [tabs, activeTabId]
  );

  const [sshModalOpen, setSshModalOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const activePanelPtyIdRef = useRef<string | null>(null);
  const panelNavRef = useRef<PanelNavHandle | null>(null);

  // Prefetch WSL distros on startup to warm the Rust-side cache
  useEffect(() => {
    ipc.getWslDistros().catch(() => {});
  }, []);

  // Global Ctrl+K handler — intercept before xterm sees the event
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "k") {
        e.preventDefault();
        e.stopPropagation();
        setPaletteOpen((open) => !open);
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

  const handleLayoutChange = useCallback((layout: Layout) => {
    if (!activeTab) return;
    setLayout(activeTab.id, layout);
  }, [activeTab, setLayout]);

  const handleToggleBroadcast = useCallback(() => {
    if (activeTab) toggleBroadcast(activeTab.id);
  }, [activeTab, toggleBroadcast]);

  const handleSshConnect = useCallback(async (profile: SshProfile) => {
    let cwd: string;
    try { cwd = await homeDir(); } catch { cwd = "~"; }
    addTab(cwd, profile.name, buildSshCommand(profile));
    setSshModalOpen(false);
  }, [addTab]);

  const handleSshConnectInPanel = useCallback((profile: SshProfile) => {
    const ptyId = activePanelPtyIdRef.current;
    if (!ptyId) return;
    ipc.daemonWrite(ptyId, encoder.encode(buildSshCommand(profile) + "\r")).catch(() => {});
    setSshModalOpen(false);
  }, []);

  const handleSshConnectInAllPanels = useCallback((profile: SshProfile) => {
    if (!activeTab) return;
    const encoded = encoder.encode(buildSshCommand(profile) + "\r");
    activeTab.panels
      .filter((p) => p.ptyId !== null)
      .forEach((p) => ipc.daemonWrite(p.ptyId!, encoded).catch(() => {}));
    setSshModalOpen(false);
  }, [activeTab]);

  const handleCloseCurrentTab = useCallback(() => {
    if (activeTab) saveAndRemoveTab(activeTab.id);
  }, [activeTab, saveAndRemoveTab]);

  const handleTogglePanelZoom = useCallback(() => {
    panelNavRef.current?.toggleZoom();
  }, []);

  const handleActivePanelChanged = useCallback((ptyId: string | null) => {
    activePanelPtyIdRef.current = ptyId;
  }, []);

  const handlePaletteClose = useCallback(() => {
    setPaletteOpen(false);
    requestAnimationFrame(() => {
      const ptyId = activePanelPtyIdRef.current;
      if (ptyId) terminalRegistry.get(ptyId)?.focus();
    });
  }, []);

  const tabPaletteSection = useMemo<PaletteSection>(() => ({
    category: "Tab",
    commands: [
      {
        id: "tab:close",
        label: "Close Current Tab",
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
        id: "tab:new",
        label: "New Tab",
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
        id: "tab:broadcast",
        label: activeTab?.broadcastEnabled ? "Disable Broadcast" : "Enable Broadcast",
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
      ...(activeTab && activeTab.panels.length > 1 ? [
        {
          id: "panel:zoom",
          label: "Zoom Current Panel",
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
  }), [handleNewTab, handleToggleBroadcast, handleCloseCurrentTab, handleTogglePanelZoom, activeTab]);

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
        icon,
        isActive: activeTab?.layout === value,
        action: () => handleLayoutChange(value),
      })),
    };
  }, [activeTab, handleLayoutChange]);

  const sshPaletteSection = useMemo<PaletteSection | null>(() => {
    if (sshProfiles.length === 0) return null;
    return {
      category: "SSH",
      commands: sshProfiles.map((profile) => ({
        id: `ssh:${profile.id}`,
        label: profile.name,
        icon: (
          <span className="cp-cmd-icon">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="1" y="4" width="12" height="7" rx="1.2" stroke="currentColor" strokeWidth="1.2" />
              <path d="M4 4V3a3 3 0 0 1 6 0v1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              <circle cx="7" cy="7.5" r="1" fill="currentColor" />
            </svg>
          </span>
        ),
        action: () => handleSshConnect(profile),
      })),
    };
  }, [sshProfiles, handleSshConnect]);

  // 앱 종료 시 열려있는 탭을 모두 백그라운드로 저장
  useEffect(() => {
    let cancelled = false;
    let unlistenFn: (() => void) | null = null;
    getCurrentWindow()
      .onCloseRequested(() => {
        saveAllOpenTabsToBackground();
      })
      .then((fn) => {
        if (cancelled) {
          fn();
        } else {
          unlistenFn = fn;
        }
      });
    return () => {
      cancelled = true;
      unlistenFn?.();
    };
  }, [saveAllOpenTabsToBackground]);

  const handleNewSession = (tabId: string, opts?: { shellProgram?: string; shellArgs?: string[]; sshCommand?: string; label?: string }) => {
    resolveSessionPick(tabId, undefined, opts?.shellProgram, opts?.shellArgs, opts?.sshCommand, opts?.label);
  };

  const handleTabClose = (tabId: string) => {
    saveAndRemoveTab(tabId);
  };

  const handleTabKill = async (tabId: string) => {
    const tab = tabs.find((t) => t.id === tabId);
    if (tab) {
      await Promise.all(
        tab.panels
          .filter((p) => p.ptyId !== null)
          .map((p) => ipc.daemonKillSession(p.ptyId!).catch(() => {}))
      );
    }
    removeTab(tabId);
  };

  const handleRestoreTab = (savedTabId: string) => {
    restoreSavedTab(savedTabId);
  };

  const handleKillSavedTab = async (savedTabId: string) => {
    const saved = savedTabs.find((t) => t.id === savedTabId);
    if (saved) {
      await Promise.all(saved.panels.map((p) => ipc.daemonKillSession(p.ptyId).catch(() => {})));
    }
    removeSavedTab(savedTabId);
  };

  return (
    <div className="app">
      <TitleBar />
      <div className="topbar">
        <TabBar
          onOpenSshManager={() => setSshModalOpen(true)}
          onCloseTab={handleTabClose}
          onKillTab={handleTabKill}
          onActivateTab={activateTab}
        />
        <SplitToolbar
          activeLayout={activeTab?.layout ?? 1}
          broadcastEnabled={activeTab?.broadcastEnabled ?? false}
          onLayoutChange={handleLayoutChange}
          onToggleBroadcast={handleToggleBroadcast}
          onOpenPalette={() => setPaletteOpen(true)}
        />
      </div>
      <div className="app-content">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className="tab-viewport"
            style={{ display: tab.id === activeTabId ? "flex" : "none" }}
          >
            {tab.pendingSessionPick ? (
              <SessionPicker
                onNewSession={(opts) => handleNewSession(tab.id, opts)}
                savedTabs={savedTabs}
                onRestoreTab={handleRestoreTab}
                onKillSavedTab={handleKillSavedTab}
              />
            ) : (
              <PanelGrid
                tab={tab}
                onActivePanelChanged={tab.id === activeTabId ? handleActivePanelChanged : undefined}
                navRef={tab.id === activeTabId ? panelNavRef : undefined}
              />
            )}
          </div>
        ))}
      </div>
      {sshModalOpen && (
        <SshManagerModal
          onClose={() => setSshModalOpen(false)}
          onConnect={handleSshConnect}
          onConnectInPanel={handleSshConnectInPanel}
          onConnectInAllPanels={activeTab && activeTab.panels.length > 1 ? handleSshConnectInAllPanels : undefined}
        />
      )}
      <DaemonStatusBanner />
      <CommandPalette
        isOpen={paletteOpen}
        onClose={handlePaletteClose}
        extraSections={[
          tabPaletteSection,
          tabListPaletteSection,
          layoutPaletteSection,
          ...(sshPaletteSection ? [sshPaletteSection] : []),
        ]}
      />
    </div>
  );
}
