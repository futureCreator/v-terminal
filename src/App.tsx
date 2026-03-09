import { useEffect } from "react";
import { TitleBar } from "./components/TitleBar/TitleBar";
import { TabBar } from "./components/TabBar/TabBar";
import { SplitToolbar } from "./components/SplitToolbar/SplitToolbar";
import { PanelGrid } from "./components/PanelGrid/PanelGrid";
import { useTabStore } from "./store/tabStore";
import { ipc } from "./lib/tauriIpc";
import type { Layout } from "./types/terminal";
import "./styles/theme.css";
import "./styles/globals.css";
import "./App.css";

export function App() {
  const { tabs, activeTabId, setLayout, toggleBroadcast, restoreFromSession } =
    useTabStore();

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? tabs[0];

  // Load persisted session on mount
  useEffect(() => {
    ipc.loadSession().then((session) => {
      if (session && session.tabs.length > 0) {
        restoreFromSession(session.tabs, session.activeTabId);
      }
    }).catch(() => {
      // First launch, no session file
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Save session on unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      const store = useTabStore.getState();
      const sessionData = {
        tabs: store.tabs.map((t) => ({
          id: t.id,
          label: t.label,
          cwd: t.cwd,
          layout: t.layout,
          broadcastEnabled: t.broadcastEnabled,
        })),
        activeTabId: store.activeTabId,
      };
      ipc.saveSession(sessionData).catch(() => {});
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  const handleLayoutChange = (layout: Layout) => {
    if (!activeTab) return;
    // setLayout handles spawning/killing via PanelGrid's TerminalPane useEffect
    setLayout(activeTab.id, layout);
  };

  const handleToggleBroadcast = () => {
    if (activeTab) toggleBroadcast(activeTab.id);
  };

  return (
    <div className="app">
      <TitleBar title={activeTab?.label ?? "v-terminal"} />
      <TabBar />
      <SplitToolbar
        activeLayout={activeTab?.layout ?? 1}
        broadcastEnabled={activeTab?.broadcastEnabled ?? false}
        onLayoutChange={handleLayoutChange}
        onToggleBroadcast={handleToggleBroadcast}
      />
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
    </div>
  );
}
