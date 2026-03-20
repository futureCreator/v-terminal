#include "pch.h"
#include "TerminalPane.xaml.h"
#if __has_include("TerminalPane.g.cpp")
#include "TerminalPane.g.cpp"
#endif

using namespace winrt;
using namespace Microsoft::UI::Xaml;
using namespace Microsoft::UI::Xaml::Input;
using namespace Windows::System;

namespace winrt::VTerminal::implementation
{
    // Static session manager pointer — set by MainWindow on startup
    ::VTerminal::SessionManager* TerminalPane::s_sessionManager = nullptr;

    TerminalPane::TerminalPane()
    {
        InitializeComponent();

        // Subscribe to keyboard input
        TerminalSwapChain().KeyDown([this](auto const&, KeyRoutedEventArgs const& e) {
            if (!m_session) return;

            auto ctrl = (InputKeyboardSource::GetKeyStateForCurrentThread(VirtualKey::Control)
                         & Windows::UI::Core::CoreVirtualKeyStates::Down) == Windows::UI::Core::CoreVirtualKeyStates::Down;
            auto shift = (InputKeyboardSource::GetKeyStateForCurrentThread(VirtualKey::Shift)
                          & Windows::UI::Core::CoreVirtualKeyStates::Down) == Windows::UI::Core::CoreVirtualKeyStates::Down;
            auto alt = (InputKeyboardSource::GetKeyStateForCurrentThread(VirtualKey::Menu)
                        & Windows::UI::Core::CoreVirtualKeyStates::Down) == Windows::UI::Core::CoreVirtualKeyStates::Down;

            auto vtData = TranslateKeyToVt(e.Key(), ctrl, shift, alt);
            if (!vtData.empty()) {
                m_session->write(vtData);
                e.Handled(true);
            }
        });

        // Subscribe to character input for regular text
        TerminalSwapChain().CharacterReceived([this](auto const&, CharacterReceivedRoutedEventArgs const& e) {
            if (!m_session) return;
            wchar_t ch = e.Character();
            if (ch >= 32) { // Printable characters
                std::string utf8;
                // Simple single-byte for ASCII, multi-byte for wider chars
                if (ch < 128) {
                    utf8 += static_cast<char>(ch);
                } else {
                    // UTF-8 encode the wchar_t
                    if (ch < 0x800) {
                        utf8 += static_cast<char>(0xC0 | (ch >> 6));
                        utf8 += static_cast<char>(0x80 | (ch & 0x3F));
                    } else {
                        utf8 += static_cast<char>(0xE0 | (ch >> 12));
                        utf8 += static_cast<char>(0x80 | ((ch >> 6) & 0x3F));
                        utf8 += static_cast<char>(0x80 | (ch & 0x3F));
                    }
                }
                m_session->write(utf8);
                e.Handled(true);
            }
        });
    }

    TerminalPane::~TerminalPane()
    {
        DetachSession();
    }

    void TerminalPane::InitializeTerminal()
    {
        if (m_initialized) return;

        // Create terminal buffer with default dimensions
        m_buffer = std::make_unique<::VTerminal::TerminalBuffer>(m_gridCols, m_gridRows, 5000);
        m_parser = std::make_unique<::VTerminal::VtParser>(*m_buffer);
        m_renderer = std::make_unique<::VTerminal::TerminalRenderer>();

        // Initialize renderer with SwapChainPanel
        auto swapChain = TerminalSwapChain();
        auto panelNative = swapChain.as<ISwapChainPanelNative>();
        if (panelNative) {
            float width = static_cast<float>(swapChain.ActualWidth());
            float height = static_cast<float>(swapChain.ActualHeight());
            if (width > 0 && height > 0) {
                m_renderer->initialize(panelNative.get(), width, height);
                RecalculateGridSize(width, height);
            }
        }

        m_initialized = true;
    }

    void TerminalPane::AttachSession(::VTerminal::SessionType type, const ::VTerminal::PanelConnection& connection)
    {
        // Detach any existing session first
        DetachSession();

        if (!m_initialized) {
            InitializeTerminal();
        }

        m_connectionType = type;

        if (!s_sessionManager) return;

        // Create new session
        m_sessionId = s_sessionManager->createSession(type, connection);
        m_session = s_sessionManager->getSession(m_sessionId);

        if (!m_session) return;

        // Wire data callback: session output -> VtParser -> TerminalBuffer -> render
        m_session->onData([this](const std::string& data) {
            // TODO: This callback comes from I/O thread; dispatch to UI thread
            // DispatcherQueue().TryEnqueue([this, data]() {
                OnSessionData(data);
            // });
        });

        // Wire exit callback
        m_session->onExit([this](int exitCode) {
            // TODO: Dispatch to UI thread
            // DispatcherQueue().TryEnqueue([this, exitCode]() {
                OnSessionExit(exitCode);
            // });
        });

        // Start session with current grid dimensions
        m_session->start(static_cast<short>(m_gridCols), static_cast<short>(m_gridRows));

        // Hide error overlay
        ErrorOverlay().Visibility(Visibility::Collapsed);
    }

    void TerminalPane::DetachSession()
    {
        if (!m_sessionId.empty() && s_sessionManager) {
            s_sessionManager->killSession(m_sessionId);
        }
        m_session = nullptr;
        m_sessionId.clear();
    }

    void TerminalPane::WriteInput(const std::string& data)
    {
        if (m_session) {
            m_session->write(data);
        }
    }

    void TerminalPane::SetFocused(bool focused)
    {
        m_isFocused = focused;
        FocusBorder().BorderBrush(focused
            ? Microsoft::UI::Xaml::Media::SolidColorBrush(Microsoft::UI::Colors::CornflowerBlue())
            : Microsoft::UI::Xaml::Media::SolidColorBrush(Microsoft::UI::Colors::Transparent()));

        if (focused) {
            TerminalSwapChain().Focus(FocusState::Programmatic);
        }
    }

    std::wstring TerminalPane::GetNoteContent() const
    {
        // TerminalPane does not hold note content; NotePane handles that
        return L"";
    }

    void TerminalPane::UpdateRendererConfig(const ::VTerminal::RendererConfig& config)
    {
        if (m_renderer) {
            m_renderer->setConfig(config);
            RequestRender();
        }
    }

    void TerminalPane::UpdateTheme(const ::VTerminal::TerminalTheme& theme)
    {
        if (m_renderer) {
            m_renderer->setTheme(theme);
            RequestRender();
        }
    }

    void TerminalPane::OnSessionData(const std::string& data)
    {
        if (m_parser) {
            m_parser->feed(data);
            RequestRender();
        }
    }

    void TerminalPane::OnSessionExit(int exitCode)
    {
        // Show error overlay with restart button
        ErrorOverlay().Visibility(Visibility::Visible);

        // TODO: Use localized string from resources
        hstring msg = exitCode == 0
            ? L"Process exited normally"
            : L"Process exited with code " + to_hstring(exitCode);
        ErrorText().Text(msg);

        m_session = nullptr;
    }

    void TerminalPane::RequestRender()
    {
        if (m_renderer && m_buffer && m_parser) {
            // TODO: Get cursor position from VtParser (need to expose cursor row/col)
            m_renderer->render(*m_buffer, 0, 0);
        }
    }

    void TerminalPane::RecalculateGridSize(float width, float height)
    {
        if (!m_renderer || m_renderer->cellWidth() <= 0 || m_renderer->cellHeight() <= 0) return;

        int newCols = static_cast<int>(width / m_renderer->cellWidth());
        int newRows = static_cast<int>(height / m_renderer->cellHeight());

        if (newCols < 1) newCols = 1;
        if (newRows < 1) newRows = 1;

        if (newCols != m_gridCols || newRows != m_gridRows) {
            m_gridCols = newCols;
            m_gridRows = newRows;

            if (m_buffer) {
                m_buffer->resize(m_gridCols, m_gridRows);
            }
            if (m_session) {
                m_session->resize(static_cast<short>(m_gridCols), static_cast<short>(m_gridRows));
            }
        }
    }

    void TerminalPane::OnSwapChainSizeChanged(IInspectable const&, SizeChangedEventArgs const& e)
    {
        float width = static_cast<float>(e.NewSize().Width);
        float height = static_cast<float>(e.NewSize().Height);

        if (width <= 0 || height <= 0) return;

        if (!m_initialized) {
            InitializeTerminal();
        }

        if (m_renderer) {
            m_renderer->resize(width, height);
            RecalculateGridSize(width, height);
            RequestRender();
        }
    }

    void TerminalPane::OnPointerPressed(IInspectable const&, PointerRoutedEventArgs const& e)
    {
        SetFocused(true);
        // TODO: Begin text selection if applicable
    }

    void TerminalPane::OnPointerMoved(IInspectable const&, PointerRoutedEventArgs const&)
    {
        // TODO: Update text selection range
    }

    void TerminalPane::OnPointerReleased(IInspectable const&, PointerRoutedEventArgs const&)
    {
        // TODO: Finalize text selection, copy to clipboard if any
    }

    void TerminalPane::OnSwitchLocal(IInspectable const&, RoutedEventArgs const&)
    {
        ::VTerminal::PanelConnection conn;
        conn.type = ::VTerminal::SessionType::Local;
        AttachSession(::VTerminal::SessionType::Local, conn);
    }

    void TerminalPane::OnSwitchNote(IInspectable const&, RoutedEventArgs const&)
    {
        // TODO: Signal PanelGrid to replace this panel with a NotePane
        // This requires communication with the parent PanelGrid
    }

    void TerminalPane::OnZoomToggle(IInspectable const&, RoutedEventArgs const&)
    {
        // TODO: Signal PanelGrid to zoom/unzoom this panel
    }

    void TerminalPane::OnRestartClick(IInspectable const&, RoutedEventArgs const&)
    {
        // Restart with same connection type
        ::VTerminal::PanelConnection conn;
        conn.type = m_connectionType;
        AttachSession(m_connectionType, conn);
    }

    std::string TerminalPane::TranslateKeyToVt(VirtualKey key, bool ctrl, bool shift, bool alt)
    {
        // Translate special keys to VT escape sequences
        switch (key) {
            case VirtualKey::Enter:    return "\r";
            case VirtualKey::Back:     return "\x7f";
            case VirtualKey::Tab:      return shift ? "\x1b[Z" : "\t";
            case VirtualKey::Escape:   return "\x1b";
            case VirtualKey::Up:       return "\x1b[A";
            case VirtualKey::Down:     return "\x1b[B";
            case VirtualKey::Right:    return "\x1b[C";
            case VirtualKey::Left:     return "\x1b[D";
            case VirtualKey::Home:     return "\x1b[H";
            case VirtualKey::End:      return "\x1b[F";
            case VirtualKey::Insert:   return "\x1b[2~";
            case VirtualKey::Delete:   return "\x1b[3~";
            case VirtualKey::PageUp:   return "\x1b[5~";
            case VirtualKey::PageDown: return "\x1b[6~";
            case VirtualKey::F1:       return "\x1bOP";
            case VirtualKey::F2:       return "\x1bOQ";
            case VirtualKey::F3:       return "\x1bOR";
            case VirtualKey::F4:       return "\x1bOS";
            case VirtualKey::F5:       return "\x1b[15~";
            case VirtualKey::F6:       return "\x1b[17~";
            case VirtualKey::F7:       return "\x1b[18~";
            case VirtualKey::F8:       return "\x1b[19~";
            case VirtualKey::F9:       return "\x1b[20~";
            case VirtualKey::F10:      return "\x1b[21~";
            case VirtualKey::F11:      return "\x1b[23~";
            case VirtualKey::F12:      return "\x1b[24~";
            default: break;
        }

        // Ctrl+letter combinations
        if (ctrl && !alt) {
            int vk = static_cast<int>(key);
            if (vk >= static_cast<int>(VirtualKey::A) && vk <= static_cast<int>(VirtualKey::Z)) {
                char ctrlChar = static_cast<char>(vk - static_cast<int>(VirtualKey::A) + 1);
                return std::string(1, ctrlChar);
            }
        }

        // Regular character input is handled by CharacterReceived event
        return "";
    }
}
