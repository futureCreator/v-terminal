# TodoSection Apple HIG Polish — Design Spec

## Summary

Comprehensive design refinement of the TodoSection component to match Apple Reminders quality. Covers spacing, typography, interaction targets, animations, and replacing the bottom "New Todo" button with an inline input row.

## Files to Modify

- `src/components/NotePanel/TodoSection.tsx` — component logic
- `src/components/NotePanel/NotePanel.css` — styles
- `src/locales/en.json` — English translations (new placeholder key)
- `src/locales/ko.json` — Korean translations (new placeholder key)

## Changes

### 1. Layout & Spacing

- Item `min-height`: 32px → 44px
- Horizontal padding: 14px → 16px
- Item gap: 10px → 12px
- Counter bar padding: `10px 14px 6px` → `12px 16px 8px`
- Items get `margin: 0 4px` for rounded hover background space
- Todo list padding: `4px 0` → `2px 0`

### 2. Inline Input Row (replaces bottom button)

Remove the `todo-new-btn` button entirely. Instead, always render a ghost row at the end of the todo list:

- Dashed-circle checkbox (stroke-dasharray) at reduced opacity
- Placeholder text "New task..." (via i18n key `todo.newTaskPlaceholder`)
- On click/focus: placeholder disappears, contentEditable activates
- On Enter: save todo, create new inline row, auto-focus
- On blur with empty text: revert to ghost state
- When list is empty: show empty state icon + text above, inline row below

**Component state**: Add `isAddingNew` boolean state. When true, the ghost row becomes an active input. On blur with empty text, set back to false.

### 3. Checkbox

- Size: 18px → 22px (SVG viewBox and circle radius updated)
- Unchecked stroke: `var(--label-tertiary)` (keep) but stroke opacity slightly higher via direct rgba
- Hover: `color: var(--accent)` + `transform: scale(1.1)` with 0.15s transition
- Completed checkbox: unchanged (accent fill + white checkmark)
- Check animation: checkmark uses `stroke-dashoffset` draw-in animation (0.3s)

### 4. Typography

- Todo text: 13px → 14px
- Counter "remaining": 11px → 13px, add `font-weight: 600`, color `var(--label-secondary)`
- Counter fraction: 11px → 12px
- Completed label: 11px → 12px, `font-weight: 500`
- Clear All: 10px → 11px, text "Clear All" → "Clear" (update i18n keys)

### 5. Hover & Delete

- Item row: hover `background: rgba(255,255,255,0.04)`, `border-radius: 8px` (via `var(--radius-md)`)
- Delete button: keep `opacity: 0` → `1` on item hover
- Delete hover: `color: var(--destructive)`, `background: var(--bg-tertiary)`, `border-radius: 50%`

### 6. Completed Section

- Chevron: 8px → 10px SVG
- Add pill badge showing completed count (mono font, `rgba(255,255,255,0.06)` bg, `border-radius: 8px`)
- Separator: keep `var(--separator)` but opacity is already 0.08 via theme var
- Toggle padding: `6px 14px` → `10px 16px`
- Completed list items: keep `opacity: 0.4` (no change, already Reminders-like)

### 7. Animations

- **Check**: checkmark SVG path gets `stroke-dasharray` + `stroke-dashoffset` animation (0.3s ease)
- **New item**: `@keyframes todo-fade-in` — opacity 0→1, translateY(-8px→0), 0.2s ease
- **Delete**: `@keyframes todo-fade-out` — opacity 1→0, translateY(0→-8px), 0.2s ease. Use `onAnimationEnd` to remove from DOM.
- **Completed accordion**: `.todo-completed-list` uses `max-height` + `overflow: hidden` transition (0.25s ease)
- **Fading (existing)**: keep 0.3s opacity transition, unchanged

### 8. Empty State

- Remains inside `todo-list` container (from prior fix)
- Below the empty state, the inline input ghost row is still visible
- Structure: `todo-list` contains `todo-empty` div + ghost input row

## i18n Changes

**en.json:**
- Add: `"todo.newTaskPlaceholder": "New task..."`
- Change: `"todo.clearAll": "Clear"`

**ko.json:**
- Add: `"todo.newTaskPlaceholder": "New task..."`
- Change: `"todo.clearAll": "Clear"`

## Out of Scope

- Drag-to-reorder
- Swipe-to-delete (desktop app, not needed)
- Priority levels or categories
- Due dates
