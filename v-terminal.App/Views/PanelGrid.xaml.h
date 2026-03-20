#pragma once

#include "PanelGrid.xaml.g.h"
#include "LayoutManager.h"
#include "TerminalPaneViewModel.h"
#include "Types.h"

#include <vector>
#include <string>
#include <functional>

namespace winrt::VTerminal::implementation
{
    struct PanelGrid : PanelGridT<PanelGrid>
    {
        PanelGrid();

        // Layout management
        void SetLayout(int presetIndex);
        int CurrentLayout() const { return m_currentLayout; }

        // Panel management
        void SetPanelConnection(int panelIndex, ::VTerminal::SessionType type,
                                 const ::VTerminal::PanelConnection& connection);
        int PanelCount() const { return static_cast<int>(m_panelViewModels.size()); }

        // Focus management
        void FocusPanel(int index);
        void FocusNextPanel();
        void FocusPreviousPanel();
        int FocusedPanelIndex() const { return m_focusedPanel; }

        // Zoom mode
        void ZoomPanel(int panelIndex);
        void Unzoom();
        bool IsZoomed() const { return m_isZoomed; }

        // Broadcast mode
        void SetBroadcast(bool enabled);
        bool IsBroadcast() const { return m_isBroadcast; }
        void BroadcastInput(const std::string& data);

        // Collect state for workspace persistence
        std::vector<::VTerminal::PanelConnection> CollectPanelStates() const;

        // Callbacks
        std::function<void(int panelIndex)> OnPanelFocused;
        std::function<void(int panelIndex)> OnZoomRequested;

    private:
        void RebuildGrid();
        void CreatePanel(int index, const ::VTerminal::GridSlot& slot);
        void RemoveExcessPanels(int newCount);
        void AddNewPanels(int oldCount, int newCount);

        int m_currentLayout = 1;
        int m_focusedPanel = 0;
        bool m_isZoomed = false;
        int m_zoomedPanel = -1;
        bool m_isBroadcast = false;

        std::vector<::VTerminal::TerminalPaneViewModel> m_panelViewModels;
    };
}

namespace winrt::VTerminal::factory_implementation
{
    struct PanelGrid : PanelGridT<PanelGrid, implementation::PanelGrid>
    {
    };
}
