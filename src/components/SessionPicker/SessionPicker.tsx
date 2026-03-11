import { useEffect, useState, useCallback } from "react";
import { ipc } from "../../lib/tauriIpc";
import { useSshStore } from "../../store/sshStore";
import type { DaemonSessionInfo } from "../../types/terminal";
import "./SessionPicker.css";

export interface NewSessionOptions {
  shellProgram?: string;
  shellArgs?: string[];
  sshCommand?: string;
  label?: string;
}

interface SessionPickerProps {
  onNewSession: (opts?: NewSessionOptions) => void;
  onAttach: (sessionId: string) => void;
  onKill: (sessionId: string) => void;
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

// Icons
const IconTerminal = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
    <rect x="1" y="2" width="13" height="11" rx="2.5" stroke="currentColor" strokeWidth="1.25" />
    <path d="M4 6l2.5 2.5L4 11" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M8.5 11h4" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
  </svg>
);

const IconLinux = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
    <path d="M7.5 1.5C5.5 1.5 4 3 4 5c0 1.2.4 2.3 1 3.1L4.5 10.5c-.3.4-.2.9.2 1.1L6 12.3c.4.3.9.1 1-.4l.2-.8h.6l.2.8c.1.5.6.7 1 .4l1.3-.7c.4-.2.5-.7.2-1.1L10 8.1C10.6 7.3 11 6.2 11 5c0-2-1.5-3.5-3.5-3.5z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
    <circle cx="6" cy="5" r=".6" fill="currentColor" />
    <circle cx="9" cy="5" r=".6" fill="currentColor" />
  </svg>
);

const IconSsh = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
    <rect x="1" y="4" width="5" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
    <rect x="9" y="4" width="5" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
    <path d="M6 7.5h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    <path d="M8 6l1.5 1.5L8 9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export function SessionPicker({ onNewSession, onAttach, onKill }: SessionPickerProps) {
  const [sessions, setSessions] = useState<DaemonSessionInfo[]>([]);
  const [wslDistros, setWslDistros] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [killingId, setKillingId] = useState<string | null>(null);
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
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    } catch {
      // ignore
    } finally {
      setKillingId(null);
    }
  };

  const hasRunning = sessions.length > 0 || loading;

  return (
    <div className="sp-root">
      {/* ── New Session ── */}
      <div className="sp-section-header">
        <span className="sp-section-label">새 세션</span>
      </div>

      <div className="sp-shell-list">
        {/* Local Shell */}
        <button
          className="sp-shell-item"
          onClick={() => onNewSession()}
        >
          <span className="sp-shell-icon sp-shell-icon--local">
            <IconTerminal />
          </span>
          <span className="sp-shell-name">로컬 쉘</span>
          <span className="sp-shell-desc">cmd / PowerShell</span>
        </button>

        {/* WSL distros */}
        {wslDistros.map((distro) => (
          <button
            key={distro}
            className="sp-shell-item"
            onClick={() =>
              onNewSession({
                shellProgram: "wsl.exe",
                shellArgs: ["-d", distro],
                label: distro,
              })
            }
          >
            <span className="sp-shell-icon sp-shell-icon--wsl">
              <IconLinux />
            </span>
            <span className="sp-shell-name">{distro}</span>
            <span className="sp-shell-desc">WSL</span>
          </button>
        ))}

        {/* SSH profiles */}
        {sshProfiles.length > 0 && (
          <>
            <div className="sp-shell-divider" />
            {sshProfiles.map((profile) => (
              <button
                key={profile.id}
                className="sp-shell-item"
                onClick={() =>
                  onNewSession({
                    sshCommand: buildSshCommand(profile),
                    label: profile.name,
                  })
                }
              >
                <span className="sp-shell-icon sp-shell-icon--ssh">
                  <IconSsh />
                </span>
                <span className="sp-shell-name">{profile.name}</span>
                <span className="sp-shell-desc">
                  {profile.username}@{profile.host}
                </span>
              </button>
            ))}
          </>
        )}
      </div>

      {/* ── Running Sessions ── */}
      {hasRunning && (
        <>
          <div className="sp-section-header sp-section-header--running">
            <span className="sp-section-label">실행 중인 세션</span>
            <button className="sp-refresh-btn" onClick={loadSessions} title="새로고침">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path
                  d="M10.5 6A4.5 4.5 0 1 1 6 1.5a4.5 4.5 0 0 1 3.18 1.32L10.5 1.5"
                  stroke="currentColor"
                  strokeWidth="1.3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M10.5 1.5v2.5H8"
                  stroke="currentColor"
                  strokeWidth="1.3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>

          <div className="sp-session-list">
            {loading ? (
              <div className="sp-loading">
                <div className="sp-spinner" />
              </div>
            ) : (
              sessions.map((s) => (
                <div
                  key={s.id}
                  className="sp-session-item"
                  onClick={() => onAttach(s.id)}
                  title={`${s.label} — ${s.cwd}`}
                >
                  <div className="sp-session-icon">
                    <IconTerminal />
                  </div>
                  <div className="sp-session-info">
                    <span className="sp-session-label">{s.label}</span>
                    <span className="sp-session-cwd">{s.cwd}</span>
                  </div>
                  <span className="sp-session-age">{formatAge(s.last_active)}</span>
                  <button
                    className="sp-session-kill"
                    onClick={(e) => handleKill(e, s.id)}
                    disabled={killingId === s.id}
                    title="세션 종료"
                    aria-label="세션 종료"
                  >
                    <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                      <path
                        d="M1 1l7 7M8 1L1 8"
                        stroke="currentColor"
                        strokeWidth="1.3"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
