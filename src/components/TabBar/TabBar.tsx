import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useTabStore } from "../../store/tabStore";
import "./TabBar.css";

interface TabBarProps {
  onCloseTab?: (tabId: string) => void;
  onKillTab?: (tabId: string) => void;
  onActivateTab?: (tabId: string) => void;
  onOpenPalette?: () => void;
}

export function TabBar({ onCloseTab, onKillTab, onActivateTab, onOpenPalette }: TabBarProps) {
  const { tabs, activeTabId, removeTab, setActiveTab, renameTab } = useTabStore();
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
  const { t } = useTranslation();
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

  // Context menu state
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
  const ctxMenuRef = useRef<HTMLDivElement>(null);
  const [ctxPos, setCtxPos] = useState({ top: 0, left: 0 });

  // Viewport clamping
  useEffect(() => {
    if (!ctxMenu) return;
    const el = ctxMenuRef.current;
    if (!el) {
      setCtxPos({ top: ctxMenu.y, left: ctxMenu.x });
      return;
    }
    const rect = el.getBoundingClientRect();
    let top = ctxMenu.y;
    let left = ctxMenu.x;
    if (top + rect.height > window.innerHeight) top = window.innerHeight - rect.height - 4;
    if (left + rect.width > window.innerWidth) left = window.innerWidth - rect.width - 4;
    if (top < 0) top = 4;
    if (left < 0) left = 4;
    setCtxPos({ top, left });
  }, [ctxMenu]);

  // Close on outside click or Escape
  useEffect(() => {
    if (!ctxMenu) return;
    const onMouseDown = (e: MouseEvent) => {
      if (ctxMenuRef.current && !ctxMenuRef.current.contains(e.target as Node)) {
        setCtxMenu(null);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setCtxMenu(null);
    };
    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [ctxMenu]);

  return (
    <div
      className={`tab-item${isActive ? " tab-item--active" : ""}`}
      data-tab-id={id}
      onClick={onActivate}
      onDoubleClick={startEdit}
      onContextMenu={(e) => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY }); }}
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
          className="tab-item-btn tab-item-btn--kill"
          onClick={(e) => {
            e.stopPropagation();
            onKill();
          }}
          title={t('tab.closeTab')}
          aria-label={t('tab.closeTab')}
        >
          <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
            <path d="M1 1l7 7M8 1L1 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      {ctxMenu && createPortal(
        <div
          ref={ctxMenuRef}
          className="tab-ctx-menu"
          style={{ top: ctxPos.top, left: ctxPos.left }}
        >
          <div className="tab-ctx-item tab-ctx-item--destructive" onMouseDown={(e) => { e.stopPropagation(); onKill(); setCtxMenu(null); }}>
            <span className="tab-ctx-item-icon">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M4 4l6 6M10 4l-6 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
            </span>
            <span className="tab-ctx-item-label">{t('tab.closeTab')}</span>
          </div>
          <div className="tab-ctx-divider" />
          <div className="tab-ctx-item" onMouseDown={(e) => { e.stopPropagation(); startEdit(); setCtxMenu(null); }}>
            <span className="tab-ctx-item-icon">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2 11h3l6.5-6.5a1.4 1.4 0 0 0-2-2L3 9v3z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
                <path d="M8.5 3.5l2 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
            </span>
            <span className="tab-ctx-item-label">{t('tab.renameTab')}</span>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
