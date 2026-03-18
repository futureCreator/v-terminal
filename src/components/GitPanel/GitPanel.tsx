import React, { useEffect } from "react";
import { useGitStore } from "../../store/gitStore";
import { useSessionCwd } from "../../hooks/useSessionCwd";
import { ipc } from "../../lib/tauriIpc";
import { GitFileList } from "./GitFileList";
import "./GitPanel.css";

interface Props {
  focusedSessionId?: string;
}

export const GitPanel: React.FC<Props> = ({ focusedSessionId }) => {
  const store = useGitStore();
  const cwd = useSessionCwd(focusedSessionId ?? null);

  // Track session
  useEffect(() => {
    store.setTrackedSession(focusedSessionId ?? null);
  }, [focusedSessionId]);

  // Track CWD
  useEffect(() => {
    store.setCwd(cwd);
  }, [cwd]);

  // Subscribe to git status changes (file watcher)
  useEffect(() => {
    let unsub: (() => void) | null = null;
    ipc.onGitStatusChanged((payload) => {
      const currentCwd = useGitStore.getState().trackedCwd;
      if (payload.cwd === currentCwd) {
        useGitStore.getState().refreshStatus();
      }
    }).then((u) => { unsub = u; });
    return () => { unsub?.(); };
  }, []);

  const handleFileClick = (path: string, staged: boolean) => {
    store.selectFile(path, staged);
  };

  const handleRefresh = () => {
    store.refreshStatus();
  };

  if (!focusedSessionId) {
    return <div className="git-panel__empty">No active session</div>;
  }

  if (store.loading) {
    return <div className="git-panel__loading">Loading...</div>;
  }

  if (store.error) {
    return <div className="git-panel__error">{store.error}</div>;
  }

  if (!store.isGitRepo) {
    return <div className="git-panel__empty">Not a git repository</div>;
  }

  const hasChanges = store.unstagedFiles.length > 0 || store.stagedFiles.length > 0;

  return (
    <div className="git-panel">
      <div className="git-panel__header">
        <span className="git-panel__title">Changes</span>
        <button className="git-panel__refresh" onClick={handleRefresh} title="Refresh">
          ↻
        </button>
      </div>
      {!hasChanges ? (
        <div className="git-panel__empty">No changes</div>
      ) : (
        <div className="git-panel__content">
          <GitFileList
            title="Unstaged Changes"
            files={store.unstagedFiles}
            selectedPath={store.selectedFile?.path ?? null}
            selectedStaged={store.selectedFile?.staged ?? false}
            isStaged={false}
            onFileClick={handleFileClick}
          />
          <GitFileList
            title="Staged Changes"
            files={store.stagedFiles}
            selectedPath={store.selectedFile?.path ?? null}
            selectedStaged={store.selectedFile?.staged ?? false}
            isStaged={true}
            onFileClick={handleFileClick}
          />
        </div>
      )}
    </div>
  );
};
