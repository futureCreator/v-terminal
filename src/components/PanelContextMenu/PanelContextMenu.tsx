import { useRef, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { PanelConnection, SshProfile } from "../../types/terminal";
import { buildSshCommand } from "../../lib/sshUtils";
import "./PanelContextMenu.css";

interface PanelContextMenuProps {
  x: number;
  y: number;
  currentConnection?: PanelConnection;
  wslDistros: string[];
  sshProfiles: SshProfile[];
  onSwitchConnection: (connection: PanelConnection) => void;
  onClose: () => void;
}

export function PanelContextMenu({
  x,
  y,
  currentConnection,
  wslDistros,
  sshProfiles,
  onSwitchConnection,
  onClose,
}: PanelContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: y, left: x });

  // Adjust position if menu overflows viewport
  useEffect(() => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    let top = y;
    let left = x;
    if (left + rect.width > window.innerWidth - 8) {
      left = window.innerWidth - rect.width - 8;
    }
    if (top + rect.height > window.innerHeight - 8) {
      top = window.innerHeight - rect.height - 8;
    }
    setPos({ top, left });
  }, [x, y]);

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const connType = currentConnection?.type ?? "local";
  const isLocal = connType === "local";
  const isBrowser = connType === "browser";

  const handleClick = (connection: PanelConnection) => {
    onSwitchConnection(connection);
    onClose();
  };

  const checkIcon = (
    <svg className="panel-ctx-check" width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M3.5 8.5l3 3 6-7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );

  return createPortal(
    <div
      ref={menuRef}
      className="panel-ctx-menu"
      role="menu"
      style={{ top: pos.top, left: pos.left }}
    >
      <div className="panel-ctx-section-label">Switch Connection</div>

      {/* Local Shell */}
      <button
        className={`panel-ctx-item${isLocal ? " panel-ctx-item--active" : ""}`}
        onClick={() => !isLocal && handleClick({ type: "local" })}
        role="menuitem"
      >
        <span className="panel-ctx-item-icon">💻</span>
        <span className="panel-ctx-item-label">Local Shell</span>
        <span className="panel-ctx-item-meta">PowerShell</span>
        {isLocal && checkIcon}
      </button>

      {/* WSL distros */}
      {wslDistros.length > 0 && <div className="panel-ctx-divider" />}
      {wslDistros.map((distro) => {
        const isActiveWsl = connType === "wsl"
          && currentConnection?.shellArgs?.[0] === "-d"
          && currentConnection?.shellArgs?.[1] === distro;
        return (
          <button
            key={`wsl:${distro}`}
            className={`panel-ctx-item${isActiveWsl ? " panel-ctx-item--active" : ""}`}
            onClick={() => !isActiveWsl && handleClick({
              type: "wsl",
              shellProgram: "wsl.exe",
              shellArgs: ["-d", distro],
            })}
            role="menuitem"
          >
            <span className="panel-ctx-item-icon">🐧</span>
            <span className="panel-ctx-item-label">{distro}</span>
            <span className="panel-ctx-item-meta">WSL</span>
            {isActiveWsl && checkIcon}
          </button>
        );
      })}

      {/* SSH profiles */}
      {sshProfiles.length > 0 && <div className="panel-ctx-divider" />}
      {sshProfiles.map((profile) => {
        const sshCmd = buildSshCommand(profile);
        const isActiveSsh = connType === "ssh" && currentConnection?.sshCommand === sshCmd;
        return (
          <button
            key={`ssh:${profile.id}`}
            className={`panel-ctx-item${isActiveSsh ? " panel-ctx-item--active" : ""}`}
            onClick={() => !isActiveSsh && handleClick({
              type: "ssh",
              sshCommand: sshCmd,
            })}
            role="menuitem"
          >
            <span className="panel-ctx-item-icon">🔑</span>
            <span className="panel-ctx-item-label">{profile.name}</span>
            <span className="panel-ctx-item-meta">{profile.username}@{profile.host}</span>
            {isActiveSsh && checkIcon}
          </button>
        );
      })}

      {/* Browser */}
      <div className="panel-ctx-divider" />
      <button
        className={`panel-ctx-item${isBrowser ? " panel-ctx-item--active" : ""}`}
        onClick={() => !isBrowser && handleClick({ type: "browser" })}
        role="menuitem"
      >
        <span className="panel-ctx-item-icon">🌐</span>
        <span className="panel-ctx-item-label">Browser</span>
        <span className="panel-ctx-item-meta">Web panel</span>
        {isBrowser && checkIcon}
      </button>
    </div>,
    document.body
  );
}
