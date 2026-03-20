#include "pch.h"
#include "SplitToolbar.xaml.h"
#if __has_include("SplitToolbar.g.cpp")
#include "SplitToolbar.g.cpp"
#endif

using namespace winrt;
using namespace Microsoft::UI::Xaml;
using namespace Microsoft::UI::Xaml::Controls;

namespace winrt::VTerminal::implementation
{
    SplitToolbar::SplitToolbar()
    {
        InitializeComponent();
        UpdateLayoutButtonStates();
    }

    void SplitToolbar::SetActiveLayout(int presetIndex)
    {
        m_activeLayout = presetIndex;
        UpdateLayoutButtonStates();
    }

    void SplitToolbar::SelectLayout(int index)
    {
        m_activeLayout = index;
        UpdateLayoutButtonStates();

        if (OnLayoutChanged) {
            OnLayoutChanged(index);
        }
    }

    void SplitToolbar::UpdateLayoutButtonStates()
    {
        // Highlight the active layout button
        auto highlightBrush = Microsoft::UI::Xaml::Media::SolidColorBrush(
            Microsoft::UI::Colors::CornflowerBlue());
        auto normalBrush = Microsoft::UI::Xaml::Media::SolidColorBrush(
            Microsoft::UI::Colors::Transparent());

        Layout1Btn().Background(m_activeLayout == 1 ? highlightBrush : normalBrush);
        Layout2Btn().Background(m_activeLayout == 2 ? highlightBrush : normalBrush);
        Layout3Btn().Background(m_activeLayout == 3 ? highlightBrush : normalBrush);
        Layout4Btn().Background(m_activeLayout == 4 ? highlightBrush : normalBrush);
        Layout5Btn().Background(m_activeLayout == 5 ? highlightBrush : normalBrush);
        Layout6Btn().Background(m_activeLayout == 6 ? highlightBrush : normalBrush);
    }

    void SplitToolbar::OnLayout1Click(IInspectable const&, RoutedEventArgs const&) { SelectLayout(1); }
    void SplitToolbar::OnLayout2Click(IInspectable const&, RoutedEventArgs const&) { SelectLayout(2); }
    void SplitToolbar::OnLayout3Click(IInspectable const&, RoutedEventArgs const&) { SelectLayout(3); }
    void SplitToolbar::OnLayout4Click(IInspectable const&, RoutedEventArgs const&) { SelectLayout(4); }
    void SplitToolbar::OnLayout5Click(IInspectable const&, RoutedEventArgs const&) { SelectLayout(5); }
    void SplitToolbar::OnLayout6Click(IInspectable const&, RoutedEventArgs const&) { SelectLayout(6); }

    void SplitToolbar::OnBroadcastToggle(IInspectable const&, RoutedEventArgs const&)
    {
        bool isChecked = BroadcastToggle().IsChecked();
        if (OnBroadcastChanged) {
            OnBroadcastChanged(isChecked);
        }
    }

    void SplitToolbar::OnToolkitToggle(IInspectable const&, RoutedEventArgs const&)
    {
        bool isChecked = ToolkitToggle().IsChecked();
        if (OnToolkitToggled) {
            OnToolkitToggled(isChecked);
        }
    }
}
