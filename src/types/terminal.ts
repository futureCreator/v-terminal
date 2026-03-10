export type Layout = 1 | 2 | 3 | 4 | 6 | 9;

export interface Panel {
  id: string;
  ptyId: string | null; // null until PTY is spawned
}

export interface Tab {
  id: string;
  label: string;
  cwd: string;
  layout: Layout;
  panels: Panel[];
  broadcastEnabled: boolean;
  sshCommand?: string; // auto-execute after PTY start (e.g. ssh user@host)
}

export interface SshProfile {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  identityFile?: string;
}

export interface SessionData {
  tabs: Array<{
    id: string;
    label: string;
    cwd: string;
    layout: Layout;
    broadcastEnabled: boolean;
    sshCommand?: string;
  }>;
  activeTabId: string;
}
