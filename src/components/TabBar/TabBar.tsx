import { useState, useRef, useEffect } from "react";
import { homeDir } from "@tauri-apps/api/path";
import { useTabStore } from "../../store/tabStore";
import "./TabBar.css";

interface TabBarProps {
  onOpenSshManager: () => void;
  onCloseTab?: (tabId: string) => void;
  onKillTab?: (tabId: string) => void;
  onActivateTab?: (tabId: string) => void;
}

export function TabBar({ onOpenSshManager, onCloseTab, onKillTab, onActivateTab }: TabBarProps) {
  const { tabs, activeTabId, addTab, removeTab, setActiveTab, renameTab } = useTabStore();

  const handleAddTab = async () => {
    let cwd: string;
    try {
      cwd = await homeDir();
    } catch {
      cwd = "~";
    }
    addTab(cwd);
  };

  return (
    <div className="tabbar">
      <div className="tabbar-tabs">
        {tabs.map((tab) => (
          <TabItem
            key={tab.id}
            id={tab.id}
            label={tab.label}
            isActive={tab.id === activeTabId}
            onActivate={() => {
              if (onActivateTab) {
                onActivateTab(tab.id);
              } else {
                setActiveTab(tab.id);
              }
            }}
            onClose={() => (onCloseTab ? onCloseTab(tab.id) : removeTab(tab.id))}
            onKill={() => (onKillTab ? onKillTab(tab.id) : removeTab(tab.id))}
            onRename={(label) => renameTab(tab.id, label)}
          />
        ))}
      </div>
      <button
        className="tabbar-add"
        onClick={handleAddTab}
        title="New Tab"
        aria-label="New tab"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
      <button
        className="tabbar-ssh"
        onClick={onOpenSshManager}
        title="SSH Connections"
        aria-label="SSH connections"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <rect x="1" y="2" width="12" height="4" rx="1" stroke="currentColor" strokeWidth="1.2" />
          <rect x="1" y="8" width="12" height="4" rx="1" stroke="currentColor" strokeWidth="1.2" />
          <circle cx="10.5" cy="4" r="0.9" fill="currentColor" />
          <circle cx="10.5" cy="10" r="0.9" fill="currentColor" />
        </svg>
      </button>
    </div>
  );
}

interface TabItemProps {
  id: string;
  label: string;
  isActive: boolean;
  onActivate: () => void;
  onClose: () => void;
  onKill: () => void;
  onRename: (label: string) => void;
}

function TabItem({ id, label, isActive, onActivate, onClose, onKill, onRename }: TabItemProps) {
  const [editing, setEditing] = useState(false);
  const [draftLabel, setDraftLabel] = useState(label);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!contextMenu) return;
    const handleClose = (e: PointerEvent) => {
      if (!(e.target as HTMLElement).closest(".tab-context-menu")) {
        setContextMenu(null);
      }
    };
    document.addEventListener("pointerdown", handleClose, { capture: true });
    return () => document.removeEventListener("pointerdown", handleClose, { capture: true });
  }, [contextMenu]);

  const startEdit = () => {
    setDraftLabel(label);
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  };

  const commitEdit = () => {
    const trimmed = draftLabel.trim();
    if (trimmed) onRename(trimmed);
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") commitEdit();
    else if (e.key === "Escape") setEditing(false);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const menuWidth = 196;
    const menuHeight = 116;
    const x = Math.min(e.clientX, window.innerWidth - menuWidth - 8);
    const y = Math.min(e.clientY, window.innerHeight - menuHeight - 8);
    setContextMenu({ x, y });
  };

  const closeMenu = () => setContextMenu(null);

  return (
    <div
      className={`tab-item${isActive ? " tab-item--active" : ""}`}
      data-tab-id={id}
      onClick={onActivate}
      onDoubleClick={startEdit}
      onContextMenu={handleContextMenu}
    >
      {editing ? (
        <input
          ref={inputRef}
          className="tab-item-input"
          value={draftLabel}
          onChange={(e) => setDraftLabel(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={handleKeyDown}
          onClick={(e) => e.stopPropagation()}
          autoFocus
        />
      ) : (
        <span className="tab-item-label">{label}</span>
      )}
      <button
        className="tab-item-close"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        title="백그라운드로 보내기"
        aria-label="백그라운드로 보내기"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      </button>

      {contextMenu && (
        <div
          className="tab-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            className="tab-context-menu-item"
            onClick={() => { startEdit(); closeMenu(); }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M7.5 1.5L10.5 4.5L4 11H1V8L7.5 1.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            이름 변경
          </button>
          <div className="tab-context-menu-separator" />
          <button
            className="tab-context-menu-item"
            onClick={() => { onClose(); closeMenu(); }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M6 1.5V8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              <path d="M3.5 5.5L6 8L8.5 5.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M1.5 10.5H10.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            백그라운드로 보내기
          </button>
          <button
            className="tab-context-menu-item tab-context-menu-item--destructive"
            onClick={() => { onKill(); closeMenu(); }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <rect x="2.5" y="2.5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
            </svg>
            프로세스 종료
          </button>
        </div>
      )}
    </div>
  );
}
