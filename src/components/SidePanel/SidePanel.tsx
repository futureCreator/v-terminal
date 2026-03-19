import { TodoSection } from "../NotePanel/TodoSection";
import { TimersPanel } from "./TimersPanel";
import "../NotePanel/NotePanel.css";
import "./SidePanel.css";

export type SidebarTab = "todos" | "timers";

interface SidePanelProps {
  activeTab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
  onClose: () => void;
}

export function SidePanel({ activeTab, onTabChange, onClose }: SidePanelProps) {
  return (
    <div className="side-panel">
      <div className="side-panel-header">
        <div className="side-panel-tabs">
          <button
            className={`side-panel-tab${activeTab === "todos" ? " side-panel-tab--active" : ""}`}
            onClick={() => onTabChange("todos")}
            title="Todos"
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <rect x="2.5" y="1.5" width="10" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
              <path d="M5 5l1.5 1.5L9 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
              <line x1="5" y1="8.5" x2="10" y2="8.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
              <line x1="5" y1="11" x2="8" y2="11" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
            </svg>
          </button>
          <button
            className={`side-panel-tab${activeTab === "timers" ? " side-panel-tab--active" : ""}`}
            onClick={() => onTabChange("timers")}
            title="Timers"
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <circle cx="7.5" cy="8" r="5" stroke="currentColor" strokeWidth="1.2"/>
              <line x1="7.5" y1="5" x2="7.5" y2="8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              <line x1="7.5" y1="8" x2="9.5" y2="8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              <line x1="7.5" y1="1.5" x2="7.5" y2="3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
        <button
          className="side-panel-close"
          onClick={onClose}
          aria-label="Close panel"
          title="Close panel"
        >
          <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
            <path
              d="M1.5 1.5l6 6M7.5 1.5l-6 6"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      <div className="side-panel-body">
        {activeTab === "todos" && <TodoSection />}
        {activeTab === "timers" && <TimersPanel />}
      </div>
    </div>
  );
}
