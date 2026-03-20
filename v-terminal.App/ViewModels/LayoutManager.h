#pragma once

#include <vector>
#include <array>

namespace VTerminal {

/// Describes one panel slot's position within a Grid.
struct GridSlot {
    int row;        // Grid.Row
    int col;        // Grid.Column
    int rowSpan;    // Grid.RowSpan
    int colSpan;    // Grid.ColumnSpan
};

/// Describes a layout preset: grid dimensions and slot assignments.
struct LayoutPreset {
    int panelCount;   // Number of panels in this layout
    int gridRows;     // Number of Grid RowDefinitions
    int gridCols;     // Number of Grid ColumnDefinitions
    std::vector<GridSlot> slots;  // One slot per panel
};

/// Manages the 6 layout presets for the panel grid.
/// All methods are static — no instance state needed.
class LayoutManager {
public:
    /// Get a layout preset by index (1-6). Returns preset 1 for out-of-range.
    static const LayoutPreset& getPreset(int index);

    /// Get panel count for a given preset index.
    static int panelCount(int presetIndex);

    /// Total number of available presets.
    static constexpr int presetCount() { return 6; }

private:
    static const std::array<LayoutPreset, 6>& presets();
};

} // namespace VTerminal
