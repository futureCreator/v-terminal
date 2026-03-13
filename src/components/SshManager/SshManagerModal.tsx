import { useState } from "react";
import { useSshStore } from "../../store/sshStore";
import type { SshProfile } from "../../types/terminal";
import "./SshManagerModal.css";

interface Props {
  onClose: () => void;
  onConnect: (profile: SshProfile) => void;
  onConnectInPanel?: (profile: SshProfile) => void;
  onConnectInAllPanels?: (profile: SshProfile) => void;
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

export function SshManagerModal({ onClose, onConnect, onConnectInPanel, onConnectInAllPanels }: Props) {
  const { profiles, addProfile, removeProfile, updateProfile } = useSshStore();

  const [selectedId, setSelectedId] = useState<string | null>(profiles[0]?.id ?? null);
  const [isNew, setIsNew] = useState(profiles.length === 0);
  const [form, setForm] = useState<FormState>(() =>
    profiles[0] ? profileToForm(profiles[0]) : emptyForm
  );

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
      ...(form.identityFile.trim() ? { identityFile: form.identityFile.trim() } : {}),
    };
  };

  const handleSave = () => {
    const data = buildProfileData();
    if (!data.host || !data.username) return;
    if (isNew) {
      const newP = addProfile(data);
      setSelectedId(newP.id);
      setIsNew(false);
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

  const handleConnect = () => {
    const data = buildProfileData();
    if (!data.host || !data.username) return;
    let profile: SshProfile;
    if (isNew) {
      profile = addProfile(data);
    } else if (selectedId) {
      updateProfile(selectedId, data);
      profile = { id: selectedId, ...data };
    } else return;
    onConnect(profile);
  };

  const handleConnectInPanel = () => {
    if (!onConnectInPanel) return;
    const data = buildProfileData();
    if (!data.host || !data.username) return;
    let profile: SshProfile;
    if (isNew) {
      profile = addProfile(data);
    } else if (selectedId) {
      updateProfile(selectedId, data);
      profile = { id: selectedId, ...data };
    } else return;
    onConnectInPanel(profile);
  };

  const handleConnectInAllPanels = () => {
    if (!onConnectInAllPanels) return;
    const data = buildProfileData();
    if (!data.host || !data.username) return;
    let profile: SshProfile;
    if (isNew) {
      profile = addProfile(data);
    } else if (selectedId) {
      updateProfile(selectedId, data);
      profile = { id: selectedId, ...data };
    } else return;
    onConnectInAllPanels(profile);
  };

  const setField = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((s) => ({ ...s, [key]: e.target.value }));

  const canConnect = form.host.trim() !== "" && form.username.trim() !== "";

  return (
    <div
      className="ssh-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="ssh-modal">
        <div className="ssh-modal-header">
          <span className="ssh-modal-title">SSH Connection</span>
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
            <div className="ssh-list-heading">Saved Servers</div>
            {profiles.length === 0 ? (
              <div className="ssh-empty-state">
                <svg className="ssh-empty-icon" width="32" height="32" viewBox="0 0 32 32" fill="none">
                  <rect x="4" y="8" width="24" height="18" rx="3" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M4 13h24" stroke="currentColor" strokeWidth="1.5" />
                  <circle cx="8" cy="10.5" r="1" fill="currentColor" />
                  <circle cx="12" cy="10.5" r="1" fill="currentColor" />
                  <circle cx="16" cy="10.5" r="1" fill="currentColor" />
                </svg>
                <div className="ssh-empty-title">No saved servers</div>
                <div className="ssh-empty-desc">Click the button below<br />to add your first server</div>
              </div>
            ) : (
              profiles.map((p) => (
                <div
                  key={p.id}
                  className={`ssh-profile-item ${p.id === selectedId && !isNew ? "ssh-profile-item--active" : ""}`}
                  onClick={() => selectProfile(p.id)}
                >
                  <div className="ssh-profile-name">{p.name}</div>
                  <div className="ssh-profile-host">
                    {p.username}@{p.host}:{p.port}
                  </div>
                </div>
              ))
            )}
            <button className="ssh-list-add-btn" onClick={startNew}>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path
                  d="M5 1v8M1 5h8"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
              </svg>
              Add Server
            </button>
          </div>

          {/* Form */}
          <div className="ssh-form">
            <div className="ssh-field">
              <label className="ssh-label">Name</label>
              <input
                className="ssh-input"
                value={form.name}
                onChange={setField("name")}
                placeholder={form.username && form.host ? `${form.username}@${form.host}` : "My Server"}
              />
            </div>
            <div className="ssh-field-row">
              <div className="ssh-field ssh-field--flex">
                <label className="ssh-label">Host</label>
                <input
                  className="ssh-input"
                  value={form.host}
                  onChange={setField("host")}
                  placeholder="example.com"
                />
              </div>
              <div className="ssh-field ssh-field--port">
                <label className="ssh-label">Port</label>
                <input
                  className="ssh-input"
                  value={form.port}
                  onChange={setField("port")}
                  placeholder="22"
                />
              </div>
            </div>
            <div className="ssh-field">
              <label className="ssh-label">User</label>
              <input
                className="ssh-input"
                value={form.username}
                onChange={setField("username")}
                placeholder="ubuntu"
              />
            </div>
            <div className="ssh-field">
              <label className="ssh-label">Identity File (optional)</label>
              <input
                className="ssh-input"
                value={form.identityFile}
                onChange={setField("identityFile")}
                placeholder="~/.ssh/id_rsa"
              />
            </div>
            <div className="ssh-form-actions">
              <button
                className="ssh-btn ssh-btn--secondary"
                onClick={handleSave}
                disabled={!canConnect}
              >
                Save
              </button>
              {!isNew && (
                <button className="ssh-btn ssh-btn--danger" onClick={handleDelete}>
                  Delete
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="ssh-modal-footer">
          <button className="ssh-btn ssh-btn--secondary" onClick={onClose}>
            Cancel
          </button>
          {onConnectInPanel && (
            <button
              className="ssh-btn ssh-btn--secondary"
              onClick={handleConnectInPanel}
              disabled={!canConnect}
            >
              Open in Current Panel
            </button>
          )}
          {onConnectInAllPanels && (
            <button
              className="ssh-btn ssh-btn--secondary"
              onClick={handleConnectInAllPanels}
              disabled={!canConnect}
            >
              Open in All Panels
            </button>
          )}
          <button
            className="ssh-btn ssh-btn--primary"
            onClick={handleConnect}
            disabled={!canConnect}
          >
            Connect in New Tab
          </button>
        </div>
      </div>
    </div>
  );
}
