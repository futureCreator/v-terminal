import { useEffect, useRef, useState } from "react";
import { homeDir } from "@tauri-apps/api/path";
import { TitleBar } from "./components/TitleBar/TitleBar";
import { TabBar } from "./components/TabBar/TabBar";
import { SplitToolbar } from "./components/SplitToolbar/SplitToolbar";
import { PanelGrid } from "./components/PanelGrid/PanelGrid";
import { SshManagerModal } from "./components/SshManager/SshManagerModal";
import { useTabStore } from "./store/tabStore";
import { ipc } from "./lib/tauriIpc";
import type { Layout, SshProfile } from "./types/terminal";
import "./styles/theme.css";
import "./styles/globals.css";
import "./App.css";

export function App() {
  const { tabs, activeTabId, addTab, setLayout, toggleBroadcast, restoreFromSession } =
    useTabStore();

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? tabs[0];
  const sessionLoaded = useRef(false);
  const [sshModalOpen, setSshModalOpen] = useState(false);

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
      })),
      activeTabId,
    };
    ipc.saveSession(sessionData).catch(() => {});
  }, [tabs, activeTabId]);

  const handleLayoutChange = (layout: Layout) => {
    if (!activeTab) return;
    setLayout(activeTab.id, layout);
  };

  const handleToggleBroadcast = () => {
    if (activeTab) toggleBroadcast(activeTab.id);
  };

  const handleSshConnect = async (profile: SshProfile) => {
    let cwd: string;
    try {
      cwd = await homeDir();
    } catch {
      cwd = "~";
    }

    let cmd = `ssh ${profile.username}@${profile.host}`;
    if (profile.port !== 22) cmd += ` -p ${profile.port}`;
    if (profile.identityFile) cmd += ` -i "${profile.identityFile}"`;

    addTab(cwd, profile.name, cmd);
    setSshModalOpen(false);
  };

  return (
    <div className="app">
      <TitleBar />
      <div className="topbar">
        <TabBar onOpenSshManager={() => setSshModalOpen(true)} />
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
            <PanelGrid tab={tab} />
          </div>
        ))}
      </div>
      {sshModalOpen && (
        <SshManagerModal
          onClose={() => setSshModalOpen(false)}
          onConnect={handleSshConnect}
        />
      )}
    </div>
  );
}
