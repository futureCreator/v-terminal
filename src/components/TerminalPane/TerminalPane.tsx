import { useRef, useEffect, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { WebglAddon } from "@xterm/addon-webgl";
import { CanvasAddon } from "@xterm/addon-canvas";
import { open as openUrl } from "@tauri-apps/plugin-shell";
import { ipc } from "../../lib/tauriIpc";
import { ensureFontLoaded, ensureSpecificFontLoaded } from "../../lib/fontLoader";
import { useThemeStore, resolveThemeDefinition } from "../../store/themeStore";
import { useTerminalConfigStore } from "../../store/terminalConfigStore";
import "@xterm/xterm/css/xterm.css";
import "./TerminalPane.css";

export const terminalRegistry = new Map<string, Terminal>();

// Module-level singleton — avoids allocating a new TextEncoder on every keystroke
const encoder = new TextEncoder();

interface TerminalPaneProps {
  style?: React.CSSProperties;
  cwd: string;
  isActive: boolean;
  broadcastEnabled: boolean;
  siblingSessionIds: string[];
  connectionType?: 'local' | 'ssh' | 'wsl';
  sshHost?: string;
  sshPort?: number;
  sshUsername?: string;
  sshIdentityFile?: string;
  shellProgram?: string;
  shellArgs?: string[];
  wslDistro?: string;
  onSessionCreated: (sessionId: string, connectionId?: string) => void;
  onSessionKilled: () => void;
  onFocus: () => void;
  onNextPanel?: () => void;
  onPrevPanel?: () => void;
}

export function TerminalPane({
  style,
  cwd,
  isActive,
  broadcastEnabled,
  siblingSessionIds,
  connectionType,
  sshHost,
  sshPort,
  sshUsername,
  sshIdentityFile,
  shellProgram,
  shellArgs,
  wslDistro,
  onSessionCreated,
  onSessionKilled,
  onFocus,
  onNextPanel,
  onPrevPanel,
}: TerminalPaneProps) {
  const { themeId } = useThemeStore();
  const themeRef = useRef(themeId);
  themeRef.current = themeId;

  const { fontSize, fontFamily, cursorStyle, cursorBlink, lineHeight, scrollback } = useTerminalConfigStore();
  const fontSizeRef = useRef(fontSize);
  fontSizeRef.current = fontSize;
  const fontFamilyRef = useRef(fontFamily);
  fontFamilyRef.current = fontFamily;
  const cursorStyleRef = useRef(cursorStyle);
  cursorStyleRef.current = cursorStyle;
  const cursorBlinkRef = useRef(cursorBlink);
  cursorBlinkRef.current = cursorBlink;
  const lineHeightRef = useRef(lineHeight);
  lineHeightRef.current = lineHeight;
  const scrollbackRef = useRef(scrollback);
  scrollbackRef.current = scrollback;

  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const observerRef = useRef<ResizeObserver | null>(null);
  const [exited, setExited] = useState(false);
  const exitedRef = useRef(exited);
  exitedRef.current = exited;
  const [loading, setLoading] = useState(true);
  const [initKey, setInitKey] = useState(0);
  const [connectionLost, setConnectionLost] = useState(false);

  // Password dialog state
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordDialogTitle, setPasswordDialogTitle] = useState("SSH Authentication");
  const [passwordDialogSubtitle, setPasswordDialogSubtitle] = useState("");
  const passwordResolverRef = useRef<((password: string | null) => void) | null>(null);

  const promptPassword = (): Promise<string | null> => {
    return new Promise((resolve) => {
      passwordResolverRef.current = resolve;
      setShowPasswordDialog(true);
      setPasswordError(null);
    });
  };

  const handlePasswordSubmit = () => {
    if (passwordResolverRef.current) {
      passwordResolverRef.current(passwordInput);
      passwordResolverRef.current = null;
      setPasswordInput("");
    }
  };

  const handlePasswordCancel = () => {
    if (passwordResolverRef.current) {
      passwordResolverRef.current(null);
      passwordResolverRef.current = null;
    }
    setShowPasswordDialog(false);
    setExited(true);
  };

  // Store broadcast state in refs to avoid stale closures in the onData handler
  const broadcastRef = useRef(broadcastEnabled);
  const siblingsRef = useRef(siblingSessionIds);
  broadcastRef.current = broadcastEnabled;
  siblingsRef.current = siblingSessionIds;

  const handleRestart = () => {
    setExited(false);
    setLoading(true);
    setConnectionLost(false);
    setInitKey((k) => k + 1);
  };

  useEffect(() => {
    if (!containerRef.current) return;

    let disposed = false;
    let unlistenData: (() => void) | null = null;
    let unlistenExit: (() => void) | null = null;
    let unlistenSshStatus: (() => void) | null = null;
    let visibilityHandler: (() => void) | null = null;
    let focusHandler: (() => void) | null = null;

    const init = async () => {
      await ensureFontLoaded();

      const xtermTheme = resolveThemeDefinition(themeRef.current).xterm;
      const term = new Terminal({
        fontFamily: `"${fontFamilyRef.current}", "JetBrainsMonoNerdFont", "Nanum Gothic Coding", monospace`,
        fontSize: fontSizeRef.current,
        lineHeight: lineHeightRef.current,
        theme: xtermTheme,
        allowTransparency: false,
        scrollback: scrollbackRef.current,
        cursorBlink: cursorBlinkRef.current,
        cursorStyle: cursorStyleRef.current,
        convertEol: false,
      });

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.loadAddon(new WebLinksAddon((_event, uri) => { openUrl(uri).catch(() => {}); }));

      if (disposed || !containerRef.current) {
        term.dispose();
        return;
      }

      term.open(containerRef.current);
      fitAddon.fit();

      // Renderer: WebGL → Canvas → DOM fallback
      try {
        const webglAddon = new WebglAddon();
        webglAddon.onContextLoss(() => {
          webglAddon.dispose();
          try {
            term.loadAddon(new CanvasAddon());
          } catch {
            // DOM renderer remains as final fallback
          }
        });
        term.loadAddon(webglAddon);
      } catch {
        try {
          term.loadAddon(new CanvasAddon());
        } catch {
          // DOM renderer remains as final fallback
        }
      }

      termRef.current = term;
      fitAddonRef.current = fitAddon;

      const { cols, rows } = term;

      // Determine session type and parameters
      const sessType = connectionType ?? 'local';
      let sessionId: string;
      let connectionId: string | undefined;

      try {
        const result = await ipc.sessionCreate({
          type: sessType,
          cwd,
          cols,
          rows,
          shellProgram,
          shellArgs,
          wslDistro,
          ...(sessType === 'ssh' && sshHost && sshUsername ? {
            ssh: {
              host: sshHost,
              port: sshPort ?? 22,
              username: sshUsername,
              identityFile: sshIdentityFile,
            },
          } : {}),
        });
        sessionId = result.sessionId;
        connectionId = result.connectionId;
      } catch (e) {
        const errStr = String(e);

        // Handle password-required flow for SSH
        if (errStr.includes("PASSWORD_REQUIRED") && sshHost && sshUsername) {
          setPasswordDialogTitle("SSH Authentication");
          setPasswordDialogSubtitle(`${sshUsername}@${sshHost}${sshPort && sshPort !== 22 ? `:${sshPort}` : ""}`);
          setLoading(false);
          let authenticated = false;
          while (!authenticated) {
            const password = await promptPassword();
            if (password === null || disposed) return;
            try {
              const result = await ipc.sessionCreateWithPassword({
                host: sshHost,
                port: sshPort ?? 22,
                username: sshUsername,
                password,
                cols: term.cols,
                rows: term.rows,
              });
              sessionId = result.sessionId;
              connectionId = result.connectionId;
              setShowPasswordDialog(false);
              authenticated = true;
            } catch (retryErr) {
              if (String(retryErr).includes("AUTH_FAILED")) {
                setPasswordError("Authentication failed. Please try again.");
                continue;
              }
              setShowPasswordDialog(false);
              term.write(`\r\n\x1b[31mFailed to connect: ${retryErr}\x1b[0m\r\n`);
              setExited(true);
              return;
            }
          }
          setLoading(true);
        } else if (errStr.includes("WSL_SUDO_REQUIRED") && wslDistro) {
          setPasswordDialogTitle("WSL Authentication");
          setPasswordDialogSubtitle(`sudo password for ${wslDistro}`);
          setLoading(false);
          let authenticated = false;
          while (!authenticated) {
            const password = await promptPassword();
            if (password === null || disposed) return;
            try {
              const result = await ipc.sessionCreateWslWithSudo(
                wslDistro, password, term.cols, term.rows
              );
              sessionId = result.sessionId;
              connectionId = result.connectionId;
              setShowPasswordDialog(false);
              authenticated = true;
            } catch (retryErr) {
              if (String(retryErr).includes("WSL_SUDO_REQUIRED") || String(retryErr).includes("AUTH_FAILED")) {
                setPasswordError("Authentication failed. Please try again.");
                continue;
              }
              setShowPasswordDialog(false);
              term.write(`\r\n\x1b[31mFailed to connect: ${retryErr}\x1b[0m\r\n`);
              setExited(true);
              return;
            }
          }
          setLoading(true);
        } else {
          term.write(`\r\n\x1b[31mFailed to start session: ${e}\x1b[0m\r\n`);
          setLoading(false);
          return;
        }
      }

      if (disposed) {
        ipc.sessionKill(sessionId!).catch(() => {});
        term.dispose();
        return;
      }

      sessionIdRef.current = sessionId!;
      terminalRegistry.set(sessionId!, term);
      setLoading(false);
      onSessionCreated(sessionId!, connectionId);

      // Monitor SSH connection status if we have a connectionId
      if (connectionId) {
        unlistenSshStatus = await ipc.onSshConnectionStatus(connectionId, (status) => {
          if (disposed) return;
          if (status === "disconnected") {
            setConnectionLost(true);
          }
        });
      }

      // Clipboard and reserved key handling
      term.attachCustomKeyEventHandler((e) => {
        if (e.type !== "keydown") return true;

        if (e.ctrlKey && e.key === "c") {
          const selection = term.getSelection();
          if (selection) {
            navigator.clipboard.writeText(selection).catch(() => {});
            return false;
          }
          return true; // no selection → pass as SIGINT
        }

        if ((e.metaKey || e.ctrlKey) && e.key === "v") {
          return false;
        }

        if (e.ctrlKey && e.key === "k") {
          return false;
        }

        // Reserved for terminal font size adjustment
        if (e.ctrlKey && !e.shiftKey && (e.key === "=" || e.key === "+" || e.key === "-" || e.key === "0")) {
          return false;
        }

        return true;
      });

      // Input: terminal → session (with optional broadcast)
      term.onData((data) => {
        const encoded = encoder.encode(data);
        ipc.sessionWrite(sessionId!, encoded).catch(() => {});
        if (broadcastRef.current) {
          for (const sibId of siblingsRef.current) {
            if (sibId !== sessionId!) {
              ipc.sessionWrite(sibId, encoded).catch(() => {});
            }
          }
        }
      });

      // Focus tracking (store reference for cleanup)
      focusHandler = () => onFocus();
      term.textarea?.addEventListener("focus", focusHandler);

      // Output: session → terminal
      unlistenData = await ipc.onSessionData(sessionId!, (data) => {
        if (disposed) return;
        term.write(data);
      });

      unlistenExit = await ipc.onSessionExit(sessionId!, () => {
        if (!disposed) {
          setExited(true);
          onSessionKilled();
        }
      });

      // Resize observer with debounce
      if (containerRef.current) {
        let resizeTimeout: ReturnType<typeof setTimeout> | null = null;
        const observer = new ResizeObserver(() => {
          if (disposed || !fitAddonRef.current || !termRef.current) return;

          if (resizeTimeout) clearTimeout(resizeTimeout);
          resizeTimeout = setTimeout(() => {
            resizeTimeout = null;
            if (disposed || !fitAddonRef.current || !termRef.current) return;
            try {
              fitAddon.fit();
              ipc.sessionResize(sessionId!, term.cols, term.rows).catch(() => {});
            } catch {}
          }, 50);
        });
        observer.observe(containerRef.current);
        observerRef.current = observer;
      }

      // Recovery after system sleep/idle: force re-render when page becomes visible.
      // Windows GPU drivers may evict WebGL resources during prolonged idle, leaving
      // the terminal canvas blank even after onContextLoss recovery.
      visibilityHandler = () => {
        if (document.visibilityState === "visible" && !disposed) {
          setTimeout(() => {
            if (disposed || !termRef.current) return;
            termRef.current.clearTextureAtlas();
            termRef.current.refresh(0, termRef.current.rows - 1);
          }, 150);
        }
      };
      document.addEventListener("visibilitychange", visibilityHandler);
    };

    init();

    return () => {
      disposed = true;
      unlistenData?.();
      unlistenExit?.();
      unlistenSshStatus?.();
      if (visibilityHandler) {
        document.removeEventListener("visibilitychange", visibilityHandler);
      }
      observerRef.current?.disconnect();
      observerRef.current = null;
      const term = termRef.current;
      if (term && focusHandler) {
        term.textarea?.removeEventListener("focus", focusHandler);
      }
      const sid = sessionIdRef.current;
      if (sid) {
        terminalRegistry.delete(sid);
        ipc.sessionKill(sid).catch(() => {});
        sessionIdRef.current = null;
      }
      termRef.current?.dispose();
      termRef.current = null;
      fitAddonRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cwd, initKey]);

  // Focus terminal when panel becomes active
  useEffect(() => {
    if (isActive && termRef.current) {
      termRef.current.focus();
    }
  }, [isActive]);

  // Apply font/layout changes — re-fit terminal and notify session of new dimensions
  useEffect(() => {
    const term = termRef.current;
    const fitAddon = fitAddonRef.current;
    if (!term || !fitAddon) return;

    let cancelled = false;

    const apply = async () => {
      // Ensure the selected font is loaded before applying
      await ensureSpecificFontLoaded(fontFamily);
      if (cancelled) return;

      term.options.fontSize = fontSize;
      term.options.fontFamily = `"${fontFamily}", "JetBrainsMonoNerdFont", "Nanum Gothic Coding", monospace`;
      term.options.lineHeight = lineHeight;

      // Force renderer to pick up the new font by clearing the texture atlas
      term.clearTextureAtlas();

      try {
        fitAddon.fit();
        const sid = sessionIdRef.current;
        if (sid) {
          ipc.sessionResize(sid, term.cols, term.rows).catch(() => {});
        }
      } catch {}
    };

    apply();
    return () => { cancelled = true; };
  }, [fontSize, fontFamily, lineHeight]);

  // Apply cursor style changes
  useEffect(() => {
    const term = termRef.current;
    if (!term) return;
    term.options.cursorStyle = cursorStyle;
  }, [cursorStyle]);

  // Apply cursor blink changes
  useEffect(() => {
    const term = termRef.current;
    if (!term) return;
    term.options.cursorBlink = cursorBlink;
  }, [cursorBlink]);

  // Apply scrollback changes
  useEffect(() => {
    const term = termRef.current;
    if (!term) return;
    term.options.scrollback = scrollback;
  }, [scrollback]);

  return (
    <div
      className={`terminal-pane ${isActive ? "terminal-pane--active" : ""}`}
      style={style}
      onClick={() => { onFocus(); termRef.current?.focus(); }}
    >
      {loading && !exited && !showPasswordDialog && (
        <div className="terminal-loading">
          <div className="terminal-spinner" />
        </div>
      )}
      {showPasswordDialog && (
        <div className="terminal-password-dialog">
          <div className="terminal-password-content">
            <div className="terminal-password-title">{passwordDialogTitle}</div>
            <div className="terminal-password-subtitle">
              {passwordDialogSubtitle || `${sshUsername ?? ""}@${sshHost ?? ""}${sshPort && sshPort !== 22 ? `:${sshPort}` : ""}`}
            </div>
            {passwordError && (
              <div className="terminal-password-error">{passwordError}</div>
            )}
            <input
              type="password"
              className="terminal-password-input"
              placeholder="Password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handlePasswordSubmit();
                if (e.key === "Escape") handlePasswordCancel();
              }}
              autoFocus
            />
            <button
              className="terminal-password-submit"
              onClick={handlePasswordSubmit}
            >
              Connect
            </button>
          </div>
        </div>
      )}
      {connectionLost && !exited && (
        <div className="terminal-connection-lost" onClick={handleRestart}>
          <span className="terminal-connection-lost-text">Connection lost</span>
          <span className="terminal-connection-lost-action">Click to reconnect</span>
        </div>
      )}
      <div
        ref={containerRef}
        className="terminal-container"
        style={{ display: exited || showPasswordDialog ? "none" : undefined }}
      />
      {exited && (
        <div className="terminal-exit-panel" onClick={handleRestart}>
          <svg className="terminal-exit-icon" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 5.5L7.5 10L3 14.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M10 14.5H17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <span className="terminal-exit-label">New Session</span>
        </div>
      )}
    </div>
  );
}
