import { useState, useRef } from "react";
import { homeDir } from "@tauri-apps/api/path";
import { useTabStore } from "../../store/tabStore";
import "./TabBar.css";

interface TabBarProps {
  onOpenSshManager: () => void;
  onCloseTab?: (tabId: string) => void;
  receivingTabIds?: Set<string>;
  onActivateTab?: (tabId: string) => void;
}

export function TabBar({ onOpenSshManager, onCloseTab, receivingTabIds, onActivateTab }: TabBarProps) {
  const { tabs, activeTabId, addTab, removeTab, setActiveTab, renameTab, reorderTabs } =
    useTabStore();

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const dragOverIdRef = useRef<string | null>(null);
  const hasDraggedRef = useRef(false);
  const preventClickRef = useRef(false);

  const handleTabPointerDown = (e: React.PointerEvent<HTMLDivElement>, tabId: string) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest(".tab-item-close")) return;

    const startX = e.clientX;
    hasDraggedRef.current = false;
    dragOverIdRef.current = null;

    const onMove = (ev: PointerEvent) => {
      const dx = Math.abs(ev.clientX - startX);
      if (dx < 5 && !hasDraggedRef.current) return;

      if (!hasDraggedRef.current) {
        hasDraggedRef.current = true;
        setDraggingId(tabId);
        document.body.style.cursor = "grabbing";
        document.body.style.userSelect = "none";
      }

      if (!tabsContainerRef.current) return;
      const tabEls = Array.from(
        tabsContainerRef.current.querySelectorAll<HTMLElement>("[data-tab-id]")
      );
      let foundId: string | null = null;

      for (const el of tabEls) {
        const rect = el.getBoundingClientRect();
        if (ev.clientX >= rect.left && ev.clientX <= rect.right) {
          foundId = el.dataset.tabId ?? null;
          break;
        }
      }

      if (foundId !== dragOverIdRef.current) {
        dragOverIdRef.current = foundId;
        setDragOverId(foundId);
      }
    };

    const onUp = () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";

      if (hasDraggedRef.current) {
        const toId = dragOverIdRef.current;
        if (toId && toId !== tabId) {
          reorderTabs(tabId, toId);
        }
        preventClickRef.current = true;
      }

      hasDraggedRef.current = false;
      dragOverIdRef.current = null;
      setDraggingId(null);
      setDragOverId(null);
    };

    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
  };

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
      <div className="tabbar-tabs" ref={tabsContainerRef}>
        {tabs.map((tab) => (
          <TabItem
            key={tab.id}
            id={tab.id}
            label={tab.label}
            isActive={tab.id === activeTabId}
            isDragging={tab.id === draggingId}
            isDragOver={tab.id === dragOverId && tab.id !== draggingId}
            hasActivity={tab.hasActivity ?? false}
            isReceiving={receivingTabIds?.has(tab.id) ?? false}
            onActivate={() => {
              if (preventClickRef.current) {
                preventClickRef.current = false;
                return;
              }
              if (onActivateTab) {
                onActivateTab(tab.id);
              } else {
                setActiveTab(tab.id);
              }
            }}
            onClose={() => (onCloseTab ? onCloseTab(tab.id) : removeTab(tab.id))}
            onRename={(label) => renameTab(tab.id, label)}
            onPointerDown={(e) => handleTabPointerDown(e, tab.id)}
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
  isDragging: boolean;
  isDragOver: boolean;
  hasActivity: boolean;
  isReceiving: boolean;
  onActivate: () => void;
  onClose: () => void;
  onRename: (label: string) => void;
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
}

function TabItem({
  id,
  label,
  isActive,
  isDragging,
  isDragOver,
  hasActivity,
  isReceiving,
  onActivate,
  onClose,
  onRename,
  onPointerDown,
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
      className={`tab-item${isActive ? " tab-item--active" : ""}${isDragOver ? " tab-item--drag-over" : ""}${isDragging ? " tab-item--dragging" : ""}`}
      data-tab-id={id}
      onClick={onActivate}
      onDoubleClick={startEdit}
      onPointerDown={onPointerDown}
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
      {!isActive && hasActivity && (
        <span
          className={`tab-activity-dot${isReceiving ? " tab-activity-dot--receiving" : ""}`}
          aria-hidden="true"
        />
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
