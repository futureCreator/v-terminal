#include "LayoutManager.h"

namespace VTerminal {

const std::array<LayoutPreset, 6>& LayoutManager::presets()
{
    // Static array of 6 layout presets, initialized once.
    //
    // Preset 1: 1x1  (1 panel, full screen)
    // Preset 2: 1x2  (2 panels, left/right 50%/50%)
    // Preset 3: 1 col left + 2 rows right  (3 panels: left spans 2 rows, right top + right bottom)
    // Preset 4: 2x2  (4 panels, 2 rows x 2 cols)
    // Preset 5: 1 col left + 2x2 right  (5 panels: left spans 2 rows, 2x2 on right side)
    // Preset 6: 3x2  (6 panels, 3 rows x 2 cols)

    static const std::array<LayoutPreset, 6> s_presets = {{
        // Preset 1: Single panel (1x1)
        // Grid: 1 row, 1 col
        {
            1,  // panelCount
            1,  // gridRows
            1,  // gridCols
            {
                { 0, 0, 1, 1 }   // Panel 0: full grid
            }
        },

        // Preset 2: Two panels side by side (1x2)
        // Grid: 1 row, 2 cols (50%/50%)
        {
            2,  // panelCount
            1,  // gridRows
            2,  // gridCols
            {
                { 0, 0, 1, 1 },  // Panel 0: left
                { 0, 1, 1, 1 }   // Panel 1: right
            }
        },

        // Preset 3: Left pane full height + 2 right panes stacked (3 panels)
        // Grid: 2 rows, 2 cols
        // Left column (col 0): spans 2 rows
        // Right column (col 1): top row + bottom row
        {
            3,  // panelCount
            2,  // gridRows
            2,  // gridCols
            {
                { 0, 0, 2, 1 },  // Panel 0: left, spans both rows
                { 0, 1, 1, 1 },  // Panel 1: right top
                { 1, 1, 1, 1 }   // Panel 2: right bottom
            }
        },

        // Preset 4: Four panels in 2x2 grid
        // Grid: 2 rows, 2 cols (each 50%/50%)
        {
            4,  // panelCount
            2,  // gridRows
            2,  // gridCols
            {
                { 0, 0, 1, 1 },  // Panel 0: top-left
                { 0, 1, 1, 1 },  // Panel 1: top-right
                { 1, 0, 1, 1 },  // Panel 2: bottom-left
                { 1, 1, 1, 1 }   // Panel 3: bottom-right
            }
        },

        // Preset 5: Left pane full height + 2x2 on right (5 panels)
        // Grid: 2 rows, 3 cols
        // Col 0: spans 2 rows (left pane, 50% width)
        // Cols 1-2: 2x2 grid on right (each 25% width effectively, or 50% of remaining)
        {
            5,  // panelCount
            2,  // gridRows
            3,  // gridCols
            {
                { 0, 0, 2, 1 },  // Panel 0: left, spans both rows
                { 0, 1, 1, 1 },  // Panel 1: right top-left
                { 0, 2, 1, 1 },  // Panel 2: right top-right
                { 1, 1, 1, 1 },  // Panel 3: right bottom-left
                { 1, 2, 1, 1 }   // Panel 4: right bottom-right
            }
        },

        // Preset 6: Six panels in 3x2 grid
        // Grid: 3 rows, 2 cols (each 33.3%/33.3%/33.3% x 50%/50%)
        {
            6,  // panelCount
            3,  // gridRows
            2,  // gridCols
            {
                { 0, 0, 1, 1 },  // Panel 0: row 0, col 0
                { 0, 1, 1, 1 },  // Panel 1: row 0, col 1
                { 1, 0, 1, 1 },  // Panel 2: row 1, col 0
                { 1, 1, 1, 1 },  // Panel 3: row 1, col 1
                { 2, 0, 1, 1 },  // Panel 4: row 2, col 0
                { 2, 1, 1, 1 }   // Panel 5: row 2, col 1
            }
        }
    }};

    return s_presets;
}

const LayoutPreset& LayoutManager::getPreset(int index)
{
    if (index < 1 || index > 6) {
        index = 1;
    }
    return presets()[static_cast<size_t>(index - 1)];
}

int LayoutManager::panelCount(int presetIndex)
{
    return getPreset(presetIndex).panelCount;
}

} // namespace VTerminal
