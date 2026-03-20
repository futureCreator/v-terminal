#pragma once

#include "TerminalPane.xaml.g.h"

#include "TerminalBuffer.h"
#include "VtParser.h"
#include "TerminalRenderer.h"
#include "SessionManager.h"
#include "ISession.h"
#include "Types.h"

#include <memory>
#include <string>

namespace winrt::VTerminal::implementation
{
    struct TerminalPane : TerminalPaneT<TerminalPane>
    {
        TerminalPane();
        ~TerminalPane();

        // Public API for PanelGrid
        void AttachSession(::VTerminal::SessionType type, const ::VTerminal::PanelConnection& connection);
        void DetachSession();
        void WriteInput(const std::string& data);
        void SetFocused(bool focused);
        bool IsFocused() const { return m_isFocused; }

        ::VTerminal::SessionId GetSessionId() const { return m_sessionId; }
        ::VTerminal::SessionType GetConnectionType() const { return m_connectionType; }
        std::wstring GetNoteContent() const;

        void UpdateRendererConfig(const ::VTerminal::RendererConfig& config);
        void UpdateTheme(const ::VTerminal::TerminalTheme& theme);

        // XAML event handlers
        void OnSwapChainSizeChanged(winrt::Windows::Foundation::IInspectable const& sender,
                                     winrt::Microsoft::UI::Xaml::SizeChangedEventArgs const& e);
        void OnPointerPressed(winrt::Windows::Foundation::IInspectable const& sender,
                               winrt::Microsoft::UI::Xaml::Input::PointerRoutedEventArgs const& e);
        void OnPointerMoved(winrt::Windows::Foundation::IInspectable const& sender,
                             winrt::Microsoft::UI::Xaml::Input::PointerRoutedEventArgs const& e);
        void OnPointerReleased(winrt::Windows::Foundation::IInspectable const& sender,
                                winrt::Microsoft::UI::Xaml::Input::PointerRoutedEventArgs const& e);
        void OnSwitchLocal(winrt::Windows::Foundation::IInspectable const& sender,
                            winrt::Microsoft::UI::Xaml::RoutedEventArgs const& e);
        void OnSwitchNote(winrt::Windows::Foundation::IInspectable const& sender,
                           winrt::Microsoft::UI::Xaml::RoutedEventArgs const& e);
        void OnZoomToggle(winrt::Windows::Foundation::IInspectable const& sender,
                           winrt::Microsoft::UI::Xaml::RoutedEventArgs const& e);
        void OnRestartClick(winrt::Windows::Foundation::IInspectable const& sender,
                             winrt::Microsoft::UI::Xaml::RoutedEventArgs const& e);

    private:
        void InitializeTerminal();
        void OnSessionData(const std::string& data);
        void OnSessionExit(int exitCode);
        void RequestRender();
        void RecalculateGridSize(float width, float height);
        std::string TranslateKeyToVt(winrt::Windows::System::VirtualKey key, bool ctrl, bool shift, bool alt);

        // Terminal engine components
        std::unique_ptr<::VTerminal::TerminalBuffer> m_buffer;
        std::unique_ptr<::VTerminal::VtParser> m_parser;
        std::unique_ptr<::VTerminal::TerminalRenderer> m_renderer;

        // Session info
        ::VTerminal::SessionId m_sessionId;
        ::VTerminal::SessionType m_connectionType = ::VTerminal::SessionType::Local;
        ::VTerminal::ISession* m_session = nullptr;

        // State
        bool m_isFocused = false;
        bool m_initialized = false;
        int m_gridCols = 80;
        int m_gridRows = 24;

        // Shared session manager (set externally or via singleton)
        static ::VTerminal::SessionManager* s_sessionManager;
    };
}

namespace winrt::VTerminal::factory_implementation
{
    struct TerminalPane : TerminalPaneT<TerminalPane, implementation::TerminalPane>
    {
    };
}
