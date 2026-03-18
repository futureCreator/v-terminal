import { useState } from "react";
import { useClaudeCodeStore } from "../../store/claudeCodeStore";
import { ClaudeMdEditor } from "./ClaudeMdEditor";

export function ClaudeMdTab() {
  const { files, loading, error } = useClaudeCodeStore();
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());

  const toggleExpanded = (path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="claude-md-empty">
        <span>Loading...</span>
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="claude-md-empty">
        <span>No CLAUDE.md found</span>
      </div>
    );
  }

  return (
    <div className="claude-md-list">
      {error && (
        <div style={{ color: "var(--system-red)", fontSize: 11, padding: "4px 8px" }}>
          {error}
        </div>
      )}
      {files.map((file) => {
        const isExpanded = expandedPaths.has(file.path);
        return (
          <div key={file.path} className="claude-md-section">
            <button
              className="claude-md-section-header"
              onClick={() => toggleExpanded(file.path)}
            >
              <svg
                width="8"
                height="8"
                viewBox="0 0 8 8"
                className={`collapsible-chevron${isExpanded ? " collapsible-chevron--open" : ""}`}
              >
                <path d="M2 1l4 3-4 3" fill="currentColor" />
              </svg>
              <span className="claude-md-level-badge">{file.level}</span>
              <span className="claude-md-path">{file.path}</span>
            </button>
            {isExpanded && (
              <div className="claude-md-editor-wrap">
                <ClaudeMdEditor
                  path={file.path}
                  content={file.content}
                  readonly={file.readonly}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
