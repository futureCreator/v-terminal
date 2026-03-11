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
  const { tabs, activeTabId, addTab, removeTab, setLayout, toggleBroadcast, restoreFromSession, resolveSessionPick, setActiveTab, setTabActivity } =
    useTabStore();

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? tabs[0];
  const sessionLoaded = useRef(false);
  const [sshModalOpen, setSshModalOpen] = useState(false);
  const activePanelPtyIdRef = useRef<string | null>(null);
  const [receivingTabs, setReceivingTabs] = useState<Set<string>>(new Set());
  const activityTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const activeTabIdRef = useRef(activeTabId);
  activeTabIdRef.current = activeTabId;

  // Load persisted session on mount
  useEffect(() => {
    ipc.loadSession().then((session) => {
      if (session && session.tabs.length > 0) {
        restoreFromSession(session.tabs, session.activeTabId);
      }
    }).catch(() => {
      // First launch, no session file
    }).finally(() => {
      sessionLoaded.current = true;
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-save session whenever tabs or activeTabId changes
  useEffect(() => {
    if (!sessionLoaded.current) return;
    const sessionData = {
      tabs: tabs.map((t) => ({
        id: t.id,
        label: t.label,
        cwd: t.cwd,
        layout: t.layout,
        broadcastEnabled: t.broadcastEnabled,
        sshCommand: t.sshCommand,
        shellProgram: t.shellProgram,
        shellArgs: t.shellArgs,
      })),
      activeTabId,
    };
    ipc.saveSession(sessionData).catch(() => {});
  }, [tabs, activeTabId]);

  const activateTab = useCallback((tabId: string) => {
    setActiveTab(tabId);
    setReceivingTabs((prev) => {
      if (!prev.has(tabId)) return prev;
      const next = new Set(prev);
      next.delete(tabId);
      return next;
    });
    const timer = activityTimers.current.get(tabId);
    if (timer) {
      clearTimeout(timer);
      activityTimers.current.delete(tabId);
    }
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

  const handleTabActivity = useCallback((tabId: string) => {
    if (tabId === activeTabIdRef.current) return;
    setTabActivity(tabId, true);
    setReceivingTabs((prev) => {
      const next = new Set(prev);
      next.add(tabId);
      return next;
    });
    const existing = activityTimers.current.get(tabId);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      setReceivingTabs((prev) => {
        const next = new Set(prev);
        next.delete(tabId);
        return next;
      });
      activityTimers.current.delete(tabId);
    }, 1500);
    activityTimers.current.set(tabId, timer);
  }, [setTabActivity]);

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

  const handleNewSession = (tabId: string, opts?: { shellProgram?: string; shellArgs?: string[]; sshCommand?: string; label?: string }) => {
    resolveSessionPick(tabId, undefined, opts?.shellProgram, opts?.shellArgs, opts?.sshCommand, opts?.label);
  };

  const handleAttachSession = (tabId: string, sessionId: string) => {
    resolveSessionPick(tabId, sessionId);
  };

  const handleTabClose = (tabId: string) => {
    const tab = tabs.find((t) => t.id === tabId);
    if (tab) {
      for (const panel of tab.panels) {
        if (panel.ptyId) {
          ipc.daemonKillSession(panel.ptyId).catch(() => {});
        }
      }
    }
    removeTab(tabId);
  };

  return (
    <div className="app">
      <TitleBar />
      <div className="topbar">
        <TabBar
          onOpenSshManager={() => setSshModalOpen(true)}
          onCloseTab={handleTabClose}
          receivingTabIds={receivingTabs}
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
              />
            ) : (
              <PanelGrid
                tab={tab}
                onActivePanelChanged={tab.id === activeTabId ? (ptyId) => { activePanelPtyIdRef.current = ptyId; } : undefined}
                onActivity={tab.id !== activeTabId ? () => handleTabActivity(tab.id) : undefined}
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
