import { useState, useRef } from "react";
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
  const inputRef = useRef<HTMLInputElement>(null);

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

  return (
    <div
      className={`tab-item${isActive ? " tab-item--active" : ""}`}
      data-tab-id={id}
      onClick={onActivate}
      onDoubleClick={startEdit}
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
      <div className="tab-item-actions">
        <button
          className="tab-item-btn tab-item-btn--bg"
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          title="백그라운드로 보내기"
          aria-label="백그라운드로 보내기"
        >
          <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
            <path d="M4.5 1v5.5M2.5 4.5L4.5 6.5L6.5 4.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M1 8h7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
        </button>
        <button
          className="tab-item-btn tab-item-btn--kill"
          onClick={(e) => { e.stopPropagation(); onKill(); }}
          title="프로세스 종료"
          aria-label="프로세스 종료"
        >
          <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
            <path d="M1 1l7 7M8 1L1 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
