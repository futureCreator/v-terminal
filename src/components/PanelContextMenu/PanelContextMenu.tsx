import { useRef, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import "./PanelContextMenu.css";

interface PanelContextMenuProps {
  x: number;
  y: number;
  currentType: string; // current connection type of the panel
  onSwitchConnection: (type: "local" | "browser") => void;
  onClose: () => void;
}

export function PanelContextMenu({
  x,
  y,
  currentType,
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

  const isLocal = currentType === "local" || currentType === "ssh" || currentType === "wsl" || !currentType;
  const isBrowser = currentType === "browser";

  return createPortal(
    <div
      ref={menuRef}
      className="panel-ctx-menu"
      role="menu"
      style={{ top: pos.top, left: pos.left }}
    >
      <div className="panel-ctx-section-label">Switch Connection</div>
      <button
        className={`panel-ctx-item${isLocal ? " panel-ctx-item--active" : ""}`}
        onClick={() => {
          onSwitchConnection("local");
          onClose();
        }}
        role="menuitem"
      >
        <span className="panel-ctx-item-icon">💻</span>
        <span className="panel-ctx-item-label">Local Shell</span>
        {isLocal && (
          <svg className="panel-ctx-check" width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M3.5 8.5l3 3 6-7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>
      <button
        className={`panel-ctx-item${isBrowser ? " panel-ctx-item--active" : ""}`}
        onClick={() => {
          onSwitchConnection("browser");
          onClose();
        }}
        role="menuitem"
      >
        <span className="panel-ctx-item-icon">🌐</span>
        <span className="panel-ctx-item-label">Browser</span>
        {isBrowser && (
          <svg className="panel-ctx-check" width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M3.5 8.5l3 3 6-7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>
    </div>,
    document.body
  );
}
