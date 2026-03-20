#include "pch.h"
#include "PanelGrid.xaml.h"
#if __has_include("PanelGrid.g.cpp")
#include "PanelGrid.g.cpp"
#endif

#include "LayoutManager.h"

using namespace winrt;
using namespace Microsoft::UI::Xaml;
using namespace Microsoft::UI::Xaml::Controls;

namespace winrt::VTerminal::implementation
{
    PanelGrid::PanelGrid()
    {
        InitializeComponent();

        // Start with layout preset 1 (single panel)
        SetLayout(1);
    }

    void PanelGrid::SetLayout(int presetIndex)
    {
        if (presetIndex < 1 || presetIndex > ::VTerminal::LayoutManager::presetCount()) {
            presetIndex = 1;
        }

        auto& preset = ::VTerminal::LayoutManager::getPreset(presetIndex);
        int oldCount = static_cast<int>(m_panelViewModels.size());
        int newCount = preset.panelCount;

        // If reducing panels, kill excess sessions
        if (newCount < oldCount) {
            RemoveExcessPanels(newCount);
        }

        // If adding panels, create new ones with default local shell
        if (newCount > oldCount) {
            AddNewPanels(oldCount, newCount);
        }

        m_currentLayout = presetIndex;

        // Unzoom if zoomed
        if (m_isZoomed) {
            m_isZoomed = false;
            m_zoomedPanel = -1;
        }

        // Rebuild the XAML Grid structure
        RebuildGrid();

        // Ensure focused panel is within bounds
        if (m_focusedPanel >= newCount) {
            FocusPanel(0);
        }
    }

    void PanelGrid::RebuildGrid()
    {
        auto container = PanelContainer();

        // Clear existing grid definitions and children
        container.RowDefinitions().Clear();
        container.ColumnDefinitions().Clear();
        container.Children().Clear();

        auto& preset = ::VTerminal::LayoutManager::getPreset(m_currentLayout);

        // Set up row definitions (equal proportions)
        for (int r = 0; r < preset.gridRows; ++r) {
            auto rowDef = RowDefinition();
            rowDef.Height(GridLengthHelper::FromValueAndType(1, GridUnitType::Star));
            container.RowDefinitions().Append(rowDef);
        }

        // Set up column definitions (equal proportions)
        for (int c = 0; c < preset.gridCols; ++c) {
            auto colDef = ColumnDefinition();
            colDef.Width(GridLengthHelper::FromValueAndType(1, GridUnitType::Star));
            container.ColumnDefinitions().Append(colDef);
        }

        // Place panels according to preset slots
        for (int i = 0; i < preset.panelCount && i < static_cast<int>(m_panelViewModels.size()); ++i) {
            CreatePanel(i, preset.slots[i]);
        }
    }

    void PanelGrid::CreatePanel(int index, const ::VTerminal::GridSlot& slot)
    {
        auto container = PanelContainer();

        // TODO: Create TerminalPane or NotePane based on panel connection type
        // For now, create a placeholder Border with TextBlock
        // In full Visual Studio build, this would be:
        //   auto pane = winrt::make<TerminalPane>();
        //   pane.AttachSession(vm.connectionType, vm.connection);

        auto border = Border();
        border.BorderThickness(ThicknessHelper::FromUniformLength(0.5));
        border.BorderBrush(Microsoft::UI::Xaml::Media::SolidColorBrush(
            Windows::UI::Color{40, 128, 128, 128}));

        auto text = TextBlock();
        text.Text(L"Panel " + to_hstring(index + 1));
        text.HorizontalAlignment(HorizontalAlignment::Center);
        text.VerticalAlignment(VerticalAlignment::Center);
        text.Foreground(Microsoft::UI::Xaml::Media::SolidColorBrush(
            Windows::UI::Color{100, 128, 128, 128}));
        border.Child(text);

        // Set grid position
        Grid::SetRow(border, slot.row);
        Grid::SetColumn(border, slot.col);
        Grid::SetRowSpan(border, slot.rowSpan);
        Grid::SetColumnSpan(border, slot.colSpan);

        // Handle click for focus
        border.Tapped([this, index](auto&&, auto&&) {
            FocusPanel(index);
        });

        container.Children().Append(border);
    }

    void PanelGrid::RemoveExcessPanels(int newCount)
    {
        // Kill sessions for panels being removed
        while (static_cast<int>(m_panelViewModels.size()) > newCount) {
            auto& vm = m_panelViewModels.back();
            // TODO: Kill session via SessionManager
            // if (!vm.sessionId.empty()) sessionManager->killSession(vm.sessionId);
            m_panelViewModels.pop_back();
        }
    }

    void PanelGrid::AddNewPanels(int oldCount, int newCount)
    {
        for (int i = oldCount; i < newCount; ++i) {
            ::VTerminal::TerminalPaneViewModel vm;
            vm.connectionType = ::VTerminal::SessionType::Local;
            vm.connection.type = ::VTerminal::SessionType::Local;
            m_panelViewModels.push_back(std::move(vm));
        }
    }

    void PanelGrid::SetPanelConnection(int panelIndex, ::VTerminal::SessionType type,
                                         const ::VTerminal::PanelConnection& connection)
    {
        if (panelIndex < 0 || panelIndex >= static_cast<int>(m_panelViewModels.size())) return;

        auto& vm = m_panelViewModels[panelIndex];
        vm.connectionType = type;
        vm.connection = connection;

        // TODO: Detach old session, attach new session on the actual TerminalPane/NotePane
    }

    void PanelGrid::FocusPanel(int index)
    {
        if (index < 0 || index >= static_cast<int>(m_panelViewModels.size())) return;

        // Unfocus previous
        if (m_focusedPanel >= 0 && m_focusedPanel < static_cast<int>(m_panelViewModels.size())) {
            m_panelViewModels[m_focusedPanel].isFocused = false;
        }

        m_focusedPanel = index;
        m_panelViewModels[index].isFocused = true;

        // TODO: Call SetFocused on actual TerminalPane XAML element

        if (OnPanelFocused) {
            OnPanelFocused(index);
        }
    }

    void PanelGrid::FocusNextPanel()
    {
        int next = (m_focusedPanel + 1) % static_cast<int>(m_panelViewModels.size());
        FocusPanel(next);
    }

    void PanelGrid::FocusPreviousPanel()
    {
        int count = static_cast<int>(m_panelViewModels.size());
        int prev = (m_focusedPanel - 1 + count) % count;
        FocusPanel(prev);
    }

    void PanelGrid::ZoomPanel(int panelIndex)
    {
        if (panelIndex < 0 || panelIndex >= static_cast<int>(m_panelViewModels.size())) return;

        m_isZoomed = true;
        m_zoomedPanel = panelIndex;

        // Hide all panels except the zoomed one
        auto container = PanelContainer();
        auto& children = container.Children();
        for (uint32_t i = 0; i < children.Size(); ++i) {
            auto element = children.GetAt(i).as<UIElement>();
            element.Visibility(static_cast<int>(i) == panelIndex
                ? Visibility::Visible : Visibility::Collapsed);
        }

        // Make zoomed panel fill entire grid
        if (panelIndex < static_cast<int>(children.Size())) {
            auto element = children.GetAt(panelIndex).as<FrameworkElement>();
            Grid::SetRow(element, 0);
            Grid::SetColumn(element, 0);
            Grid::SetRowSpan(element, 999); // Span all rows
            Grid::SetColumnSpan(element, 999); // Span all cols
        }
    }

    void PanelGrid::Unzoom()
    {
        if (!m_isZoomed) return;
        m_isZoomed = false;
        m_zoomedPanel = -1;

        // Rebuild grid to restore original layout
        RebuildGrid();
    }

    void PanelGrid::SetBroadcast(bool enabled)
    {
        m_isBroadcast = enabled;
    }

    void PanelGrid::BroadcastInput(const std::string& data)
    {
        if (!m_isBroadcast) return;

        // Write input to ALL panels' sessions
        // TODO: Iterate actual TerminalPane children and call WriteInput
    }

    std::vector<::VTerminal::PanelConnection> PanelGrid::CollectPanelStates() const
    {
        std::vector<::VTerminal::PanelConnection> states;
        states.reserve(m_panelViewModels.size());
        for (const auto& vm : m_panelViewModels) {
            states.push_back(vm.connection);
        }
        return states;
    }
}
