import type { TFunction } from "i18next";
import type { PaletteSection } from "../components/CommandPalette/CommandPalette";
import type { Tab, Layout, PanelConnection, SshProfile, Panel } from "../types/terminal";
import type { ClipboardEntry } from "../store/clipboardStore";
import { formatRelativeTime } from "./formatters";
import { cleanupNotePanel } from "./noteCleanup";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";

/* ── Icon helper ─────────────────────────────────────────────────── */

function Icon({ children }: { children: React.ReactNode }) {
  return <span className="cp-cmd-icon">{children}</span>;
}

/* ── Tab commands ────────────────────────────────────────────────── */

interface TabCommandsParams {
  activeTab: Tab | undefined;
  tabs: Tab[];
  sidebarOpen: boolean;
  browserPanelOpen: boolean;
  panelCount: number;
  onNewTab: () => void;
  onCloseTab: () => void;
  onToggleBroadcast: () => void;
  onPrevTab: () => void;
  onNextTab: () => void;
  onToggleToolkit: () => void;
  onToggleBrowserPanel: () => void;
  onOpenSshProfiles: () => void;
  onOpenSettings: () => void;
  onTogglePanelZoom: () => void;
  onPrevPanel: () => void;
  onNextPanel: () => void;
}

export function buildTabSection(p: TabCommandsParams, t: TFunction): PaletteSection {
  const commands = [
    {
      id: "tab:new",
      label: t('command.newTab'),
      description: t('command.newTabDesc'),
      meta: "Ctrl+Shift+T",
      icon: <Icon><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg></Icon>,
      action: p.onNewTab,
    },
    {
      id: "tab:close",
      label: t('command.closeCurrentTab'),
      description: t('command.closeCurrentTabDesc'),
      icon: <Icon><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M4 4l6 6M10 4l-6 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg></Icon>,
      action: p.onCloseTab,
    },
    {
      id: "tab:broadcast",
      label: p.activeTab?.broadcastEnabled ? t('command.disableBroadcast') : t('command.enableBroadcast'),
      description: t('command.broadcastDesc'),
      icon: <Icon><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="1.5" fill="currentColor" /><path d="M4 7a3 3 0 0 1 3-3M10 7a3 3 0 0 1-3 3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" /><path d="M1.5 7A5.5 5.5 0 0 1 7 1.5M12.5 7A5.5 5.5 0 0 1 7 12.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" /></svg></Icon>,
      isActive: p.activeTab?.broadcastEnabled,
      action: p.onToggleBroadcast,
    },
    ...(p.tabs.length > 1 ? [
      {
        id: "tab:prev",
        label: t('command.previousTab'),
        description: t('command.previousTabDesc'),
        icon: <Icon><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M8 3L4 7l4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /><rect x="9" y="3" width="2" height="8" rx="0.8" fill="currentColor" opacity="0.35" /></svg></Icon>,
        action: p.onPrevTab,
      },
      {
        id: "tab:next",
        label: t('command.nextTab'),
        description: t('command.nextTabDesc'),
        icon: <Icon><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M6 3l4 4-4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /><rect x="3" y="3" width="2" height="8" rx="0.8" fill="currentColor" opacity="0.35" /></svg></Icon>,
        action: p.onNextTab,
      },
    ] : []),
    {
      id: "view:toolkit",
      label: p.sidebarOpen ? t('command.hideToolkit') : t('command.showToolkit'),
      description: t('command.toolkitDesc'),
      meta: "Ctrl+Shift+N",
      icon: <Icon><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="1" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.1" /><rect x="8" y="1" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.1" /><rect x="1" y="8" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.1" /><rect x="8" y="8" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.1" /></svg></Icon>,
      isActive: p.sidebarOpen,
      action: p.onToggleToolkit,
    },
    {
      id: "view:browser",
      label: p.browserPanelOpen ? t('command.hideBrowser') : t('command.showBrowser'),
      description: t('command.browserDesc'),
      meta: "Ctrl+Shift+B",
      icon: <Icon><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.2" /><ellipse cx="7" cy="7" rx="2.5" ry="5.5" stroke="currentColor" strokeWidth="1" /><line x1="1.5" y1="7" x2="12.5" y2="7" stroke="currentColor" strokeWidth="1" /></svg></Icon>,
      isActive: p.browserPanelOpen,
      action: p.onToggleBrowserPanel,
    },
    {
      id: "ssh:profiles",
      label: t('command.sshProfiles'),
      description: t('command.sshProfilesDesc'),
      icon: <Icon><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="3" width="12" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.3" /><path d="M1 5.5h12" stroke="currentColor" strokeWidth="1.3" /><circle cx="3" cy="4.25" r="0.6" fill="currentColor" /><circle cx="5" cy="4.25" r="0.6" fill="currentColor" /><path d="M3.5 8.5l2 1.5-2 1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /><path d="M8 11.5h2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg></Icon>,
      action: p.onOpenSshProfiles,
    },
    {
      id: "settings",
      label: t('command.settings'),
      description: t('command.settingsDesc'),
      icon: <Icon><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="2.5" stroke="currentColor" strokeWidth="1.3" /><path d="M7 1v1.5M7 11.5V13M1 7h1.5M11.5 7H13M3.05 3.05l1.06 1.06M9.89 9.89l1.06 1.06M10.95 3.05l-1.06 1.06M4.11 9.89l-1.06 1.06" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg></Icon>,
      action: p.onOpenSettings,
    },
    ...(p.panelCount > 1 ? [
      {
        id: "panel:zoom",
        label: t('command.zoomCurrentPanel'),
        description: t('command.zoomCurrentPanelDesc'),
        icon: <Icon><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 5V2h3M10 2h3v3M13 9v3h-3M4 13H1v-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg></Icon>,
        action: p.onTogglePanelZoom,
      },
      {
        id: "panel:prev",
        label: t('command.previousPanel'),
        description: t('command.previousPanelDesc'),
        icon: <Icon><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="1" width="5.5" height="12" rx="1" stroke="currentColor" strokeWidth="1.2" /><rect x="7.5" y="1" width="5.5" height="12" rx="1" stroke="currentColor" strokeWidth="1.2" opacity="0.4" /><path d="M4.5 7H11M4.5 7L6.5 5M4.5 7L6.5 9" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" /></svg></Icon>,
        action: p.onPrevPanel,
      },
      {
        id: "panel:next",
        label: t('command.nextPanel'),
        description: t('command.nextPanelDesc'),
        icon: <Icon><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="1" width="5.5" height="12" rx="1" stroke="currentColor" strokeWidth="1.2" opacity="0.4" /><rect x="7.5" y="1" width="5.5" height="12" rx="1" stroke="currentColor" strokeWidth="1.2" /><path d="M9.5 7H3M9.5 7L7.5 5M9.5 7L7.5 9" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" /></svg></Icon>,
        action: p.onNextPanel,
      },
    ] : []),
  ];

  return { category: t('command.categoryTab'), commands };
}

/* ── Tab list commands ───────────────────────────────────────────── */

export function buildTabListSection(
  tabs: Tab[],
  activeTabId: string,
  setActiveTab: (id: string) => void,
  t: TFunction,
): PaletteSection {
  return {
    category: t('command.categoryTabList'),
    commands: tabs.map((tab) => ({
      id: `tab:switch:${tab.id}`,
      label: tab.label,
      icon: <Icon><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="3" width="12" height="9" rx="1.2" stroke="currentColor" strokeWidth="1.2" /><path d="M1 6h12" stroke="currentColor" strokeWidth="1.2" /><path d="M4 4.5V1.5M10 4.5V1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg></Icon>,
      isActive: tab.id === activeTabId,
      action: () => setActiveTab(tab.id),
    })),
  };
}

/* ── Layout commands ─────────────────────────────────────────────── */

const LAYOUT_OPTIONS: Array<{ value: Layout; labelKey: string; icon: React.ReactNode }> = [
  {
    value: 1,
    labelKey: "command.panel1",
    icon: <Icon><svg width="16" height="12" viewBox="0 0 18 14" fill="none"><rect x="1" y="1" width="16" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.2" /></svg></Icon>,
  },
  {
    value: 2,
    labelKey: "command.panels2",
    icon: <Icon><svg width="16" height="12" viewBox="0 0 18 14" fill="none"><rect x="1" y="1" width="7" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.2" /><rect x="10" y="1" width="7" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.2" /></svg></Icon>,
  },
  {
    value: "2r",
    labelKey: "command.rows2",
    icon: <Icon><svg width="16" height="12" viewBox="0 0 18 14" fill="none"><rect x="1" y="1" width="16" height="5.5" rx="1.5" stroke="currentColor" strokeWidth="1.2" /><rect x="1" y="7.5" width="16" height="5.5" rx="1.5" stroke="currentColor" strokeWidth="1.2" /></svg></Icon>,
  },
  {
    value: 3,
    labelKey: "command.panels3",
    icon: <Icon><svg width="16" height="12" viewBox="0 0 18 14" fill="none"><rect x="1" y="1" width="7" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.2" /><rect x="10" y="1" width="7" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.2" /><rect x="10" y="7.5" width="7" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.2" /></svg></Icon>,
  },
  {
    value: 4,
    labelKey: "command.panels4",
    icon: <Icon><svg width="16" height="12" viewBox="0 0 18 14" fill="none"><rect x="1" y="1" width="7" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.2" /><rect x="10" y="1" width="7" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.2" /><rect x="1" y="7.5" width="7" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.2" /><rect x="10" y="7.5" width="7" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.2" /></svg></Icon>,
  },
  {
    value: "3c",
    labelKey: "command.columns3",
    icon: <Icon><svg width="16" height="12" viewBox="0 0 20 14" fill="none"><rect x="1" y="1" width="5" height="12" rx="1" stroke="currentColor" strokeWidth="1.1" /><rect x="7.5" y="1" width="5" height="12" rx="1" stroke="currentColor" strokeWidth="1.1" /><rect x="14" y="1" width="5" height="12" rx="1" stroke="currentColor" strokeWidth="1.1" /></svg></Icon>,
  },
  {
    value: 6,
    labelKey: "command.panels6",
    icon: <Icon><svg width="16" height="12" viewBox="0 0 20 14" fill="none"><rect x="1" y="1" width="5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.1" /><rect x="7.5" y="1" width="5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.1" /><rect x="14" y="1" width="5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.1" /><rect x="1" y="7.5" width="5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.1" /><rect x="7.5" y="7.5" width="5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.1" /><rect x="14" y="7.5" width="5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.1" /></svg></Icon>,
  },
];

export function buildLayoutSection(
  activeTab: Tab | undefined,
  onLayoutChange: (layout: Layout) => void,
  t: TFunction,
): PaletteSection {
  return {
    category: t('command.categoryLayout'),
    commands: LAYOUT_OPTIONS.map(({ value, labelKey, icon }) => ({
      id: `layout:${value}`,
      label: t(labelKey),
      description: t('command.splitLayout', { layout: t(labelKey).toLowerCase() }),
      icon,
      isActive: activeTab?.layout === value,
      action: () => onLayoutChange(value),
    })),
  };
}

/* ── Clipboard commands ──────────────────────────────────────────── */

export function buildClipboardSection(
  entries: ClipboardEntry[],
  clearHistory: () => void,
  t: TFunction,
): PaletteSection {
  const commands = entries.map((entry) => {
    const preview = entry.text.split("\n")[0].slice(0, 80);
    return {
      id: `clip:${entry.id}`,
      label: preview,
      meta: formatRelativeTime(entry.copiedAt),
      icon: <Icon><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="3" y="1" width="8" height="2" rx="1" stroke="currentColor" strokeWidth="1.1" /><rect x="2" y="2.5" width="10" height="10.5" rx="1.5" stroke="currentColor" strokeWidth="1.2" /></svg></Icon>,
      action: async () => {
        try { await writeText(entry.text); } catch { /* ignore */ }
      },
    };
  });

  if (entries.length > 0) {
    commands.push({
      id: "clip:clear",
      label: t('command.clearClipboardHistory'),
      meta: "",
      icon: <Icon><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 4h8M5.5 4V3h3v1M4 4v7.5a1 1 0 001 1h4a1 1 0 001-1V4" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" /></svg></Icon>,
      action: async () => { clearHistory(); },
    });
  }

  return { category: t('command.categoryClipboard'), commands };
}

/* ── Switch Connection commands ──────────────────────────────────── */

interface ConnectionCommandsParams {
  activeTab: Tab | undefined;
  activePanelId: string | null;
  activePanel: Panel | null;
  wslDistros: string[];
  sshProfiles: SshProfile[];
  switchPanelConnection: (tabId: string, panelId: string, connection: PanelConnection) => void;
}

export function buildConnectionSection(p: ConnectionCommandsParams, t: TFunction): PaletteSection | null {
  if (!p.activeTab || !p.activePanelId) return null;

  const conn = p.activePanel?.connection;
  const connType = conn?.type ?? "local";
  const isActiveLocal = connType === "local";
  const tabId = p.activeTab.id;
  const panelId = p.activePanelId;

  const commands = [
    {
      id: "conn:local",
      label: t('session.localShell'),
      description: t('connection.switchToLocal'),
      meta: t('session.powerShell'),
      icon: <Icon><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="2" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2" /><path d="M3.5 6l2 1.5-2 1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /><path d="M7.5 9.5h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg></Icon>,
      isActive: isActiveLocal,
      action: () => {
        if (isActiveLocal) return;
        if (connType === "note") cleanupNotePanel(panelId);
        p.switchPanelConnection(tabId, panelId, { type: "local" });
      },
    },
    {
      id: "conn:note",
      label: t('session.note'),
      description: t('connection.switchToNote'),
      meta: t('note.markdown'),
      icon: <Icon><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="2" y="1" width="10" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.2" /><line x1="4.5" y1="4" x2="9.5" y2="4" stroke="currentColor" strokeWidth="1" strokeLinecap="round" /><line x1="4.5" y1="6.5" x2="9.5" y2="6.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" /><line x1="4.5" y1="9" x2="7.5" y2="9" stroke="currentColor" strokeWidth="1" strokeLinecap="round" /></svg></Icon>,
      isActive: connType === "note",
      action: () => {
        if (connType === "note") return;
        p.switchPanelConnection(tabId, panelId, { type: "note" });
      },
    },
    ...p.wslDistros.map((distro) => {
      const isActiveWsl = connType === "wsl" && conn?.wslDistro === distro;
      return {
        id: `conn:wsl:${distro}`,
        label: distro,
        description: t('connection.switchToWsl', { distro }),
        meta: "WSL",
        icon: <Icon><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.2" /><path d="M4 5.5c.5-1 1.5-1.5 3-1.5s2.5.5 3 1.5M4 8.5c.5 1 1.5 1.5 3 1.5s2.5-.5 3-1.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" /></svg></Icon>,
        isActive: isActiveWsl,
        action: () => {
          if (isActiveWsl) return;
          if (connType === "note") cleanupNotePanel(panelId);
          p.switchPanelConnection(tabId, panelId, { type: "wsl", wslDistro: distro });
        },
      };
    }),
    ...p.sshProfiles.map((profile) => {
      const isActiveSsh = connType === "ssh" && conn?.sshProfileId === profile.id;
      return {
        id: `conn:ssh:${profile.id}`,
        label: profile.name,
        description: t('connection.switchToSsh', { target: `${profile.username}@${profile.host}${profile.port !== 22 ? `:${profile.port}` : ""}` }),
        meta: `${profile.username}@${profile.host}`,
        icon: <Icon><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="3" width="12" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.3" /><path d="M1 5.5h12" stroke="currentColor" strokeWidth="1.3" /><circle cx="3" cy="4.25" r="0.6" fill="currentColor" /><circle cx="5" cy="4.25" r="0.6" fill="currentColor" /><path d="M3.5 8.5l2 1.5-2 1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /><path d="M8 11.5h2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg></Icon>,
        isActive: isActiveSsh,
        action: () => {
          if (isActiveSsh) return;
          if (connType === "note") cleanupNotePanel(panelId);
          p.switchPanelConnection(tabId, panelId, { type: "ssh", sshProfileId: profile.id });
        },
      };
    }),
  ];

  return { category: t('command.categorySwitchConnection'), commands };
}
