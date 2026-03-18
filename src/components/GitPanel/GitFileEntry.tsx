import React from "react";
import { GitFileEntry as GitFileEntryType } from "../../lib/tauriIpc";

interface Props {
  entry: GitFileEntryType;
  selected: boolean;
  onClick: () => void;
}

const STATUS_COLORS: Record<string, string> = {
  modified: "var(--git-modified, #e2b714)",
  added: "var(--git-added, #2ea043)",
  deleted: "var(--git-deleted, #f85149)",
  renamed: "var(--git-renamed, #58a6ff)",
  untracked: "var(--git-untracked, #8b949e)",
};

const STATUS_LABELS: Record<string, string> = {
  modified: "M",
  added: "A",
  deleted: "D",
  renamed: "R",
  untracked: "?",
};

export const GitFileEntryRow: React.FC<Props> = ({ entry, selected, onClick }) => {
  const color = STATUS_COLORS[entry.status] || "#8b949e";
  const label = STATUS_LABELS[entry.status] || "?";

  return (
    <div
      className={`git-file-entry ${selected ? "git-file-entry--selected" : ""}`}
      onClick={onClick}
      title={entry.path}
    >
      <span className="git-file-status" style={{ color }}>{label}</span>
      <span className="git-file-path">{entry.path}</span>
    </div>
  );
};
