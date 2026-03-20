#pragma once

#include "SidePanel.xaml.g.h"

namespace winrt::VTerminal::implementation
{
    struct SidePanel : SidePanelT<SidePanel>
    {
        SidePanel();

        // Tab switching
        void ShowTodos();
        void ShowTimers();

        // XAML event handlers
        void OnTodosTabClick(winrt::Windows::Foundation::IInspectable const& sender,
                              winrt::Microsoft::UI::Xaml::RoutedEventArgs const& e);
        void OnTimersTabClick(winrt::Windows::Foundation::IInspectable const& sender,
                               winrt::Microsoft::UI::Xaml::RoutedEventArgs const& e);

    private:
        void UpdateTabAppearance();

        enum class ActiveTab { Todos, Timers };
        ActiveTab m_activeTab = ActiveTab::Todos;
    };
}

namespace winrt::VTerminal::factory_implementation
{
    struct SidePanel : SidePanelT<SidePanel, implementation::SidePanel>
    {
    };
}
