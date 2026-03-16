import { useState, useEffect } from "react";
import { useBookmarkStore } from "../../store/bookmarkStore";
import type { Bookmark } from "../../types/browser";
import "./BookmarkManagerModal.css";

interface Props {
  onClose: () => void;
}

type FormState = {
  name: string;
  url: string;
};

const emptyForm: FormState = { name: "", url: "" };

function bookmarkToForm(b: Bookmark): FormState {
  return { name: b.name, url: b.url };
}

function FaviconIcon({ url, favicon }: { url: string; favicon?: string }) {
  const [imgError, setImgError] = useState(false);

  const faviconUrl = favicon && !imgError
    ? favicon
    : url
    ? (() => {
        try {
          return `${new URL(url).origin}/favicon.ico`;
        } catch {
          return null;
        }
      })()
    : null;

  if (faviconUrl && !imgError) {
    return (
      <img
        src={faviconUrl}
        alt=""
        onError={() => setImgError(true)}
      />
    );
  }

  return (
    <svg
      className="bm-list-favicon-fallback"
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
    >
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2" />
      <path
        d="M8 2C8 2 6 5 6 8s2 6 2 6M8 2c0 0 2 3 2 6s-2 6-2 6M2 8h12"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function BookmarkManagerModal({ onClose }: Props) {
  const { bookmarks, addBookmark, removeBookmark, updateBookmark } = useBookmarkStore();

  const [selectedId, setSelectedId] = useState<string | null>(bookmarks[0]?.id ?? null);
  const [isNew, setIsNew] = useState(bookmarks.length === 0);
  const [form, setForm] = useState<FormState>(() =>
    bookmarks[0] ? bookmarkToForm(bookmarks[0]) : emptyForm
  );

  // ESC to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const selectBookmark = (id: string) => {
    const b = bookmarks.find((x) => x.id === id);
    if (!b) return;
    setSelectedId(id);
    setIsNew(false);
    setForm(bookmarkToForm(b));
  };

  const startNew = () => {
    setSelectedId(null);
    setIsNew(true);
    setForm(emptyForm);
  };

  const handleSave = () => {
    const name = form.name.trim();
    const url = form.url.trim();
    if (!url) return;
    const finalName = name || url;
    if (isNew) {
      const created = addBookmark({ name: finalName, url });
      setSelectedId(created.id);
      setIsNew(false);
      setForm({ name: created.name, url: created.url });
    } else if (selectedId) {
      updateBookmark(selectedId, { name: finalName, url });
    }
  };

  const handleDelete = () => {
    if (!selectedId) return;
    removeBookmark(selectedId);
    const remaining = bookmarks.filter((b) => b.id !== selectedId);
    if (remaining.length > 0) {
      selectBookmark(remaining[0].id);
    } else {
      startNew();
    }
  };

  const setField = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((s) => ({ ...s, [key]: e.target.value }));

  const canSave = form.url.trim() !== "";

  return (
    <div
      className="bm-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bm-modal">
        {/* Header */}
        <div className="bm-modal-header">
          <div className="bm-modal-title-group">
            <svg className="bm-modal-icon" width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M2.5 1.5h9a1 1 0 0 1 1 1v10l-5-2.5-5 2.5v-10a1 1 0 0 1 1-1z"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinejoin="round"
              />
            </svg>
            <span className="bm-modal-title">Bookmarks</span>
          </div>
          <button className="bm-modal-close" onClick={onClose} aria-label="Close">
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

        <div className="bm-modal-body">
          {/* Bookmark list */}
          <div className="bm-list">
            <div className="bm-list-header">
              <span className="bm-list-heading">Saved</span>
              <button
                className="bm-list-add-icon"
                onClick={startNew}
                aria-label="Add Bookmark"
                title="Add Bookmark"
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

            <div className="bm-list-scroll">
              {bookmarks.length === 0 ? (
                <div className="bm-empty-state">
                  <svg className="bm-empty-icon" width="28" height="28" viewBox="0 0 28 28" fill="none">
                    <path
                      d="M5 4h18a2 2 0 0 1 2 2v18l-11-5.5L3 24V6a2 2 0 0 1 2-2z"
                      stroke="currentColor"
                      strokeWidth="1.3"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <div className="bm-empty-title">No bookmarks yet</div>
                  <div className="bm-empty-desc">Click + to add your first bookmark</div>
                </div>
              ) : (
                bookmarks.map((b) => {
                  const isActive = b.id === selectedId && !isNew;
                  return (
                    <div
                      key={b.id}
                      className={`bm-list-item ${isActive ? "bm-list-item--active" : ""}`}
                      onClick={() => selectBookmark(b.id)}
                      title={b.url}
                    >
                      <div className="bm-list-favicon">
                        <FaviconIcon url={b.url} favicon={b.favicon} />
                      </div>
                      <div className="bm-list-info">
                        <div className="bm-list-name">{b.name}</div>
                        <div className="bm-list-url">{b.url}</div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Form */}
          <div className="bm-form">
            {!isNew && selectedId === null ? (
              <div className="bm-form-placeholder">
                Select a bookmark to edit, or click + to add a new one.
              </div>
            ) : (
              <>
                <div className="bm-field">
                  <label className="bm-label">Name</label>
                  <input
                    className="bm-input"
                    value={form.name}
                    onChange={setField("name")}
                    placeholder={form.url || "My Bookmark"}
                    autoFocus={isNew}
                  />
                </div>
                <div className="bm-field">
                  <label className="bm-label">URL</label>
                  <input
                    className="bm-input"
                    value={form.url}
                    onChange={setField("url")}
                    placeholder="https://example.com"
                    type="url"
                  />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="bm-modal-footer">
          <button className="bm-btn bm-btn--secondary" onClick={onClose}>
            Close
          </button>
          {!isNew && selectedId !== null && (
            <button className="bm-btn bm-btn--danger" onClick={handleDelete}>
              Delete
            </button>
          )}
          <div className="bm-footer-gap" />
          <button
            className="bm-btn bm-btn--primary"
            onClick={handleSave}
            disabled={!canSave}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
