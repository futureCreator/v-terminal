#include "pch.h"
#include "MainWindow.xaml.h"
#if __has_include("MainWindow.g.cpp")
#include "MainWindow.g.cpp"
#endif

#include "ThemeManager.h"
#include "WorkspaceManager.h"

#include <ShlObj.h>   // SHGetKnownFolderPath
#include <filesystem>

using namespace winrt;
using namespace Microsoft::UI::Xaml;
using namespace Microsoft::UI::Xaml::Input;
using namespace Windows::System;

namespace winrt::VTerminal::implementation
{
    MainWindow::MainWindow()
    {
        InitializeComponent();

        SetupCustomTitleBar();
        SetupKeyboardShortcuts();
        InitializeServices();

        // Subscribe to window close for workspace save
        this->Closed({this, &MainWindow::OnWindowClosed});
    }

    void MainWindow::SetupCustomTitleBar()
    {
        // Extend content into the title bar area
        ExtendsContentIntoTitleBar(true);
        SetTitleBar(AppTitleBar());
    }

    void MainWindow::SetupKeyboardShortcuts()
    {
        // Register PreviewKeyDown on the content root to capture shortcuts before children
        this->Content().as<UIElement>().KeyDown({this, &MainWindow::OnWindowKeyDown});
    }

    void MainWindow::InitializeServices()
    {
        // Determine data directory: %APPDATA%\v-terminal
        wchar_t* appDataPath = nullptr;
        if (SUCCEEDED(SHGetKnownFolderPath(FOLDERID_RoamingAppData, 0, nullptr, &appDataPath))) {
            std::filesystem::path dataDir = std::filesystem::path(appDataPath) / L"v-terminal";
            CoTaskMemFree(appDataPath);

            std::filesystem::create_directories(dataDir);

            m_settings = std::make_unique<::VTerminal::Settings>(dataDir);
            m_sessionManager = std::make_unique<::VTerminal::SessionManager>();
            m_eventBus = std::make_unique<::VTerminal::EventBus>();

            // Apply saved theme
            auto appSettings = m_settings->getAppSettings();
            ::VTerminal::ThemeManager::applyTheme(appSettings.theme);

            // TODO: Restore workspace from WorkspaceManager
            // WorkspaceManager workspaceMgr(dataDir);
            // auto workspace = workspaceMgr.load();
            // if (workspace) { ... restore tabs/panels ... }
        }
    }

    void MainWindow::OnWindowKeyDown(IInspectable const&, KeyRoutedEventArgs const& e)
    {
        auto ctrl = (InputKeyboardSource::GetKeyStateForCurrentThread(VirtualKey::Control)
                     & Windows::UI::Core::CoreVirtualKeyStates::Down) == Windows::UI::Core::CoreVirtualKeyStates::Down;
        auto shift = (InputKeyboardSource::GetKeyStateForCurrentThread(VirtualKey::Shift)
                      & Windows::UI::Core::CoreVirtualKeyStates::Down) == Windows::UI::Core::CoreVirtualKeyStates::Down;

        if (ctrl && e.Key() == VirtualKey::K) {
            ToggleCommandPalette();
            e.Handled(true);
        }
        else if (ctrl && shift && e.Key() == VirtualKey::T) {
            AddNewTab();
            e.Handled(true);
        }
        else if (ctrl && shift && e.Key() == VirtualKey::N) {
            ToggleSidePanel();
            e.Handled(true);
        }
    }

    void MainWindow::ToggleCommandPalette()
    {
        // TODO: Show/hide CommandPalette ContentDialog
        // auto palette = winrt::make<CommandPalette>();
        // palette.XamlRoot(this->Content().XamlRoot());
        // co_await palette.ShowAsync();
    }

    void MainWindow::AddNewTab()
    {
        // Delegate to TabBar
        // TabBarControl().AddNewTab();
    }

    void MainWindow::ToggleSidePanel()
    {
        auto current = SidePanelControl().Visibility();
        SidePanelControl().Visibility(
            current == Visibility::Visible ? Visibility::Collapsed : Visibility::Visible);
    }

    void MainWindow::FocusNextPanel()
    {
        // TODO: Delegate to PanelGrid
        // PanelGridControl().FocusNextPanel();
    }

    void MainWindow::FocusPreviousPanel()
    {
        // TODO: Delegate to PanelGrid
        // PanelGridControl().FocusPreviousPanel();
    }

    void MainWindow::OnWindowClosed(IInspectable const&, WindowEventArgs const&)
    {
        // TODO: Save workspace state
        // WorkspaceManager workspaceMgr(dataDir);
        // workspaceMgr.save(collectCurrentState());

        // Kill all sessions
        // m_sessionManager will be destroyed, killing all sessions in destructor
    }
}
