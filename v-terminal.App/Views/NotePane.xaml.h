#pragma once

#include "NotePane.xaml.g.h"
#include "Types.h"

#include <string>
#include <functional>

namespace winrt::VTerminal::implementation
{
    struct NotePane : NotePaneT<NotePane>
    {
        NotePane();

        // Content management
        void SetContent(const std::wstring& content);
        std::wstring GetContent() const;

        // Background style
        void SetBackground(::VTerminal::NoteBackground style);

        // Focus
        void SetFocused(bool focused);

        // Callbacks
        std::function<void(const std::wstring& content)> OnContentChanged;
        std::function<void()> OnSwitchToTerminalRequested;
        std::function<void()> OnZoomRequested;

        // XAML event handlers
        void OnTextChanged(winrt::Windows::Foundation::IInspectable const& sender,
                            winrt::Microsoft::UI::Xaml::RoutedEventArgs const& e);
        void OnEditorGotFocus(winrt::Windows::Foundation::IInspectable const& sender,
                               winrt::Microsoft::UI::Xaml::RoutedEventArgs const& e);
        void OnEditorLostFocus(winrt::Windows::Foundation::IInspectable const& sender,
                                winrt::Microsoft::UI::Xaml::RoutedEventArgs const& e);
        void OnSwitchLocal(winrt::Windows::Foundation::IInspectable const& sender,
                            winrt::Microsoft::UI::Xaml::RoutedEventArgs const& e);
        void OnZoomToggle(winrt::Windows::Foundation::IInspectable const& sender,
                           winrt::Microsoft::UI::Xaml::RoutedEventArgs const& e);

    private:
        void DrawBackgroundPattern();

        ::VTerminal::NoteBackground m_backgroundStyle = ::VTerminal::NoteBackground::None;
    };
}

namespace winrt::VTerminal::factory_implementation
{
    struct NotePane : NotePaneT<NotePane, implementation::NotePane>
    {
    };
}
