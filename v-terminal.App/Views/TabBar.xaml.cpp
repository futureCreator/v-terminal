#include "pch.h"
#include "TabBar.xaml.h"
#if __has_include("TabBar.g.cpp")
#include "TabBar.g.cpp"
#endif

#include <algorithm>

using namespace winrt;
using namespace Microsoft::UI::Xaml;
using namespace Microsoft::UI::Xaml::Controls;

namespace winrt::VTerminal::implementation
{
    TabBar::TabBar()
    {
        InitializeComponent();

        // Create initial default tab
        AddNewTab();
    }

    void TabBar::AddNewTab()
    {
        ++m_tabCounter;

        ::VTerminal::TabViewModel tab;
        tab.id = L"tab-" + std::to_wstring(m_tabCounter);
        tab.label = L"Terminal " + std::to_wstring(m_tabCounter);
        tab.layout = 1;
        tab.isBroadcast = false;
        m_tabs.push_back(std::move(tab));

        SetActiveTab(m_tabs.back().id);
        RebuildTabUI();

        if (OnNewTabRequested) {
            OnNewTabRequested();
        }
    }

    void TabBar::RemoveTab(const std::wstring& tabId)
    {
        // Prevent closing the last tab
        if (m_tabs.size() <= 1) return;

        auto it = std::find_if(m_tabs.begin(), m_tabs.end(),
            [&](const ::VTerminal::TabViewModel& t) { return t.id == tabId; });
        if (it == m_tabs.end()) return;

        bool wasActive = (tabId == m_activeTabId);
        m_tabs.erase(it);

        if (wasActive && !m_tabs.empty()) {
            SetActiveTab(m_tabs.back().id);
        }

        RebuildTabUI();

        if (OnTabClosed) {
            OnTabClosed(tabId);
        }
    }

    void TabBar::SetActiveTab(const std::wstring& tabId)
    {
        m_activeTabId = tabId;
        RebuildTabUI();

        if (OnTabActivated) {
            OnTabActivated(tabId);
        }
    }

    void TabBar::RenameTab(const std::wstring& tabId, const std::wstring& newLabel)
    {
        for (auto& tab : m_tabs) {
            if (tab.id == tabId) {
                tab.label = newLabel;
                break;
            }
        }
        RebuildTabUI();
    }

    void TabBar::RebuildTabUI()
    {
        auto tabList = TabList();
        tabList.Children().Clear();

        for (const auto& tab : m_tabs) {
            auto tabId = tab.id;
            bool isActive = (tab.id == m_activeTabId);

            // Create a tab item: Grid with label + close button
            auto grid = Grid();
            grid.Padding(ThicknessHelper::FromLengths(12, 0, 4, 0));
            grid.Height(36);
            grid.Background(isActive
                ? Microsoft::UI::Xaml::Media::SolidColorBrush(Microsoft::UI::Colors::Transparent())
                : Microsoft::UI::Xaml::Media::SolidColorBrush(Windows::UI::Color{20, 0, 0, 0}));
            grid.CornerRadius(CornerRadiusHelper::FromRadii(6, 6, 0, 0));

            auto colDef1 = ColumnDefinition();
            colDef1.Width(GridLengthHelper::FromValueAndType(1, GridUnitType::Star));
            auto colDef2 = ColumnDefinition();
            colDef2.Width(GridLengthHelper::Auto());
            grid.ColumnDefinitions().Append(colDef1);
            grid.ColumnDefinitions().Append(colDef2);

            // Tab label
            auto label = TextBlock();
            label.Text(winrt::hstring(tab.label));
            label.VerticalAlignment(VerticalAlignment::Center);
            label.Margin(ThicknessHelper::FromLengths(0, 0, 8, 0));
            label.FontSize(12);
            if (isActive) {
                label.FontWeight(Windows::UI::Text::FontWeights::SemiBold());
            }
            Grid::SetColumn(label, 0);
            grid.Children().Append(label);

            // Close button
            auto closeBtn = Button();
            closeBtn.Content(box_value(L"\xE8BB")); // Close glyph
            closeBtn.FontFamily(Microsoft::UI::Xaml::Media::FontFamily(L"Segoe MDL2 Assets"));
            closeBtn.Width(24);
            closeBtn.Height(24);
            closeBtn.Padding(ThicknessHelper::FromUniformLength(0));
            closeBtn.Background(Microsoft::UI::Xaml::Media::SolidColorBrush(Microsoft::UI::Colors::Transparent()));
            closeBtn.BorderThickness(ThicknessHelper::FromUniformLength(0));
            closeBtn.VerticalAlignment(VerticalAlignment::Center);
            closeBtn.Click([this, tabId](auto&&, auto&&) {
                OnTabCloseClick(tabId);
            });
            Grid::SetColumn(closeBtn, 1);
            grid.Children().Append(closeBtn);

            // Click to activate tab
            grid.Tapped([this, tabId](auto&&, auto&&) {
                OnTabItemClick(tabId);
            });

            // Double-tap to rename
            grid.DoubleTapped([this, tabId](auto&&, auto&&) {
                OnTabDoubleTapped(tabId);
            });

            // Active tab indicator (bottom border)
            if (isActive) {
                auto border = Border();
                border.Height(2);
                border.VerticalAlignment(VerticalAlignment::Bottom);
                border.Background(
                    Microsoft::UI::Xaml::Media::SolidColorBrush(Microsoft::UI::Colors::CornflowerBlue()));
                Grid::SetColumnSpan(border, 2);
                grid.Children().Append(border);
            }

            tabList.Children().Append(grid);
        }
    }

    void TabBar::OnNewTabClick(IInspectable const&, RoutedEventArgs const&)
    {
        AddNewTab();
    }

    void TabBar::OnTabItemClick(const std::wstring& tabId)
    {
        SetActiveTab(tabId);
    }

    void TabBar::OnTabCloseClick(const std::wstring& tabId)
    {
        RemoveTab(tabId);
    }

    void TabBar::OnTabDoubleTapped(const std::wstring& tabId)
    {
        // TODO: Show inline rename TextBox
        // For now, append a rename suffix as placeholder behavior
    }
}
