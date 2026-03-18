import { useEffect, useMemo } from "react";
import { useClaudeCodeStore } from "../../store/claudeCodeStore";
import { useTabStore } from "../../store/tabStore";
import { ipc } from "../../lib/tauriIpc";
import { ContextIndicator } from "./ContextIndicator";
import { ClaudeMdTab } from "./ClaudeMdTab";
import "./ClaudeCodePanel.css";

export type ClaudeCodeTab = "claude-md";

interface ClaudeCodePanelProps {
  activeTab: ClaudeCodeTab;
  onTabChange: (tab: ClaudeCodeTab) => void;
  onClose: () => void;
  focusedPanelId: string | null;
  focusedSessionId: string | null;
}

export function ClaudeCodePanel({
  activeTab,
  onTabChange,
  onClose,
  focusedPanelId,
  focusedSessionId,
}: ClaudeCodePanelProps) {
  const { setTrackedSession, setCwd, trackedCwd } = useClaudeCodeStore();
  const tabs = useTabStore((s) => s.tabs);
  const activeTabId = useTabStore((s) => s.activeTabId);

  const focusedPanel = useMemo(() => {
    const tab = tabs.find((t) => t.id === activeTabId);
    if (!tab || !focusedPanelId) return null;
    return tab.panels.find((p) => p.id === focusedPanelId) ?? null;
  }, [tabs, activeTabId, focusedPanelId]);

  useEffect(() => {
    setTrackedSession(focusedSessionId);
    if (!focusedSessionId) return;

    ipc.getSessionCwd(focusedSessionId).then((result) => {
      if ("value" in result) {
        setCwd(result.value);
      }
    }).catch(() => {});

    let cleanup: (() => void) | null = null;
    ipc.onSessionCwd(focusedSessionId, (cwd) => {
      setCwd(cwd);
    }).then((unsub) => { cleanup = unsub; });

    return () => { cleanup?.(); };
  }, [focusedSessionId, setTrackedSession, setCwd]);

  useEffect(() => {
    let cleanup: (() => void) | null = null;
    const { refreshFiles } = useClaudeCodeStore.getState();
    ipc.onClaudeMdChanged(() => {
      refreshFiles();
    }).then((unsub) => { cleanup = unsub; });
    return () => { cleanup?.(); };
  }, []);

  return (
    <div className="claude-panel">
      <div className="claude-panel-header">
        <div className="claude-panel-tabs">
          <button
            className={`claude-panel-tab${activeTab === "claude-md" ? " claude-panel-tab--active" : ""}`}
            onClick={() => onTabChange("claude-md")}
            title="CLAUDE.md"
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <path d="M3 2h9a1 1 0 011 1v9a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.2" />
              <path d="M5 5.5h5M5 7.5h5M5 9.5h3" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <button
          className="claude-panel-close"
          onClick={onClose}
          aria-label="Close panel"
          title="Close panel"
        >
          <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
            <path d="M1.5 1.5l6 6M7.5 1.5l-6 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="claude-panel-body">
        <ContextIndicator connection={focusedPanel?.connection} cwd={trackedCwd} />
        {activeTab === "claude-md" && <ClaudeMdTab />}
      </div>
    </div>
  );
}
