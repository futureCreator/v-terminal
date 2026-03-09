import { useState, useRef } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { useTabStore } from "../../store/tabStore";
import "./TabBar.css";

export function TabBar() {
  const { tabs, activeTabId, addTab, removeTab, setActiveTab, renameTab } =
    useTabStore();

  const handleAddTab = async () => {
    let cwd: string | null = null;
    try {
      const selected = await open({ directory: true, multiple: false });
      cwd = typeof selected === "string" ? selected : null;
    } catch {
      // user cancelled or dialog not available
    }

    // Fallback to home/userprofile
    if (!cwd) {
      cwd =
        (window as unknown as Record<string, string>).__INITIAL_CWD__ ??
        "C:\\Users";
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
            onActivate={() => setActiveTab(tab.id)}
            onClose={() => removeTab(tab.id)}
            onRename={(label) => renameTab(tab.id, label)}
          />
        ))}
      </div>
      <button className="tabbar-add" onClick={handleAddTab} title="New Tab" aria-label="New tab">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
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
  onRename: (label: string) => void;
}

function TabItem({ label, isActive, onActivate, onClose, onRename }: TabItemProps) {
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
      className={`tab-item ${isActive ? "tab-item--active" : ""}`}
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
      <button
        className="tab-item-close"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
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
