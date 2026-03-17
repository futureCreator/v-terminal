import { useState, useCallback } from "react";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { allTopics } from "../../data/cheatsheets";
import { Toast } from "../Toast/Toast";
import "./CheatsheetPanel.css";

export function CheatsheetPanel() {
  const [activeTopic, setActiveTopic] = useState(allTopics[0].id);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(
    allTopics[0].categories.map((c) => c.name)
  ));
  const [toastVisible, setToastVisible] = useState(false);

  const topic = allTopics.find((t) => t.id === activeTopic) ?? allTopics[0];

  const toggleCategory = (name: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const handleTopicChange = (topicId: string) => {
    setActiveTopic(topicId);
    const t = allTopics.find((tp) => tp.id === topicId);
    if (t) setExpandedCategories(new Set(t.categories.map((c) => c.name)));
  };

  const handleCopy = useCallback(async (command: string) => {
    try {
      await writeText(command);
      setToastVisible(true);
    } catch {
      // write failed
    }
  }, []);

  const handleToastHide = useCallback(() => setToastVisible(false), []);

  return (
    <div className="cheatsheet-panel">
      <div className="cheatsheet-topics">
        {allTopics.map((t) => (
          <button
            key={t.id}
            className={`cheatsheet-topic-btn${t.id === activeTopic ? " cheatsheet-topic-btn--active" : ""}`}
            onClick={() => handleTopicChange(t.id)}
          >
            {t.name}
          </button>
        ))}
      </div>

      <div className="cheatsheet-body">
        {topic.categories.map((cat) => {
          const isExpanded = expandedCategories.has(cat.name);
          return (
            <div key={cat.name} className="collapsible-section">
              <button className="collapsible-header" onClick={() => toggleCategory(cat.name)}>
                <svg
                  className={`collapsible-chevron${isExpanded ? " collapsible-chevron--open" : ""}`}
                  width="8" height="8" viewBox="0 0 8 8" fill="none"
                >
                  <path d="M2 1.5L5.5 4 2 6.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="collapsible-label">{cat.name}</span>
                <span className="collapsible-status"><span className="collapsible-status-text">{cat.items.length}</span></span>
              </button>
              {isExpanded && (
                <div className="collapsible-body">
                  {cat.items.map((item) => (
                    <button
                      key={item.command}
                      className="cheatsheet-item"
                      onClick={() => handleCopy(item.command)}
                      title="Click to copy"
                    >
                      <code className="cheatsheet-command">{item.command}</code>
                      <span className="cheatsheet-desc">{item.description}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Toast message="Copied!" visible={toastVisible} onHide={handleToastHide} />
    </div>
  );
}
