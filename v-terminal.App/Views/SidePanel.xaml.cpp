#include "pch.h"
#include "SidePanel.xaml.h"
#if __has_include("SidePanel.g.cpp")
#include "SidePanel.g.cpp"
#endif

using namespace winrt;
using namespace Microsoft::UI::Xaml;

namespace winrt::VTerminal::implementation
{
    SidePanel::SidePanel()
    {
        InitializeComponent();
    }

    void SidePanel::ShowTodos()
    {
        m_activeTab = ActiveTab::Todos;
        TodoContent().Visibility(Visibility::Visible);
        TimersContent().Visibility(Visibility::Collapsed);
        UpdateTabAppearance();
    }

    void SidePanel::ShowTimers()
    {
        m_activeTab = ActiveTab::Timers;
        TodoContent().Visibility(Visibility::Collapsed);
        TimersContent().Visibility(Visibility::Visible);
        UpdateTabAppearance();
    }

    void SidePanel::UpdateTabAppearance()
    {
        auto activeBrush = Microsoft::UI::Xaml::Media::SolidColorBrush(
            Microsoft::UI::Colors::CornflowerBlue());
        // Use a theme resource proxy color for a subtle background
        auto activeBg = Application::Current().Resources()
            .Lookup(box_value(L"SystemControlHighlightListAccentLowBrush"))
            .as<Microsoft::UI::Xaml::Media::Brush>();
        auto transparentBg = Microsoft::UI::Xaml::Media::SolidColorBrush(
            Microsoft::UI::Colors::Transparent());

        TodosTabButton().Background(m_activeTab == ActiveTab::Todos ? activeBg : transparentBg);
        TimersTabButton().Background(m_activeTab == ActiveTab::Timers ? activeBg : transparentBg);
    }

    void SidePanel::OnTodosTabClick(IInspectable const&, RoutedEventArgs const&)
    {
        ShowTodos();
    }

    void SidePanel::OnTimersTabClick(IInspectable const&, RoutedEventArgs const&)
    {
        ShowTimers();
    }
}
