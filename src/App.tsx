import { useCallback, useEffect, useRef, useState } from "react";
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
import { useTabStore } from "./store/tabStore";
import { useThemeStore, resolveThemeDefinition } from "./store/themeStore";
import { ipc } from "./lib/tauriIpc";
import { terminalRegistry } from "./components/TerminalPane/TerminalPane";
import type { Layout, SshProfile } from "./types/terminal";
import "./styles/theme.css";
import "./styles/globals.css";
import "./App.css";

export function App() {
  const { tabs, activeTabId, savedTabs, addTab, removeTab, saveAndRemoveTab, removeSavedTab, restoreSavedTab, setLayout, toggleBroadcast, resolveSessionPick, setActiveTab, saveAllOpenTabsToBackground } =
    useTabStore();
  const { themeId } = useThemeStore();

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? tabs[0];
  const [sshModalOpen, setSshModalOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const activePanelPtyIdRef = useRef<string | null>(null);

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
          fn(); // cleanup이 먼저 실행된 경우 즉시 해제
        } else {
          unlistenFn = fn;
        }
      });
    return () => {
      cancelled = true;
      unlistenFn?.();
    };
  }, [saveAllOpenTabsToBackground]);

  const handleLayoutChange = (layout: Layout) => {
    if (!activeTab) return;
    setLayout(activeTab.id, layout);
  };

  const handleToggleBroadcast = () => {
    if (activeTab) toggleBroadcast(activeTab.id);
  };

  const buildSshCommand = (profile: SshProfile) => {
    let cmd = `ssh ${profile.username}@${profile.host}`;
    if (profile.port !== 22) cmd += ` -p ${profile.port}`;
    if (profile.identityFile) cmd += ` -i "${profile.identityFile}"`;
    return cmd;
  };

  const handleSshConnectInPanel = (profile: SshProfile) => {
    const ptyId = activePanelPtyIdRef.current;
    if (!ptyId) return;
    const cmd = buildSshCommand(profile);
    const encoded = new TextEncoder().encode(cmd + "\r");
    ipc.daemonWrite(ptyId, encoded).catch(() => {});
    setSshModalOpen(false);
  };

  const handleSshConnectInAllPanels = (profile: SshProfile) => {
    if (!activeTab) return;
    const cmd = buildSshCommand(profile);
    const encoded = new TextEncoder().encode(cmd + "\r");
    activeTab.panels
      .filter((p) => p.ptyId !== null)
      .forEach((p) => ipc.daemonWrite(p.ptyId!, encoded).catch(() => {}));
    setSshModalOpen(false);
  };

  const handleSshConnect = async (profile: SshProfile) => {
    let cwd: string;
    try {
      cwd = await homeDir();
    } catch {
      cwd = "~";
    }

    const cmd = buildSshCommand(profile);
    addTab(cwd, profile.name, cmd);
    setSshModalOpen(false);
  };

  const handleNewSession = (tabId: string, opts?: { shellProgram?: string; shellArgs?: string[]; sshCommand?: string; label?: string }) => {
    resolveSessionPick(tabId, undefined, opts?.shellProgram, opts?.shellArgs, opts?.sshCommand, opts?.label);
  };

  const handleTabClose = (tabId: string) => {
    // Save tab layout + sessions before removing so it can be restored from SessionPicker.
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
                onActivePanelChanged={tab.id === activeTabId ? (ptyId) => { activePanelPtyIdRef.current = ptyId; } : undefined}
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
      <CommandPalette isOpen={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
