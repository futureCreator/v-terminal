import { useState, useRef } from "react";
import { homeDir } from "@tauri-apps/api/path";
import { useTabStore } from "../../store/tabStore";
import "./TabBar.css";

interface TabBarProps {
  onOpenSshManager: () => void;
}

export function TabBar({ onOpenSshManager }: TabBarProps) {
  const { tabs, activeTabId, addTab, removeTab, setActiveTab, renameTab, reorderTabs } =
    useTabStore();

  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const dragIdRef = useRef<string | null>(null);

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
      <div
        className="tabbar-tabs"
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            setDragOverId(null);
          }
        }}
      >
        {tabs.map((tab) => (
          <TabItem
            key={tab.id}
            id={tab.id}
            label={tab.label}
            isActive={tab.id === activeTabId}
            isDragOver={tab.id === dragOverId}
            onActivate={() => setActiveTab(tab.id)}
            onClose={() => removeTab(tab.id)}
            onRename={(label) => renameTab(tab.id, label)}
            onDragStart={() => {
              dragIdRef.current = tab.id;
            }}
            onDragOver={() => setDragOverId(tab.id)}
            onDrop={() => {
              if (dragIdRef.current && dragIdRef.current !== tab.id) {
                reorderTabs(dragIdRef.current, tab.id);
              }
              setDragOverId(null);
              dragIdRef.current = null;
            }}
            onDragEnd={() => {
              setDragOverId(null);
              dragIdRef.current = null;
            }}
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
  isDragOver: boolean;
  onActivate: () => void;
  onClose: () => void;
  onRename: (label: string) => void;
  onDragStart: () => void;
  onDragOver: () => void;
  onDrop: () => void;
  onDragEnd: () => void;
}

function TabItem({
  label,
  isActive,
  isDragOver,
  onActivate,
  onClose,
  onRename,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: TabItemProps) {
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
      className={`tab-item ${isActive ? "tab-item--active" : ""} ${isDragOver ? "tab-item--drag-over" : ""}`}
      draggable
      onClick={onActivate}
      onDoubleClick={startEdit}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        onDragOver();
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDrop();
      }}
      onDragEnd={onDragEnd}
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
        title="Close tab"
        aria-label="Close tab"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
