import { useState, useEffect, useCallback } from "react";
import { slides } from "./slides";
import "./WelcomePage.css";

interface WelcomePageProps {
  onDone: () => void;
}

export function WelcomePage({ onDone }: WelcomePageProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [dismissing, setDismissing] = useState(false);
  const isLast = currentSlide === slides.length - 1;

  const dismiss = useCallback(() => {
    setDismissing(true);
    setTimeout(onDone, 200);
  }, [onDone]);

  const goNext = useCallback(() => {
    if (isLast) {
      dismiss();
    } else {
      setCurrentSlide((s) => s + 1);
    }
  }, [isLast, dismiss]);

  const goPrev = useCallback(() => {
    setCurrentSlide((s) => Math.max(0, s - 1));
  }, []);

  // Keyboard handler — capture phase + stopPropagation to block App.tsx global shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        e.stopPropagation();
        goNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        e.stopPropagation();
        goPrev();
      } else if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        goNext();
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        dismiss();
      }
    };
    window.addEventListener("keydown", handler, { capture: true });
    return () => window.removeEventListener("keydown", handler, { capture: true });
  }, [goNext, goPrev, dismiss]);

  return (
    <div className={`welcome-overlay${dismissing ? " welcome-overlay--dismissing" : ""}`}>
      <div className="welcome-container">
        {/* Slide content area */}
        <div className="welcome-slides-viewport">
          <div
            className="welcome-slides-track"
            style={{ transform: `translateX(-${currentSlide * 100}%)` }}
          >
            {slides.map((slide) => (
              <div key={slide.id} className="welcome-slide">
                {/* CSS illustration */}
                <div className={`welcome-illustration welcome-illustration--${slide.id}`}>
                  {slide.id === "command-palette" && <CommandPaletteIllustration />}
                  {slide.id === "claude-code" && <ClaudeCodeIllustration />}
                  {slide.id === "flexible-layout" && <LayoutIllustration />}
                  {slide.id === "productivity" && <ProductivityIllustration />}
                </div>

                {/* Text content */}
                <h1 className="welcome-headline">{slide.headline}</h1>
                <p className="welcome-description">{slide.description}</p>

                {/* Keycap badges */}
                {slide.shortcutKeys.length > 0 && (
                  <div className="welcome-shortcut">
                    {slide.shortcutKeys.map((key, i) => (
                      <span key={i}>
                        {i > 0 && <span className="welcome-shortcut-plus">+</span>}
                        <kbd className="welcome-keycap">{key}</kbd>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Navigation */}
        <div className="welcome-nav">
          <div className="welcome-nav-left">
            {!isLast && (
              <button className="welcome-skip" onClick={dismiss}>
                Skip
              </button>
            )}
          </div>

          <div className="welcome-dots">
            {slides.map((_, i) => (
              <button
                key={i}
                className={`welcome-dot${i === currentSlide ? " welcome-dot--active" : ""}`}
                onClick={() => setCurrentSlide(i)}
                aria-label={`Slide ${i + 1} of ${slides.length}`}
              />
            ))}
          </div>

          <div className="welcome-nav-right">
            <button className="welcome-next-btn" onClick={goNext}>
              {isLast ? "Get Started" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── CSS Illustrations (simplified schematic shapes) ─────────── */

function CommandPaletteIllustration() {
  return (
    <div className="illust-palette">
      <div className="illust-palette-search">
        <div className="illust-palette-search-icon" />
        <div className="illust-palette-search-text" />
      </div>
      <div className="illust-palette-item" />
      <div className="illust-palette-item illust-palette-item--active" />
      <div className="illust-palette-item" />
      <div className="illust-palette-item" />
    </div>
  );
}

function ClaudeCodeIllustration() {
  return (
    <div className="illust-claude">
      <div className="illust-claude-sidebar">
        <div className="illust-claude-tabs">
          <div className="illust-claude-tab illust-claude-tab--active" />
          <div className="illust-claude-tab" />
          <div className="illust-claude-tab" />
        </div>
        <div className="illust-claude-content">
          <div className="illust-claude-line" />
          <div className="illust-claude-line illust-claude-line--short" />
          <div className="illust-claude-line" />
          <div className="illust-claude-line illust-claude-line--medium" />
        </div>
      </div>
      <div className="illust-claude-terminal">
        <div className="illust-claude-term-line" />
        <div className="illust-claude-term-line illust-claude-term-line--short" />
        <div className="illust-claude-cursor" />
      </div>
    </div>
  );
}

function LayoutIllustration() {
  return (
    <div className="illust-layout">
      {/* Layout option thumbnails */}
      <div className="illust-layout-thumbs">
        <div className="illust-layout-thumb">
          <div className="illust-layout-cell" />
        </div>
        <div className="illust-layout-thumb illust-layout-thumb--active">
          <div className="illust-layout-cell" />
          <div className="illust-layout-cell" />
        </div>
        <div className="illust-layout-thumb illust-layout-thumb--quad">
          <div className="illust-layout-cell" />
          <div className="illust-layout-cell" />
          <div className="illust-layout-cell" />
          <div className="illust-layout-cell" />
        </div>
        <div className="illust-layout-thumb illust-layout-thumb--triple">
          <div className="illust-layout-cell illust-layout-cell--tall" />
          <div className="illust-layout-cell" />
          <div className="illust-layout-cell" />
        </div>
      </div>

      {/* Main preview — 2-panel split */}
      <div className="illust-layout-preview">
        <div className="illust-layout-pane">
          <div className="illust-layout-badge">
            <span className="illust-layout-badge-dot" />
            Local
          </div>
          <div className="illust-layout-line" />
          <div className="illust-layout-line illust-layout-line--short" />
          <div className="illust-layout-cursor" />
        </div>
        <div className="illust-layout-pane">
          <div className="illust-layout-badge illust-layout-badge--ssh">
            <span className="illust-layout-badge-dot illust-layout-badge-dot--ssh" />
            SSH
          </div>
          <div className="illust-layout-line" />
          <div className="illust-layout-line illust-layout-line--short" />
          <div className="illust-layout-cursor" />
        </div>
      </div>
    </div>
  );
}

function ProductivityIllustration() {
  return (
    <div className="illust-productivity">
      <div className="illust-prod-terminal">
        <div className="illust-prod-term-line" />
        <div className="illust-prod-term-line illust-prod-term-line--short" />
        <div className="illust-prod-cursor" />
      </div>
      <div className="illust-prod-sidebar">
        <div className="illust-prod-tabs">
          <div className="illust-prod-tab illust-prod-tab--active" />
          <div className="illust-prod-tab" />
        </div>
        <div className="illust-prod-note-line" />
        <div className="illust-prod-note-line illust-prod-note-line--short" />
        <div className="illust-prod-timer">
          <div className="illust-prod-timer-circle" />
        </div>
      </div>
    </div>
  );
}
