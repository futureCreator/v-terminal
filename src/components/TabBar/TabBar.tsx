import { useState, useRef, useEffect, useCallback } from "react";
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
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollButtons = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const hasOverflow = el.scrollWidth > el.clientWidth + 1;
    setCanScrollLeft(el.scrollLeft > 1);
    setCanScrollRight(hasOverflow && el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
  }, []);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    updateScrollButtons();
    el.addEventListener("scroll", updateScrollButtons, { passive: true });
    const ro = new ResizeObserver(updateScrollButtons);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", updateScrollButtons);
      ro.disconnect();
    };
  }, [tabs.length, updateScrollButtons]);

  // Auto-scroll active tab into view when switching tabs
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const activeEl = el.querySelector<HTMLElement>(".tab-item--active");
    if (activeEl) {
      activeEl.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  }, [activeTabId]);

  const handleScrollLeft = () => {
    scrollContainerRef.current?.scrollBy({ left: -180, behavior: "smooth" });
  };

  const handleScrollRight = () => {
    scrollContainerRef.current?.scrollBy({ left: 180, behavior: "smooth" });
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
      {canScrollLeft && (
        <button
          className="tabbar-scroll tabbar-scroll--left"
          onClick={handleScrollLeft}
          aria-label="Scroll tabs left"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M7.5 2L3.5 6L7.5 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}
      <div className="tabbar-tabs" ref={scrollContainerRef}>
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
      {canScrollRight && (
        <button
          className="tabbar-scroll tabbar-scroll--right"
          onClick={handleScrollRight}
          aria-label="Scroll tabs right"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M4.5 2L8.5 6L4.5 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}
      <div className="tabbar-sep" />
      <button
        className="tabbar-add"
        onClick={handleAddTab}
        title="New Tab"
        aria-label="New tab"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
      <button
        className="tabbar-ssh"
        onClick={onOpenSshManager}
        title="SSH Connections"
        aria-label="SSH connections"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <rect x="1" y="2.5" width="14" height="4" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
          <rect x="1" y="9.5" width="14" height="4" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
          <circle cx="12.5" cy="4.5" r="1" fill="currentColor" />
          <circle cx="12.5" cy="11.5" r="1" fill="currentColor" />
          <circle cx="10" cy="4.5" r="0.7" fill="currentColor" opacity="0.5" />
          <circle cx="10" cy="11.5" r="0.7" fill="currentColor" opacity="0.5" />
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
          title="Send to Background"
          aria-label="Send to background"
        >
          <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
            <path d="M4.5 1v5.5M2.5 4.5L4.5 6.5L6.5 4.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M1 8h7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
        </button>
        <button
          className="tab-item-btn tab-item-btn--kill"
          onClick={(e) => { e.stopPropagation(); onKill(); }}
          title="Kill Process"
          aria-label="Kill process"
        >
          <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
            <path d="M1 1l7 7M8 1L1 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
