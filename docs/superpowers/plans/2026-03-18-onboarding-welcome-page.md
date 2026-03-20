# Onboarding Welcome Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a full-screen welcome page on first launch that introduces power users to v-terminal's key features (Command Palette, Claude Code Panel, Productivity Tools) through 3 slides.

**Architecture:** A new `WelcomePage` component renders as a full-page overlay above `app-content` (same pattern as `CommandPalette` and modals). A small Zustand store (`onboardingStore`) manages the `isDone` flag with localStorage persistence. The overlay shows only when a tab has `pendingSessionPick: true` and the onboarding flag is not set.

**Tech Stack:** React 18, TypeScript, Zustand, CSS animations, localStorage

**Spec:** `docs/superpowers/specs/2026-03-18-onboarding-welcome-page-design.md`

---

## File Map

- **Create:** `src/store/onboardingStore.ts` — Zustand store: `isDone`, `markDone()`, `reset()`
- **Create:** `src/components/WelcomePage/slides.ts` — Slide content data (headline, description, shortcut keys)
- **Create:** `src/components/WelcomePage/WelcomePage.tsx` — Main component: slide state, navigation, keyboard, fade-out
- **Create:** `src/components/WelcomePage/WelcomePage.css` — All styles: layout, slides, illustrations, animations, theme variants
- **Modify:** `src/App.tsx` — Import store + WelcomePage, add overlay rendering logic
- **Modify:** `src/components/SettingsModal/SettingsModal.tsx` — Add "Show Welcome Page" button to Appearance tab

---

## Task 1: Onboarding Store

**Files:**
- Create: `src/store/onboardingStore.ts`

- [ ] **Step 1: Create the Zustand store**

Follow the exact pattern from `src/store/themeStore.ts`. The store has:
- `isDone: boolean` — loaded from `localStorage.getItem("v-terminal:onboarding-done") === "true"`
- `markDone()` — sets `isDone` to `true`, writes `"true"` to localStorage
- `reset()` — sets `isDone` to `false`, removes key from localStorage

```ts
import { create } from "zustand";

const STORAGE_KEY = "v-terminal:onboarding-done";

interface OnboardingStore {
  isDone: boolean;
  markDone: () => void;
  reset: () => void;
}

export const useOnboardingStore = create<OnboardingStore>((set) => ({
  isDone: localStorage.getItem(STORAGE_KEY) === "true",
  markDone: () => {
    try { localStorage.setItem(STORAGE_KEY, "true"); } catch {}
    set({ isDone: true });
  },
  reset: () => {
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    set({ isDone: false });
  },
}));
```

- [ ] **Step 2: Commit**

```bash
git add src/store/onboardingStore.ts
git commit -m "feat(onboarding): add onboardingStore with localStorage persistence"
```

---

## Task 2: Slide Content Data

**Files:**
- Create: `src/components/WelcomePage/slides.ts`

- [ ] **Step 1: Create slide data**

Each slide has: `id`, `headline`, `description`, `shortcutKeys` (array of key labels for keycap badges).

```ts
export interface SlideData {
  id: string;
  headline: string;
  description: string;
  shortcutKeys: string[];
}

export const slides: SlideData[] = [
  {
    id: "command-palette",
    headline: "Everything at your fingertips",
    description:
      "Press Ctrl+K to access tabs, layouts, clipboard history, cheatsheets, and more. No mouse needed.",
    shortcutKeys: ["Ctrl", "K"],
  },
  {
    id: "claude-code",
    headline: "Built for Claude Code users",
    description:
      "Edit CLAUDE.md files, view git diffs, and track your token usage — all without leaving the terminal.",
    shortcutKeys: ["Ctrl", "Shift", "L"],
  },
  {
    id: "productivity",
    headline: "Stay focused, stay in flow",
    description:
      "Notes, Pomodoro timers, and cheatsheets live in your sidebar. No app switching needed.",
    shortcutKeys: ["Ctrl", "Shift", "N"],
  },
];
```

- [ ] **Step 2: Commit**

```bash
git add src/components/WelcomePage/slides.ts
git commit -m "feat(onboarding): add slide content data for welcome page"
```

---

## Task 3: WelcomePage Component

**Files:**
- Create: `src/components/WelcomePage/WelcomePage.tsx`

- [ ] **Step 1: Create the WelcomePage component**

The component manages:
- `currentSlide` state (0-indexed)
- `dismissing` state for fade-out animation
- Keyboard listener (useEffect) with `capture: true` and `stopPropagation()`
- Navigation functions: `goNext`, `goPrev`, `goToSlide`, `handleSkip`, `handleDone`

```tsx
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
                  {slide.id === "productivity" && <ProductivityIllustration />}
                </div>

                {/* Text content */}
                <h1 className="welcome-headline">{slide.headline}</h1>
                <p className="welcome-description">{slide.description}</p>

                {/* Keycap badges */}
                <div className="welcome-shortcut">
                  {slide.shortcutKeys.map((key, i) => (
                    <span key={i}>
                      {i > 0 && <span className="welcome-shortcut-plus">+</span>}
                      <kbd className="welcome-keycap">{key}</kbd>
                    </span>
                  ))}
                </div>
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
```

- [ ] **Step 2: Commit**

```bash
git add src/components/WelcomePage/WelcomePage.tsx
git commit -m "feat(onboarding): add WelcomePage component with slides, keyboard nav, and illustrations"
```

---

## Task 4: WelcomePage Styles

**Files:**
- Create: `src/components/WelcomePage/WelcomePage.css`

- [ ] **Step 1: Create the stylesheet**

This is the largest file. It covers:

1. **Overlay** — fixed, full-screen, centered, semi-transparent backdrop, `z-index: 9000` (above app-content but below modals at 9999), fade-out animation
2. **Container** — max-width 800px, centered, padding
3. **Slides viewport** — `overflow: hidden`, slides track with `transition: transform 300ms ease-out`
4. **Slide content** — illustration area + text area
5. **Keycap badges** — rounded rect, subtle shadow, `JetBrainsMonoNerdFont`
6. **Navigation** — 3-column layout (skip | dots | next), dot styles
7. **CSS illustrations** — schematic shapes using backgrounds, borders, border-radius
8. **Theme variants** — use existing CSS custom properties from `theme.css`: `--bg-primary`, `--bg-secondary`, `--bg-tertiary` (hover), `--label-primary`, `--label-secondary`, `--label-tertiary`, `--separator-strong` (border), `--accent`
9. **`prefers-reduced-motion`** — disable transitions

```css
/* ── Overlay ──────────────────────────────────────────────────── */

.welcome-overlay {
  position: fixed;
  inset: 0;
  z-index: 9000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-primary);
  opacity: 1;
  transition: opacity 200ms ease-out;
}

.welcome-overlay--dismissing {
  opacity: 0;
  pointer-events: none;
}

/* ── Container ────────────────────────────────────────────────── */

.welcome-container {
  max-width: 800px;
  width: 100%;
  padding: 48px 32px 32px;
  display: flex;
  flex-direction: column;
  gap: 40px;
}

/* ── Slides Viewport ──────────────────────────────────────────── */

.welcome-slides-viewport {
  overflow: hidden;
  border-radius: 12px;
}

.welcome-slides-track {
  display: flex;
  transition: transform 300ms ease-out;
}

.welcome-slide {
  min-width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
  padding: 0 16px;
}

/* ── Text ─────────────────────────────────────────────────────── */

.welcome-headline {
  font-family: "Pretendard", -apple-system, sans-serif;
  font-size: 28px;
  font-weight: 700;
  color: var(--label-primary);
  text-align: center;
  margin: 0;
  line-height: 1.3;
}

.welcome-description {
  font-family: "Pretendard", -apple-system, sans-serif;
  font-size: 15px;
  font-weight: 400;
  color: var(--label-secondary);
  text-align: center;
  margin: 0;
  max-width: 480px;
  line-height: 1.6;
}

/* ── Keycap Badges ────────────────────────────────────────────── */

.welcome-shortcut {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 4px;
}

.welcome-shortcut-plus {
  font-family: "Pretendard", sans-serif;
  font-size: 12px;
  color: var(--label-tertiary);
  margin: 0 2px;
}

.welcome-keycap {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: "JetBrainsMonoNerdFont", monospace;
  font-size: 12px;
  font-weight: 500;
  color: var(--label-primary);
  background: var(--bg-secondary);
  border: 1px solid var(--separator-strong);
  border-radius: 6px;
  padding: 3px 8px;
  min-width: 28px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1), 0 1px 0 rgba(0, 0, 0, 0.06);
  line-height: 1;
}

/* ── Navigation ───────────────────────────────────────────────── */

.welcome-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
}

.welcome-nav-left,
.welcome-nav-right {
  width: 120px;
}

.welcome-nav-left {
  display: flex;
  justify-content: flex-start;
}

.welcome-nav-right {
  display: flex;
  justify-content: flex-end;
}

.welcome-skip {
  background: none;
  border: none;
  font-family: "Pretendard", sans-serif;
  font-size: 13px;
  color: var(--label-tertiary);
  cursor: pointer;
  padding: 6px 12px;
  border-radius: 6px;
  transition: color 120ms, background 120ms;
}

.welcome-skip:hover {
  color: var(--label-secondary);
  background: var(--bg-tertiary);
}

.welcome-dots {
  display: flex;
  gap: 8px;
  align-items: center;
}

.welcome-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  border: none;
  background: var(--separator-strong);
  cursor: pointer;
  padding: 0;
  transition: background 200ms, transform 200ms;
}

.welcome-dot--active {
  background: var(--label-primary);
  transform: scale(1.25);
}

.welcome-dot:hover:not(.welcome-dot--active) {
  background: var(--label-tertiary);
}

.welcome-next-btn {
  font-family: "Pretendard", sans-serif;
  font-size: 13px;
  font-weight: 600;
  color: var(--bg-primary);
  background: var(--label-primary);
  border: none;
  border-radius: 8px;
  padding: 8px 20px;
  cursor: pointer;
  transition: opacity 120ms;
}

.welcome-next-btn:hover {
  opacity: 0.85;
}

.welcome-next-btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.welcome-skip:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.welcome-dot:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

/* ── Illustrations (shared) ───────────────────────────────────── */

.welcome-illustration {
  width: 100%;
  max-width: 480px;
  height: 220px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  background: var(--bg-secondary);
  border: 1px solid var(--separator-strong);
  overflow: hidden;
  position: relative;
}

/* ── Illustration: Command Palette ────────────────────────────── */

.illust-palette {
  width: 260px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px;
  background: var(--bg-primary);
  border-radius: 10px;
  border: 1px solid var(--separator-strong);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
}

.illust-palette-search {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  background: var(--bg-secondary);
  border-radius: 6px;
  margin-bottom: 4px;
}

.illust-palette-search-icon {
  width: 12px;
  height: 12px;
  border: 2px solid var(--label-tertiary);
  border-radius: 50%;
  flex-shrink: 0;
}

.illust-palette-search-text {
  height: 8px;
  width: 80px;
  background: var(--label-tertiary);
  border-radius: 4px;
  opacity: 0.3;
}

.illust-palette-item {
  height: 28px;
  background: var(--bg-secondary);
  border-radius: 6px;
  opacity: 0.5;
}

.illust-palette-item--active {
  opacity: 1;
  border: 1px solid var(--accent);
  background: color-mix(in srgb, var(--accent) 10%, var(--bg-secondary));
}

/* ── Illustration: Claude Code Panel ──────────────────────────── */

.illust-claude {
  width: 340px;
  height: 180px;
  display: flex;
  gap: 1px;
  background: var(--separator-strong);
  border-radius: 8px;
  overflow: hidden;
}

.illust-claude-sidebar {
  width: 120px;
  background: var(--bg-primary);
  display: flex;
  flex-direction: column;
  padding: 10px;
  gap: 10px;
}

.illust-claude-tabs {
  display: flex;
  gap: 4px;
}

.illust-claude-tab {
  height: 6px;
  flex: 1;
  background: var(--separator-strong);
  border-radius: 3px;
}

.illust-claude-tab--active {
  background: var(--accent);
}

.illust-claude-content {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.illust-claude-line {
  height: 6px;
  width: 100%;
  background: var(--label-tertiary);
  border-radius: 3px;
  opacity: 0.25;
}

.illust-claude-line--short {
  width: 60%;
}

.illust-claude-line--medium {
  width: 80%;
}

.illust-claude-terminal {
  flex: 1;
  background: var(--bg-primary);
  display: flex;
  flex-direction: column;
  padding: 12px;
  gap: 6px;
  justify-content: flex-end;
}

.illust-claude-term-line {
  height: 6px;
  width: 70%;
  background: var(--label-tertiary);
  border-radius: 3px;
  opacity: 0.2;
}

.illust-claude-term-line--short {
  width: 40%;
}

.illust-claude-cursor {
  width: 8px;
  height: 14px;
  background: var(--label-primary);
  border-radius: 1px;
  opacity: 0.6;
  animation: cursor-blink 1s step-end infinite;
}

@keyframes cursor-blink {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 0; }
}

/* ── Illustration: Productivity Tools ─────────────────────────── */

.illust-productivity {
  width: 340px;
  height: 180px;
  display: flex;
  gap: 1px;
  background: var(--separator-strong);
  border-radius: 8px;
  overflow: hidden;
}

.illust-prod-terminal {
  flex: 1;
  background: var(--bg-primary);
  display: flex;
  flex-direction: column;
  padding: 12px;
  gap: 6px;
  justify-content: flex-end;
}

.illust-prod-term-line {
  height: 6px;
  width: 65%;
  background: var(--label-tertiary);
  border-radius: 3px;
  opacity: 0.2;
}

.illust-prod-term-line--short {
  width: 35%;
}

.illust-prod-cursor {
  width: 8px;
  height: 14px;
  background: var(--label-primary);
  border-radius: 1px;
  opacity: 0.6;
  animation: cursor-blink 1s step-end infinite;
}

.illust-prod-sidebar {
  width: 120px;
  background: var(--bg-primary);
  display: flex;
  flex-direction: column;
  padding: 10px;
  gap: 10px;
}

.illust-prod-tabs {
  display: flex;
  gap: 4px;
}

.illust-prod-tab {
  height: 6px;
  flex: 1;
  background: var(--separator-strong);
  border-radius: 3px;
}

.illust-prod-tab--active {
  background: var(--accent);
}

.illust-prod-note-line {
  height: 6px;
  width: 100%;
  background: var(--label-tertiary);
  border-radius: 3px;
  opacity: 0.25;
}

.illust-prod-note-line--short {
  width: 55%;
}

.illust-prod-timer {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 8px;
}

.illust-prod-timer-circle {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 3px solid var(--accent);
  border-top-color: transparent;
  animation: timer-spin 2s linear infinite;
}

@keyframes timer-spin {
  to { transform: rotate(360deg); }
}

/* ── Reduced Motion ───────────────────────────────────────────── */

@media (prefers-reduced-motion: reduce) {
  .welcome-slides-track {
    transition: none;
  }
  .welcome-overlay {
    transition: none;
  }
  .welcome-dot {
    transition: none;
  }
  .illust-claude-cursor,
  .illust-prod-cursor {
    animation: none;
    opacity: 0.6;
  }
  .illust-prod-timer-circle {
    animation: none;
    border-top-color: var(--accent);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/WelcomePage/WelcomePage.css
git commit -m "feat(onboarding): add WelcomePage styles with illustrations, animations, and theme support"
```

---

## Task 5: Integrate WelcomePage into App.tsx

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add imports**

At the top of `App.tsx`, add:

```ts
import { WelcomePage } from "./components/WelcomePage/WelcomePage";
import { useOnboardingStore } from "./store/onboardingStore";
```

- [ ] **Step 2: Add store hook and handler inside the App component**

Inside `export function App()`, after the existing store hooks (around line 53), add:

```ts
const { isDone: onboardingDone, markDone: markOnboardingDone } = useOnboardingStore();
```

Add a `showWelcome` derived value (before the return statement):

```ts
const showWelcome = !onboardingDone && tabs.some((t) => t.pendingSessionPick);
```

Add a ref to track the welcome state (for use in the keyboard handler):

```ts
const showWelcomeRef = useRef(showWelcome);
useEffect(() => { showWelcomeRef.current = showWelcome; }, [showWelcome]);
```

Add a handler:

```ts
const handleWelcomeDone = useCallback(() => {
  markOnboardingDone();
}, [markOnboardingDone]);
```

- [ ] **Step 2b: Add guard to the global keyboard handler**

In the existing `useEffect` for global keyboard shortcuts (around line 139), add a guard at the top of the `onKeyDown` handler to skip all global shortcuts while the welcome overlay is active:

```ts
const onKeyDown = (e: KeyboardEvent) => {
  // Skip all global shortcuts while onboarding welcome overlay is active
  if (showWelcomeRef.current) return;

  if (e.ctrlKey && e.key === "k") {
  // ... rest of existing handler unchanged
```

This prevents `Ctrl+K` from opening the command palette (and other shortcuts from firing) while the WelcomePage is visible. The WelcomePage's own capture-phase keyboard handler will process the events instead.

- [ ] **Step 3: Add WelcomePage overlay to the JSX**

In the return statement, after the closing `</div>` of the root `<div className="app">` content but before the final `</div>` — specifically after the `<DiffViewer />` component (line 982) and before the closing `</div>` (line 983), add:

```tsx
{showWelcome && <WelcomePage onDone={handleWelcomeDone} />}
```

The result should look like:

```tsx
      <DiffViewer />
      {showWelcome && <WelcomePage onDone={handleWelcomeDone} />}
    </div>
  );
```

- [ ] **Step 4: Verify the app compiles**

Run: `npm run dev` (or the project's dev command) and check for TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "feat(onboarding): integrate WelcomePage overlay into App.tsx"
```

---

## Task 6: Add "Show Welcome Page" to Settings

**Files:**
- Modify: `src/components/SettingsModal/SettingsModal.tsx`

- [ ] **Step 1: Add import**

At the top of `SettingsModal.tsx`, add:

```ts
import { useOnboardingStore } from "../../store/onboardingStore";
```

- [ ] **Step 2: Add reset callback to AppearanceTab props**

Update the `AppearanceTabProps` interface to include:

```ts
onResetOnboarding: () => void;
```

Update the `AppearanceTab` function signature to destructure `onResetOnboarding`.

- [ ] **Step 3: Add the button at the bottom of AppearanceTab**

After the Theme section's closing `</>` in `AppearanceTab` (end of the component, before the final `</>`), add:

```tsx
<div className="settings-divider" />

<div className="settings-section">
  <div className="settings-section-label">Onboarding</div>
  <button
    className="settings-reset-welcome-btn"
    onClick={onResetOnboarding}
  >
    Show Welcome Page
  </button>
  <span className="settings-field-sublabel">
    Show the welcome page again on next new tab
  </span>
</div>
```

- [ ] **Step 4: Pass the callback from SettingsModal to AppearanceTab**

In the `SettingsModal` component, add:

```ts
const resetOnboarding = useOnboardingStore((s) => s.reset);
const [toastMessage, setToastMessage] = useState("");
const [toastVisible, setToastVisible] = useState(false);

const handleResetOnboarding = useCallback(() => {
  resetOnboarding();
  setToastMessage("Welcome page will show on next new tab");
  setToastVisible(true);
  handleClose();
}, [resetOnboarding, handleClose]);
```

Pass `onResetOnboarding={handleResetOnboarding}` to the `<AppearanceTab>` component.

Note: The Toast notification needs to be rendered outside the modal (since the modal closes). Since the existing `Toast` component at `src/components/Toast/Toast.tsx` is standalone, it can be rendered inside the `SettingsModal`'s portal. However, since the modal is closing, it's simpler to use a global approach. For simplicity, just call the close and rely on the sublabel text under the button as the user feedback instead of a Toast. Update the implementation to:

```ts
const handleResetOnboarding = useCallback(() => {
  resetOnboarding();
  handleClose();
}, [resetOnboarding, handleClose]);
```

This is sufficient — the button label and sublabel communicate the intent clearly, and the user will see the Welcome Page on their next new tab.

- [ ] **Step 5: Add CSS for the reset button**

In `src/components/SettingsModal/SettingsModal.css`, add:

```css
.settings-reset-welcome-btn {
  font-family: "Pretendard", sans-serif;
  font-size: 13px;
  font-weight: 500;
  color: var(--label-primary);
  background: var(--bg-secondary);
  border: 1px solid var(--separator-strong);
  border-radius: 6px;
  padding: 6px 14px;
  cursor: pointer;
  transition: background 120ms;
  width: fit-content;
}

.settings-reset-welcome-btn:hover {
  background: var(--bg-tertiary);
}
```

- [ ] **Step 6: Verify the settings modal renders correctly**

Run the app, open Settings → Appearance, scroll to bottom, verify the "Show Welcome Page" button appears.

- [ ] **Step 7: Commit**

```bash
git add src/components/SettingsModal/SettingsModal.tsx src/components/SettingsModal/SettingsModal.css
git commit -m "feat(onboarding): add 'Show Welcome Page' button to Settings Appearance tab"
```

---

## Task 7: Manual Verification

- [ ] **Step 1: Test first launch**

1. Clear `v-terminal:onboarding-done` from localStorage (DevTools → Application → Local Storage)
2. Reload the app
3. Verify WelcomePage appears as full-screen overlay
4. Navigate through 3 slides using Next button
5. Verify "Get Started" on last slide dismisses with fade-out
6. Verify SessionPicker appears after dismissal

- [ ] **Step 2: Test keyboard navigation**

1. Reset localStorage flag, reload
2. Test Right arrow → advances slide
3. Test Left arrow → goes back
4. Test Enter → advances / completes
5. Test Escape → skips immediately

- [ ] **Step 3: Test re-access from Settings**

1. Complete onboarding (flag is set)
2. Open Settings → Appearance → click "Show Welcome Page"
3. Open a new tab
4. Verify WelcomePage shows again

- [ ] **Step 4: Test theme adaptation**

1. Switch between light and dark system themes
2. Verify WelcomePage colors adapt correctly

- [ ] **Step 5: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix(onboarding): polish after manual verification"
```
