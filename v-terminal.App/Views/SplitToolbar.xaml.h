#pragma once

#include "SplitToolbar.xaml.g.h"

#include <functional>

namespace winrt::VTerminal::implementation
{
    struct SplitToolbar : SplitToolbarT<SplitToolbar>
    {
        SplitToolbar();

        // Callbacks for MainWindow coordination
        std::function<void(int presetIndex)> OnLayoutChanged;
        std::function<void(bool enabled)> OnBroadcastChanged;
        std::function<void(bool visible)> OnToolkitToggled;

        // Update active layout indicator
        void SetActiveLayout(int presetIndex);

        // XAML event handlers
        void OnLayout1Click(winrt::Windows::Foundation::IInspectable const& sender,
                             winrt::Microsoft::UI::Xaml::RoutedEventArgs const& e);
        void OnLayout2Click(winrt::Windows::Foundation::IInspectable const& sender,
                             winrt::Microsoft::UI::Xaml::RoutedEventArgs const& e);
        void OnLayout3Click(winrt::Windows::Foundation::IInspectable const& sender,
                             winrt::Microsoft::UI::Xaml::RoutedEventArgs const& e);
        void OnLayout4Click(winrt::Windows::Foundation::IInspectable const& sender,
                             winrt::Microsoft::UI::Xaml::RoutedEventArgs const& e);
        void OnLayout5Click(winrt::Windows::Foundation::IInspectable const& sender,
                             winrt::Microsoft::UI::Xaml::RoutedEventArgs const& e);
        void OnLayout6Click(winrt::Windows::Foundation::IInspectable const& sender,
                             winrt::Microsoft::UI::Xaml::RoutedEventArgs const& e);
        void OnBroadcastToggle(winrt::Windows::Foundation::IInspectable const& sender,
                                winrt::Microsoft::UI::Xaml::RoutedEventArgs const& e);
        void OnToolkitToggle(winrt::Windows::Foundation::IInspectable const& sender,
                              winrt::Microsoft::UI::Xaml::RoutedEventArgs const& e);

    private:
        void SelectLayout(int index);
        void UpdateLayoutButtonStates();

        int m_activeLayout = 1;
    };
}

namespace winrt::VTerminal::factory_implementation
{
    struct SplitToolbar : SplitToolbarT<SplitToolbar, implementation::SplitToolbar>
    {
    };
}
