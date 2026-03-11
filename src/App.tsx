import { useCallback, useEffect, useRef, useState } from "react";
import { homeDir } from "@tauri-apps/api/path";
import { TitleBar } from "./components/TitleBar/TitleBar";
import { TabBar } from "./components/TabBar/TabBar";
import { SplitToolbar } from "./components/SplitToolbar/SplitToolbar";
import { PanelGrid } from "./components/PanelGrid/PanelGrid";
import { SessionPicker } from "./components/SessionPicker/SessionPicker";
import { SshManagerModal } from "./components/SshManager/SshManagerModal";
import { useTabStore } from "./store/tabStore";
import { ipc } from "./lib/tauriIpc";
import type { Layout, SshProfile } from "./types/terminal";
import "./styles/theme.css";
import "./styles/globals.css";
import "./App.css";

export function App() {
  const { tabs, activeTabId, addTab, removeTab, setLayout, toggleBroadcast, resolveSessionPick, setActiveTab } =
    useTabStore();

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? tabs[0];
  const [sshModalOpen, setSshModalOpen] = useState(false);
  const activePanelPtyIdRef = useRef<string | null>(null);

  const activateTab = useCallback((tabId: string) => {
    setActiveTab(tabId);
  }, [setActiveTab]);

  // Ctrl+Tab / Ctrl+Shift+Tab: cycle through tabs
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!e.ctrlKey || e.key !== "Tab") return;
      e.preventDefault();
      const currentIndex = tabs.findIndex((t) => t.id === activeTabId);
      if (currentIndex === -1 || tabs.length <= 1) return;
      const nextIndex = e.shiftKey
        ? (currentIndex - 1 + tabs.length) % tabs.length
        : (currentIndex + 1) % tabs.length;
      activateTab(tabs[nextIndex].id);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [tabs, activeTabId, activateTab]);

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

  const tabGroups = tabs
    .filter((t) => !t.pendingSessionPick)
    .map((t) => ({
      tabId: t.id,
      label: t.label,
      ptyIds: t.panels.map((p) => p.ptyId).filter((id): id is string => id !== null),
    }))
    .filter((g) => g.ptyIds.length > 0);

  const handleNewSession = (tabId: string, opts?: { shellProgram?: string; shellArgs?: string[]; sshCommand?: string; label?: string }) => {
    resolveSessionPick(tabId, undefined, opts?.shellProgram, opts?.shellArgs, opts?.sshCommand, opts?.label);
  };

  const handleAttachSession = (tabId: string, sessionId: string) => {
    resolveSessionPick(tabId, sessionId);
  };

  const handleTabClose = (tabId: string) => {
    // Don't kill sessions — TerminalPane cleanup handles detach automatically.
    // Detached sessions remain available in the session picker.
    removeTab(tabId);
  };

  return (
    <div className="app">
      <TitleBar />
      <div className="topbar">
        <TabBar
          onOpenSshManager={() => setSshModalOpen(true)}
          onCloseTab={handleTabClose}
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
                onAttach={(sessionId) => handleAttachSession(tab.id, sessionId)}
                onKill={(sessionId) => ipc.daemonKillSession(sessionId).catch(() => {})}
                tabGroups={tabGroups}
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
        />
      )}
    </div>
  );
}
