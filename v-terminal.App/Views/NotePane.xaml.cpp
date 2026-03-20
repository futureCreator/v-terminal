#include "pch.h"
#include "NotePane.xaml.h"
#if __has_include("NotePane.g.cpp")
#include "NotePane.g.cpp"
#endif

using namespace winrt;
using namespace Microsoft::UI::Xaml;
using namespace Microsoft::UI::Xaml::Controls;
using namespace Microsoft::UI::Xaml::Shapes;
using namespace Microsoft::UI::Xaml::Media;

namespace winrt::VTerminal::implementation
{
    NotePane::NotePane()
    {
        InitializeComponent();
    }

    void NotePane::SetContent(const std::wstring& content)
    {
        auto editor = NoteEditor();
        editor.Document().SetText(Microsoft::UI::Text::TextSetOptions::None,
                                   winrt::hstring(content));
    }

    std::wstring NotePane::GetContent() const
    {
        hstring text;
        NoteEditor().Document().GetText(Microsoft::UI::Text::TextGetOptions::None, text);
        return std::wstring(text);
    }

    void NotePane::SetBackground(::VTerminal::NoteBackground style)
    {
        m_backgroundStyle = style;
        DrawBackgroundPattern();
    }

    void NotePane::SetFocused(bool focused)
    {
        if (focused) {
            NoteEditor().Focus(FocusState::Programmatic);
        }
    }

    void NotePane::DrawBackgroundPattern()
    {
        auto canvas = BackgroundPattern();
        canvas.Children().Clear();

        if (m_backgroundStyle == ::VTerminal::NoteBackground::None) return;

        // Get actual dimensions
        float width = static_cast<float>(canvas.ActualWidth());
        float height = static_cast<float>(canvas.ActualHeight());
        if (width <= 0 || height <= 0) return;

        auto lineColor = SolidColorBrush(Windows::UI::Color{30, 128, 128, 128});

        switch (m_backgroundStyle) {
            case ::VTerminal::NoteBackground::Ruled: {
                // Horizontal lines every 28px
                float spacing = 28.0f;
                for (float y = spacing; y < height; y += spacing) {
                    auto line = Line();
                    line.X1(0); line.Y1(y);
                    line.X2(width); line.Y2(y);
                    line.Stroke(lineColor);
                    line.StrokeThickness(0.5);
                    canvas.Children().Append(line);
                }
                break;
            }
            case ::VTerminal::NoteBackground::Grid: {
                // Horizontal + vertical lines every 28px
                float spacing = 28.0f;
                for (float y = spacing; y < height; y += spacing) {
                    auto line = Line();
                    line.X1(0); line.Y1(y);
                    line.X2(width); line.Y2(y);
                    line.Stroke(lineColor);
                    line.StrokeThickness(0.5);
                    canvas.Children().Append(line);
                }
                for (float x = spacing; x < width; x += spacing) {
                    auto line = Line();
                    line.X1(x); line.Y1(0);
                    line.X2(x); line.Y2(height);
                    line.Stroke(lineColor);
                    line.StrokeThickness(0.5);
                    canvas.Children().Append(line);
                }
                break;
            }
            case ::VTerminal::NoteBackground::Dots: {
                // Dot pattern every 28px
                float spacing = 28.0f;
                for (float y = spacing; y < height; y += spacing) {
                    for (float x = spacing; x < width; x += spacing) {
                        auto ellipse = Ellipse();
                        ellipse.Width(2);
                        ellipse.Height(2);
                        ellipse.Fill(lineColor);
                        Canvas::SetLeft(ellipse, x - 1);
                        Canvas::SetTop(ellipse, y - 1);
                        canvas.Children().Append(ellipse);
                    }
                }
                break;
            }
            default:
                break;
        }
    }

    void NotePane::OnTextChanged(IInspectable const&, RoutedEventArgs const&)
    {
        if (OnContentChanged) {
            OnContentChanged(GetContent());
        }
    }

    void NotePane::OnEditorGotFocus(IInspectable const&, RoutedEventArgs const&)
    {
        // TODO: Notify PanelGrid that this panel is focused
    }

    void NotePane::OnEditorLostFocus(IInspectable const&, RoutedEventArgs const&)
    {
        // Nothing specific needed
    }

    void NotePane::OnSwitchLocal(IInspectable const&, RoutedEventArgs const&)
    {
        if (OnSwitchToTerminalRequested) {
            OnSwitchToTerminalRequested();
        }
    }

    void NotePane::OnZoomToggle(IInspectable const&, RoutedEventArgs const&)
    {
        if (OnZoomRequested) {
            OnZoomRequested();
        }
    }
}
