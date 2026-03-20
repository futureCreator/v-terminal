#pragma once

#include "Types.h"
#include <string>

namespace VTerminal {

/// ViewModel for a single terminal pane.
/// Tracks the session binding, connection info, and UI state.
struct TerminalPaneViewModel {
    SessionId sessionId;
    SessionType connectionType = SessionType::Local;
    PanelConnection connection;

    // UI state
    bool isFocused = false;
    bool isZoomed = false;
    bool hasError = false;
    int exitCode = 0;

    // Grid position (set by LayoutManager)
    int gridRow = 0;
    int gridCol = 0;
    int gridRowSpan = 1;
    int gridColSpan = 1;
};

} // namespace VTerminal
