# Panel Layout Redesign — Design Spec

## Summary

Simplify the layout system to a linear 1–6 panel progression, add a 5-panel layout, remove alternate layouts ("2r", "3c"), and add context menu actions for closing/adding panels with automatic layout transitions.

## Layout Type Change

```typescript
// Before
type Layout = 1 | 2 | "2r" | 3 | 4 | "3c" | 6;

// After
type Layout = 1 | 2 | 3 | 4 | 5 | 6;
```

## Grid Configurations

| Layout | Columns | Rows | Special |
|--------|---------|------|---------|
| 1 | `1fr` | `1fr` | — |
| 2 | `1fr 1fr` | `1fr` | — |
| 3 | `1fr 1fr` | `1fr 1fr` | Panel 0: `gridRow: "1/3"` |
| 4 | `1fr 1fr` | `1fr 1fr` | — (2x2 equal) |
| 5 | `1fr 1fr 1fr` | `1fr 1fr` | Panel 0: `gridRow: "1/3"` |
| 6 | `1fr 1fr 1fr` | `1fr 1fr` | — (3x2 equal) |

## Context Menu — Close Panel

- Add "Close Panel" item to `PanelContextMenu`, separated by a divider
- Behavior: kill panel session → remove from `panels[]` → set layout to `N-1`
- When N=1: close the entire tab (`closeTab`)
- i18n key: `panel.closePanel`

## Context Menu — Add Panel

- Add "Add Panel" item to `PanelContextMenu` (visible when panel count < 6)
- Behavior: set layout to `N+1` → new panel inherits connection from current panel (except notes)
- i18n key: `panel.addPanel`

## Files to Modify

1. `src/types/terminal.ts` — Layout type union
2. `src/lib/layoutMath.ts` — `getGridConfig()`, `panelCount()`; remove "2r"/"3c", add 5
3. `src/store/tabStore.ts` — `setLayout()` panel add/remove logic
4. `src/components/PanelGrid/PanelGrid.tsx` — layout 5 special gridRow rendering
5. `src/components/PanelContextMenu/PanelContextMenu.tsx` — add Close/Add Panel items
6. `src/lib/paletteCommands.tsx` — LAYOUT_OPTIONS: remove "2r"/"3c", add 5
7. `src/components/SplitToolbar/SplitToolbar.tsx` — layout options list
8. `src/components/SessionPicker/SessionPicker.tsx` — layout selection UI
9. `src/App.tsx` — handleLayoutChange (add closePanel handler, pass to PanelGrid)
10. `src/locales/en.json` — remove `rows2`/`columns3`, add `panels5`/`closePanel`/`addPanel`
11. `src/locales/ko.json` — same

## i18n Changes

**Remove:** `command.rows2`, `command.columns3`
**Add:**
- `command.panels5`: "5 Panels" / "5 패널"
- `panel.closePanel`: "Close Panel" / "패널 닫기"
- `panel.addPanel`: "Add Panel" / "패널 추가"

## Out of Scope

- Drag-to-resize panels
- Custom grid arrangements
- Panel reordering
