import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useSshStore } from "../../store/sshStore";
import type { SshProfile } from "../../types/terminal";
import "./SshManagerModal.css";

interface Props {
  onClose: () => void;
}

type FormState = {
  name: string;
  host: string;
  port: string;
  username: string;
  identityFile: string;
};

const emptyForm: FormState = { name: "", host: "", port: "22", username: "", identityFile: "" };

function profileToForm(p: SshProfile): FormState {
  return {
    name: p.name,
    host: p.host,
    port: String(p.port),
    username: p.username,
    identityFile: p.identityFile ?? "",
  };
}

const AVATAR_COLORS = [
  "#0A84FF", "#30D158", "#FF9F0A", "#BF5AF2", "#32ADE6", "#FF6961", "#FF375F", "#AC8E68",
];

function getAvatarColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function SshManagerModal({ onClose }: Props) {
  const { t } = useTranslation();
  const { profiles, addProfile, removeProfile, updateProfile } = useSshStore();

  const [selectedId, setSelectedId] = useState<string | null>(profiles[0]?.id ?? null);
  const [isNew, setIsNew] = useState(profiles.length === 0);
  const [form, setForm] = useState<FormState>(() =>
    profiles[0] ? profileToForm(profiles[0]) : emptyForm
  );

  // ESC to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const selectProfile = (id: string) => {
    const p = profiles.find((x) => x.id === id);
    if (!p) return;
    setSelectedId(id);
    setIsNew(false);
    setForm(profileToForm(p));
  };

  const startNew = () => {
    setSelectedId(null);
    setIsNew(true);
    setForm(emptyForm);
  };

  const buildProfileData = () => {
    const port = parseInt(form.port) || 22;
    return {
      name: form.name.trim() || `${form.username}@${form.host}`,
      host: form.host.trim(),
      port,
      username: form.username.trim(),
      identityFile: form.identityFile.trim() || undefined,
    };
  };

  const handleSave = () => {
    const data = buildProfileData();
    if (!data.host || !data.username) return;
    if (isNew) {
      const created = addProfile(data);
      setSelectedId(created.id);
      setIsNew(false);
      setForm(profileToForm(created));
    } else if (selectedId) {
      updateProfile(selectedId, data);
    }
  };

  const handleDelete = () => {
    if (!selectedId) return;
    removeProfile(selectedId);
    const remaining = profiles.filter((p) => p.id !== selectedId);
    if (remaining.length > 0) {
      selectProfile(remaining[0].id);
    } else {
      startNew();
    }
  };

  const setField = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((s) => ({ ...s, [key]: e.target.value }));

  const canSave = form.host.trim() !== "" && form.username.trim() !== "";

  // SSH command preview
  const sshPreview = canSave
    ? (() => {
        let cmd = `ssh ${form.username.trim()}@${form.host.trim()}`;
        const port = parseInt(form.port) || 22;
        if (port !== 22) cmd += ` -p ${port}`;
        if (form.identityFile.trim()) cmd += ` -i "${form.identityFile.trim()}"`;
        return cmd;
      })()
    : null;

  return (
    <div
      className="ssh-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="ssh-modal">
        {/* Header */}
        <div className="ssh-modal-header">
          <div className="ssh-modal-title-group">
            <svg className="ssh-modal-icon" width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="1" y="3" width="12" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
              <path d="M1 5.5h12" stroke="currentColor" strokeWidth="1.3" />
              <circle cx="3" cy="4.25" r="0.6" fill="currentColor" />
              <circle cx="5" cy="4.25" r="0.6" fill="currentColor" />
              <path d="M3.5 8.5l2 1.5-2 1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M8 11.5h2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            <span className="ssh-modal-title">{t('ssh.profiles')}</span>
          </div>
          <button className="ssh-modal-close" onClick={onClose} aria-label="Close">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path
                d="M1 1l10 10M11 1L1 11"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <div className="ssh-modal-body">
          {/* Profile list */}
          <div className="ssh-profile-list">
            <div className="ssh-list-header">
              <span className="ssh-list-heading">{t('ssh.savedServers')}</span>
              <button
                className="ssh-list-add-icon"
                onClick={startNew}
                aria-label={t('ssh.addServer')}
                title={t('ssh.addServer')}
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path
                    d="M5 1v8M1 5h8"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>

            <div className="ssh-profile-scroll">
              {profiles.length === 0 ? (
                <div className="ssh-empty-state">
                  <svg className="ssh-empty-icon" width="28" height="28" viewBox="0 0 28 28" fill="none">
                    <rect x="3" y="7" width="22" height="16" rx="2.5" stroke="currentColor" strokeWidth="1.3" />
                    <path d="M3 12h22" stroke="currentColor" strokeWidth="1.3" />
                    <circle cx="6.5" cy="9.5" r="0.75" fill="currentColor" />
                    <circle cx="9.5" cy="9.5" r="0.75" fill="currentColor" />
                  </svg>
                  <div className="ssh-empty-title">{t('ssh.noSavedServers')}</div>
                  <div className="ssh-empty-desc">{t('ssh.addFirstServer')}</div>
                </div>
              ) : (
                profiles.map((p) => {
                  const initial = (p.name || p.host).charAt(0).toUpperCase();
                  const color = getAvatarColor(p.name || p.host);
                  const isActive = p.id === selectedId && !isNew;
                  return (
                    <div
                      key={p.id}
                      className={`ssh-profile-item ${isActive ? "ssh-profile-item--active" : ""}`}
                      onClick={() => selectProfile(p.id)}
                      title={`${p.username}@${p.host}:${p.port}`}
                    >
                      <div
                        className="ssh-profile-avatar"
                        style={{ background: color + "22", color }}
                      >
                        {initial}
                      </div>
                      <div className="ssh-profile-info">
                        <div className="ssh-profile-name">{p.name}</div>
                        <div className="ssh-profile-host">
                          {p.username}@{p.host}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Form */}
          <div className="ssh-form">
            <div className="ssh-field">
              <label className="ssh-label">{t('ssh.name')}</label>
              <input
                className="ssh-input"
                value={form.name}
                onChange={setField("name")}
                placeholder={
                  form.username && form.host ? `${form.username}@${form.host}` : "My Server"
                }
              />
            </div>
            <div className="ssh-field-row">
              <div className="ssh-field ssh-field--flex">
                <label className="ssh-label">{t('ssh.host')}</label>
                <input
                  className="ssh-input"
                  value={form.host}
                  onChange={setField("host")}
                  placeholder="example.com"
                />
              </div>
              <div className="ssh-field ssh-field--port">
                <label className="ssh-label">{t('ssh.port')}</label>
                <input
                  className="ssh-input"
                  value={form.port}
                  onChange={setField("port")}
                  placeholder="22"
                />
              </div>
            </div>
            <div className="ssh-field">
              <label className="ssh-label">{t('ssh.username')}</label>
              <input
                className="ssh-input"
                value={form.username}
                onChange={setField("username")}
                placeholder="ubuntu"
              />
            </div>
            <div className="ssh-field">
              <label className="ssh-label">
                {t('ssh.identityFile')}{" "}
                <span className="ssh-label-optional">{t('ssh.optional')}</span>
              </label>
              <input
                className="ssh-input"
                value={form.identityFile}
                onChange={setField("identityFile")}
                placeholder="~/.ssh/id_rsa"
              />
            </div>

            {/* SSH Command Preview */}
            {sshPreview && (
              <div className="ssh-preview">
                <div className="ssh-preview-label">{t('ssh.commandPreview')}</div>
                <div className="ssh-preview-code">{sshPreview}</div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="ssh-modal-footer">
          <button className="ssh-btn ssh-btn--secondary" onClick={onClose}>
            {t('common.close')}
          </button>
          {!isNew && (
            <button className="ssh-btn ssh-btn--danger" onClick={handleDelete}>
              {t('common.delete')}
            </button>
          )}
          <div className="ssh-footer-gap" />
          <button
            className="ssh-btn ssh-btn--primary"
            onClick={handleSave}
            disabled={!canSave}
          >
            {t('common.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
