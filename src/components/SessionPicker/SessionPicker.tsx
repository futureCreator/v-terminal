import { useEffect, useState, useCallback } from "react";
import { ipc } from "../../lib/tauriIpc";
import { useSshStore } from "../../store/sshStore";
import type { DaemonSessionInfo, SavedTab } from "../../types/terminal";
import "./SessionPicker.css";

export interface NewSessionOptions {
  shellProgram?: string;
  shellArgs?: string[];
  sshCommand?: string;
  label?: string;
}

export interface TabSessionGroup {
  tabId: string;
  label: string;
  ptyIds: string[];
}

interface SessionPickerProps {
  onNewSession: (opts?: NewSessionOptions) => void;
  onAttach: (sessionId: string) => void;
  onKill: (sessionId: string) => void;
  tabGroups?: TabSessionGroup[];
  savedTabs?: SavedTab[];
  onRestoreTab?: (savedTabId: string) => void;
  onKillSavedTab?: (savedTabId: string) => Promise<void>;
}

function formatAge(secs: number): string {
  const diff = Math.floor(Date.now() / 1000) - secs;
  if (diff < 60) return "방금 전";
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return `${Math.floor(diff / 86400)}일 전`;
}

function buildSshCommand(profile: { username: string; host: string; port: number; identityFile?: string }): string {
  let cmd = `ssh ${profile.username}@${profile.host}`;
  if (profile.port !== 22) cmd += ` -p ${profile.port}`;
  if (profile.identityFile) cmd += ` -i "${profile.identityFile}"`;
  return cmd;
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

const IconSavedTab = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <rect x="1.5" y="4.5" width="13" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
    <path d="M1.5 7H6.5V4.5H3A1.5 1.5 0 0 0 1.5 6V7z" fill="currentColor" fillOpacity="0.3" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
  </svg>
);

const IconRefresh = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
    <path d="M10.5 6A4.5 4.5 0 1 1 6 1.5a4.5 4.5 0 0 1 3.18 1.32L10.5 1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M10.5 1.5v2.5H8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IconClose = () => (
  <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
    <path d="M1 1l7 7M8 1L1 8" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
  </svg>
);

export function SessionPicker({ onNewSession, onAttach, onKill, tabGroups, savedTabs, onRestoreTab, onKillSavedTab }: SessionPickerProps) {
  const [sessions, setSessions] = useState<DaemonSessionInfo[]>([]);
  const [wslDistros, setWslDistros] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [killingId, setKillingId] = useState<string | null>(null);
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

  const handleKill = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    setKillingId(sessionId);
    try {
      await ipc.daemonKillSession(sessionId);
      onKill(sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    } catch {
      // ignore
    } finally {
      setKillingId(null);
    }
  };

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

  const openTabPtyIds = new Set(tabGroups?.flatMap((g) => g.ptyIds) ?? []);
  const savedTabPtyIds = new Set(savedTabs?.flatMap((t) => t.panels.map((p) => p.ptyId)) ?? []);
  const orphaned = sessions.filter((s) => !openTabPtyIds.has(s.id) && !savedTabPtyIds.has(s.id));

  const hasSavedTabs = (savedTabs?.length ?? 0) > 0;
  const hasOrphaned = !loading && orphaned.length > 0;

  return (
    <div className="sp-root">
      <div className="sp-container">

        {/* ── Hero ── */}
        <div className="sp-hero">
          <div className="sp-hero-icon">
            <IconTerminalHero />
          </div>
          <span className="sp-hero-title">새 세션</span>
          <span className="sp-hero-subtitle">연결 방식을 선택하세요</span>
        </div>

        {/* ── Connection Group ── */}
        <div className="sp-group">
          <div className="sp-group-label">연결</div>
          <div className="sp-group-body">
            <button className="sp-row" onClick={() => onNewSession()}>
              <span className="sp-row-icon sp-row-icon--local">
                <IconTerminal />
              </span>
              <span className="sp-row-content">
                <span className="sp-row-title">로컬 쉘</span>
                <span className="sp-row-subtitle">cmd / PowerShell</span>
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
        {hasSavedTabs && (
          <div className="sp-group">
            <div className="sp-group-label">백그라운드 탭</div>
            <div className="sp-group-body">
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
                    className="sp-row"
                    role="button"
                    tabIndex={0}
                    onClick={() => onRestoreTab?.(savedTab.id)}
                    onKeyDown={(e) => e.key === "Enter" && onRestoreTab?.(savedTab.id)}
                    title={`${savedTab.label}${count > 1 ? ` — ${count}패널` : ""}`}
                  >
                    <span className="sp-row-icon sp-row-icon--tab">
                      <IconSavedTab />
                      {count > 1 && <span className="sp-panel-badge">{count}</span>}
                    </span>
                    <span className="sp-row-content">
                      <span className="sp-row-title">{savedTab.label}</span>
                      <span className="sp-row-subtitle sp-row-subtitle--mono">
                        {firstCwd}{count > 1 ? ` 외 ${count - 1}개` : ""}
                      </span>
                    </span>
                    <span className="sp-row-meta">{formatAge(lastActive)}</span>
                    <button
                      className="sp-row-kill"
                      onClick={(e) => handleKillSavedTab(e, savedTab.id)}
                      disabled={killingSavedTabId === savedTab.id}
                      title="탭 종료"
                      aria-label="탭 종료"
                    >
                      <IconClose />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Orphaned Sessions ── */}
        {hasOrphaned && (
          <div className="sp-group">
            <div className="sp-group-label">
              <span>백그라운드 세션</span>
              <button className="sp-group-action" onClick={loadSessions} title="새로고침">
                <IconRefresh />
              </button>
            </div>
            <div className="sp-group-body">
              {loading ? (
                <div className="sp-loading">
                  <div className="sp-spinner" />
                </div>
              ) : (
                orphaned.map((s) => (
                  <div
                    key={s.id}
                    className="sp-row"
                    role="button"
                    tabIndex={0}
                    onClick={() => onAttach(s.id)}
                    onKeyDown={(e) => e.key === "Enter" && onAttach(s.id)}
                    title={`${s.label} — ${s.cwd}`}
                  >
                    <span className="sp-row-icon sp-row-icon--orphan">
                      <IconTerminal />
                    </span>
                    <span className="sp-row-content">
                      <span className="sp-row-title">{s.label}</span>
                      <span className="sp-row-subtitle sp-row-subtitle--mono">{s.cwd}</span>
                    </span>
                    <span className="sp-row-meta">{formatAge(s.last_active)}</span>
                    <button
                      className="sp-row-kill"
                      onClick={(e) => handleKill(e, s.id)}
                      disabled={killingId === s.id}
                      title="세션 종료"
                      aria-label="세션 종료"
                    >
                      <IconClose />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
