#pragma once

#include "TabBar.xaml.g.h"
#include "TabViewModel.h"

#include <vector>
#include <string>
#include <functional>

namespace winrt::VTerminal::implementation
{
    struct TabBar : TabBarT<TabBar>
    {
        TabBar();

        // Public API
        void AddNewTab();
        void RemoveTab(const std::wstring& tabId);
        void SetActiveTab(const std::wstring& tabId);
        void RenameTab(const std::wstring& tabId, const std::wstring& newLabel);

        std::wstring ActiveTabId() const { return m_activeTabId; }
        int TabCount() const { return static_cast<int>(m_tabs.size()); }
        const std::vector<::VTerminal::TabViewModel>& GetTabs() const { return m_tabs; }

        // Callbacks for MainWindow / PanelGrid coordination
        std::function<void(const std::wstring& tabId)> OnTabActivated;
        std::function<void(const std::wstring& tabId)> OnTabClosed;
        std::function<void()> OnNewTabRequested;

        // XAML event handlers
        void OnNewTabClick(winrt::Windows::Foundation::IInspectable const& sender,
                            winrt::Microsoft::UI::Xaml::RoutedEventArgs const& e);

    private:
        void RebuildTabUI();
        void OnTabItemClick(const std::wstring& tabId);
        void OnTabCloseClick(const std::wstring& tabId);
        void OnTabDoubleTapped(const std::wstring& tabId);

        std::vector<::VTerminal::TabViewModel> m_tabs;
        std::wstring m_activeTabId;
        int m_tabCounter = 0;
    };
}

namespace winrt::VTerminal::factory_implementation
{
    struct TabBar : TabBarT<TabBar, implementation::TabBar>
    {
    };
}
