import { useEffect, useState, useCallback } from "react";
import { ipc } from "../../lib/tauriIpc";
import { buildSshCommand } from "../../lib/sshUtils";
import { useSshStore } from "../../store/sshStore";
import type { DaemonSessionInfo, SavedTab } from "../../types/terminal";
import "./SessionPicker.css";

export interface NewSessionOptions {
  shellProgram?: string;
  shellArgs?: string[];
  sshCommand?: string;
  label?: string;
}

interface SessionPickerProps {
  onNewSession: (opts?: NewSessionOptions) => void;
  savedTabs?: SavedTab[];
  onRestoreTab?: (savedTabId: string) => void;
  onKillSavedTab?: (savedTabId: string) => Promise<void>;
}

function formatAge(secs: number): string {
  const diff = Math.floor(Date.now() / 1000) - secs;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}


const IconTerminal = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <rect x="1.5" y="2.5" width="13" height="11" rx="2.5" stroke="currentColor" strokeWidth="1.25" />
    <path d="M4.5 6.5l3 3-3 3" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M9 12h3" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
  </svg>
);

const IconTerminalHero = () => (
  <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
    <rect x="2" y="3" width="26" height="24" rx="5.5" stroke="currentColor" strokeWidth="1.8" />
    <path d="M8 12l6 5.5L8 23" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M17 23h7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

const IconLinux = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M8 1.5C5.8 1.5 4 3.3 4 5.5c0 1.3.5 2.5 1.2 3.3l-.8 2.7c-.2.5 0 1 .4 1.2l1.4.8c.4.2.9 0 1.1-.4l.2-.8h.9l.2.8c.2.4.7.6 1.1.4l1.4-.8c.4-.2.6-.7.4-1.2L11 8.9C11.6 8.1 12 7 12 5.7 12 3.4 10.2 1.5 8 1.5z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
    <circle cx="6.5" cy="5.5" r=".7" fill="currentColor" />
    <circle cx="9.5" cy="5.5" r=".7" fill="currentColor" />
  </svg>
);

const IconSsh = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <rect x="1.5" y="4.5" width="5" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
    <rect x="9.5" y="4.5" width="5" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
    <path d="M6.5 8h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    <path d="M8.5 6.5l2 1.5-2 1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);


const IconClose = () => (
  <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
    <path d="M1 1l7 7M8 1L1 8" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
  </svg>
);

const IconEmptyState = () => (
  <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
    {/* Monitor outline */}
    <rect x="6" y="8" width="52" height="36" rx="6" stroke="currentColor" strokeWidth="2" strokeDasharray="4 3" />
    {/* Stand */}
    <path d="M24 44v8M40 44v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M20 52h24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    {/* Terminal lines inside */}
    <path d="M14 20l6 5-6 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity="0.35" />
    <path d="M24 30h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" opacity="0.35" />
    {/* Zzz sleep indicators */}
    <text x="36" y="22" fontSize="8" fontWeight="700" fill="currentColor" opacity="0.45">z</text>
    <text x="41" y="16" fontSize="10" fontWeight="700" fill="currentColor" opacity="0.30">z</text>
    <text x="47" y="10" fontSize="12" fontWeight="700" fill="currentColor" opacity="0.18">z</text>
  </svg>
);

export function SessionPicker({ onNewSession, savedTabs, onRestoreTab, onKillSavedTab }: SessionPickerProps) {
  const [sessions, setSessions] = useState<DaemonSessionInfo[]>([]);
  const [wslDistros, setWslDistros] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [killingSavedTabId, setKillingSavedTabId] = useState<string | null>(null);
  const { profiles: sshProfiles } = useSshStore();

  const loadSessions = useCallback(() => {
    setLoading(true);
    ipc
      .daemonListSessions()
      .then(setSessions)
      .catch(() => setSessions([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadSessions();
    ipc.getWslDistros()
      .then(setWslDistros)
      .catch(() => setWslDistros([]));
  }, [loadSessions]);

  const handleKillSavedTab = async (e: React.MouseEvent, savedTabId: string) => {
    e.stopPropagation();
    setKillingSavedTabId(savedTabId);
    try {
      await onKillSavedTab?.(savedTabId);
      loadSessions();
    } finally {
      setKillingSavedTabId(null);
    }
  };

  const hasSavedTabs = (savedTabs?.length ?? 0) > 0;

  return (
    <div className="sp-root">
      <div className="sp-container">

        {/* ── Hero ── */}
        <div className="sp-hero">
          <div className="sp-hero-icon">
            <IconTerminalHero />
          </div>
          <span className="sp-hero-title">New Session</span>
          <span className="sp-hero-subtitle">Choose a connection type</span>
        </div>

        {/* ── Connection Group ── */}
        <div className="sp-group">
          <div className="sp-group-label">Connection</div>
          <div className="sp-group-body">
            <button className="sp-row" onClick={() => onNewSession()}>
              <span className="sp-row-icon sp-row-icon--local">
                <IconTerminal />
              </span>
              <span className="sp-row-content">
                <span className="sp-row-title">Local Shell</span>
                <span className="sp-row-subtitle">PowerShell</span>
              </span>
            </button>

            {wslDistros.map((distro) => (
              <button
                key={distro}
                className="sp-row"
                onClick={() => onNewSession({ shellProgram: "wsl.exe", shellArgs: ["-d", distro], label: distro })}
              >
                <span className="sp-row-icon sp-row-icon--wsl">
                  <IconLinux />
                </span>
                <span className="sp-row-content">
                  <span className="sp-row-title">{distro}</span>
                  <span className="sp-row-subtitle">WSL</span>
                </span>
              </button>
            ))}

            {sshProfiles.map((profile) => (
              <button
                key={profile.id}
                className="sp-row"
                onClick={() => onNewSession({ sshCommand: buildSshCommand(profile), label: profile.name })}
              >
                <span className="sp-row-icon sp-row-icon--ssh">
                  <IconSsh />
                </span>
                <span className="sp-row-content">
                  <span className="sp-row-title">{profile.name}</span>
                  <span className="sp-row-subtitle">{profile.username}@{profile.host}</span>
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Background Tabs ── */}
        <div className="sp-group">
          <div className="sp-group-label">
            Background Tabs
            {hasSavedTabs && (
              <span className="sp-group-count">{savedTabs!.length}</span>
            )}
          </div>

          {hasSavedTabs ? (
            <div className="sp-card-grid">
              {savedTabs!.map((savedTab) => {
                const panelSessions = savedTab.panels
                  .map((p) => sessions.find((s) => s.id === p.ptyId))
                  .filter((s): s is DaemonSessionInfo => s !== undefined);
                const firstCwd = panelSessions[0]?.cwd ?? "~";
                const count = savedTab.panels.length;
                const lastActive =
                  panelSessions.length > 0
                    ? Math.max(...panelSessions.map((s) => s.last_active))
                    : Math.floor(savedTab.savedAt / 1000);

                return (
                  <div
                    key={savedTab.id}
                    className="sp-card"
                    role="button"
                    tabIndex={0}
                    onClick={() => onRestoreTab?.(savedTab.id)}
                    onKeyDown={(e) => e.key === "Enter" && onRestoreTab?.(savedTab.id)}
                  >
                    <div className="sp-card-header">
                      <button
                        className="sp-card-kill"
                        onClick={(e) => handleKillSavedTab(e, savedTab.id)}
                        disabled={killingSavedTabId === savedTab.id}
                        title="Close Tab"
                        aria-label="Close tab"
                      >
                        <IconClose />
                      </button>
                    </div>
                    <div className="sp-card-body">
                      <span className="sp-card-title">{savedTab.label}</span>
                      <span className="sp-card-path">{firstCwd}{count > 1 ? ` +${count - 1}` : ""}</span>
                    </div>
                    <div className="sp-card-footer">
                      <span className="sp-card-age">{formatAge(lastActive)}</span>
                      {count > 1 && (
                        <span className="sp-card-panels">{count} panels</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="sp-empty">
              <div className="sp-empty-icon">
                <IconEmptyState />
              </div>
              <p className="sp-empty-title">No Background Tabs</p>
              <p className="sp-empty-desc">
                Tabs you send to the background will appear here for quick restore
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
