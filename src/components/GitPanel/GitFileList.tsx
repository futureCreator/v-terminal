import React, { useState } from "react";
import { GitFileEntry } from "../../lib/tauriIpc";
import { GitFileEntryRow } from "./GitFileEntry";

interface Props {
  title: string;
  files: GitFileEntry[];
  selectedPath: string | null;
  selectedStaged: boolean;
  isStaged: boolean;
  onFileClick: (path: string, staged: boolean) => void;
}

export const GitFileList: React.FC<Props> = ({
  title,
  files,
  selectedPath,
  selectedStaged,
  isStaged,
  onFileClick,
}) => {
  const [expanded, setExpanded] = useState(true);

  if (files.length === 0) return null;

  return (
    <div className="git-file-list">
      <div
        className="git-file-list__header"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="git-file-list__arrow">{expanded ? "▼" : "▶"}</span>
        <span className="git-file-list__title">{title}</span>
        <span className="git-file-list__count">{files.length}</span>
      </div>
      {expanded && (
        <div className="git-file-list__items">
          {files.map((file) => (
            <GitFileEntryRow
              key={`${isStaged ? "s" : "u"}-${file.path}`}
              entry={file}
              selected={selectedPath === file.path && selectedStaged === isStaged}
              onClick={() => onFileClick(file.path, isStaged)}
            />
          ))}
        </div>
      )}
    </div>
  );
};
