#pragma once

#include "MainWindow.xaml.g.h"

#include "SessionManager.h"
#include "Settings.h"
#include "EventBus.h"
#include "Types.h"

#include <memory>

namespace winrt::VTerminal::implementation
{
    struct MainWindow : MainWindowT<MainWindow>
    {
        MainWindow();

        // Keyboard shortcut handler
        void OnWindowKeyDown(winrt::Windows::Foundation::IInspectable const& sender,
                              winrt::Microsoft::UI::Xaml::Input::KeyRoutedEventArgs const& e);

    private:
        void SetupCustomTitleBar();
        void SetupKeyboardShortcuts();
        void InitializeServices();

        // Shortcut actions
        void ToggleCommandPalette();
        void AddNewTab();
        void ToggleSidePanel();
        void FocusNextPanel();
        void FocusPreviousPanel();

        // Window lifecycle
        void OnWindowClosed(winrt::Windows::Foundation::IInspectable const& sender,
                             winrt::Microsoft::UI::Xaml::WindowEventArgs const& args);

        // Shared services
        std::unique_ptr<::VTerminal::SessionManager> m_sessionManager;
        std::unique_ptr<::VTerminal::Settings> m_settings;
        std::unique_ptr<::VTerminal::EventBus> m_eventBus;
    };
}

namespace winrt::VTerminal::factory_implementation
{
    struct MainWindow : MainWindowT<MainWindow, implementation::MainWindow>
    {
    };
}
