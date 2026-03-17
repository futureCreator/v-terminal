# Command Palette HIG Visibility Improvement Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve Command Palette visual density and animation timing to comply with Apple HIG standards.

**Architecture:** CSS-only changes to three properties: item min-height/padding, search row padding, and animation durations. No logic, layout structure, or component changes.

**Tech Stack:** CSS

---

## File Map

- Modify: `src/components/CommandPalette/CommandPalette.css`
  - `.cp-item` — min-height and padding (lines 203-214)
  - `.cp-search-row` — padding (lines 65-72)
  - `.cp-backdrop` — animation duration (line 14)
  - `.cp-backdrop--out` — animation duration (line 18)
  - `.cp-panel` — animation duration (line 46)
  - `.cp-panel--out` — animation duration (line 50)
- Modify: `src/components/CommandPalette/CommandPalette.tsx`
  - Close animation timeout (line 224-228) — must match new out duration

No new files. No test files (CSS-only visual changes).

---

### Task 1: Increase item height to 44px

**Files:**
- Modify: `src/components/CommandPalette/CommandPalette.css:203-214`

- [ ] **Step 1: Update `.cp-item` min-height and padding**

In `CommandPalette.css`, change the `.cp-item` rule:

```css
/* Before */
.cp-item {
  /* ... */
  padding: 7px 10px;
  /* ... */
  min-height: 36px;
}

/* After */
.cp-item {
  /* ... */
  padding: 11px 10px;
  /* ... */
  min-height: 44px;
}
```

Only `padding` (line 207) and `min-height` (line 213) change. All other properties stay identical.

- [ ] **Step 2: Visual verification**

Run: `pnpm dev`

Open Command Palette (Ctrl+K). Verify:
- Each item row is visibly taller with more breathing room
- Text and icons remain vertically centered
- Scrolling still works (more items will be below the fold — this is expected)
- Hover highlight and keyboard navigation still work

- [ ] **Step 3: Commit**

```bash
git add src/components/CommandPalette/CommandPalette.css
git commit -m "style: increase command palette item height to 44px for HIG compliance"
```

---

### Task 2: Increase search row height to 44px

**Files:**
- Modify: `src/components/CommandPalette/CommandPalette.css:65-72`

- [ ] **Step 1: Update `.cp-search-row` padding**

```css
/* Before */
.cp-search-row {
  /* ... */
  padding: 13px 14px;
  /* ... */
}

/* After */
.cp-search-row {
  /* ... */
  padding: 15px 14px;
  /* ... */
}
```

Only `padding` (line 69) changes. The vertical padding increases from 13px to 15px, making the total row height ~44px (15 + 14px font + 15 = 44).

- [ ] **Step 2: Visual verification**

In dev mode, open Command Palette. Verify:
- Search input area feels slightly more spacious
- Search icon, input text, mode badge, and ESC kbd all remain vertically centered
- Typing and placeholder text are properly aligned

- [ ] **Step 3: Commit**

```bash
git add src/components/CommandPalette/CommandPalette.css
git commit -m "style: increase command palette search row height to 44px for HIG compliance"
```

---

### Task 3: Update animation timing to HIG standards

**Files:**
- Modify: `src/components/CommandPalette/CommandPalette.css:14,18,46,50`
- Modify: `src/components/CommandPalette/CommandPalette.tsx:224-228`

- [ ] **Step 1: Update CSS animation durations**

Four changes in `CommandPalette.css`:

```css
/* Line 14 — backdrop in: 0.14s → 0.22s */
animation: cp-backdrop-in 0.22s ease;

/* Line 18 — backdrop out: 0.1s → 0.16s */
animation: cp-backdrop-out 0.16s ease forwards;

/* Line 46 — panel in: 0.16s → 0.24s */
animation: cp-panel-in 0.24s cubic-bezier(0.22, 0.61, 0.36, 1);

/* Line 50 — panel out: 0.1s → 0.18s */
animation: cp-panel-out 0.18s ease forwards;
```

- [ ] **Step 2: Update close animation timeout in TSX**

The close timer in `CommandPalette.tsx` (line 224-228) must match the longest out animation (0.18s = 180ms). Currently it's `120ms`.

```typescript
/* Before */
const timer = setTimeout(() => {
  setVisible(false);
  setPhase(null);
}, 120);

/* After */
const timer = setTimeout(() => {
  setVisible(false);
  setPhase(null);
}, 200);
```

Use `200ms` (slightly longer than 180ms) to ensure the CSS animation completes before the DOM is removed.

- [ ] **Step 3: Visual verification**

In dev mode:
- Open Command Palette (Ctrl+K) — should feel smoother, less "snappy"
- Close with ESC — should fade out gracefully instead of popping away
- Open and close rapidly several times — no visual glitches or stuck states
- Compare mentally: the animation should feel like a macOS sheet/popover

- [ ] **Step 4: Commit**

```bash
git add src/components/CommandPalette/CommandPalette.css src/components/CommandPalette/CommandPalette.tsx
git commit -m "style: adjust command palette animation timing to HIG standards (0.2-0.24s)"
```
