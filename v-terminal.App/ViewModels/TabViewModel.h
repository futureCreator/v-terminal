#pragma once

#include "Types.h"
#include <string>
#include <vector>

namespace VTerminal {

/// ViewModel for a single tab in the tab bar.
/// Tracks the tab identity, layout preset, broadcast mode, and panel connections.
struct TabViewModel {
    std::wstring id;            // UUID-style identifier
    std::wstring label;         // User-visible tab name
    int layout = 1;             // Layout preset index (1-6)
    bool isBroadcast = false;   // Broadcast mode: input to all panels
    std::vector<PanelConnection> panels;  // Panel connection configs

    // Runtime state (not persisted)
    std::vector<SessionId> sessionIds;  // Active session IDs per panel slot

    /// Convert to TabState for workspace persistence
    TabState toTabState() const {
        TabState state;
        state.label = label;
        state.layout = layout;
        state.panels = panels;
        return state;
    }

    /// Create from TabState (workspace restore)
    static TabViewModel fromTabState(const TabState& state, const std::wstring& tabId) {
        TabViewModel vm;
        vm.id = tabId;
        vm.label = state.label;
        vm.layout = state.layout;
        vm.panels = state.panels;
        return vm;
    }
};

} // namespace VTerminal
