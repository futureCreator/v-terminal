#include "pch.h"
#include "ThemeManager.h"

#include <winrt/Microsoft.UI.Xaml.h>
#include <winrt/Windows.UI.ViewManagement.h>

using namespace winrt;

namespace VTerminal {

// Static member initialization
std::wstring ThemeManager::s_currentMode = L"auto";
bool ThemeManager::s_resolvedDark = false;
bool ThemeManager::s_initialized = false;

void ThemeManager::initialize()
{
    if (s_initialized) return;
    s_initialized = true;

    // Register for system theme change events
    try {
        Windows::UI::ViewManagement::UISettings uiSettings;
        uiSettings.ColorValuesChanged([](auto&&, auto&&) {
            onSystemThemeChanged();
        });
    } catch (...) {
        // UISettings may not be available in all contexts
    }

    // Resolve initial state
    s_resolvedDark = systemIsDark();
}

void ThemeManager::applyTheme(const std::wstring& mode)
{
    s_currentMode = mode;

    if (mode == L"light") {
        s_resolvedDark = false;
    } else if (mode == L"dark") {
        s_resolvedDark = true;
    } else {
        // "auto" — detect from system
        s_resolvedDark = systemIsDark();
    }

    // Apply to WinUI Application
    try {
        auto app = Microsoft::UI::Xaml::Application::Current();
        if (app) {
            // Note: RequestedTheme can only be set before the first Window is created.
            // After that, use Window.Content's RequestedTheme or per-element theme.
            // For runtime switching, we iterate all windows and set ElementTheme on root.
            // This is a simplified version; full implementation needs Window handle.

            // The actual WinUI way to switch theme at runtime:
            // For each Window, get root FrameworkElement and set RequestedTheme
            // app.Resources().Insert(box_value(L"CurrentTheme"), box_value(mode));
        }
    } catch (...) {
        // May fail if called before Application is fully initialized
    }
}

TerminalTheme ThemeManager::getCurrentTerminalTheme()
{
    return s_resolvedDark ? defaultDarkTheme() : defaultLightTheme();
}

bool ThemeManager::isDarkTheme()
{
    return s_resolvedDark;
}

TerminalTheme ThemeManager::defaultLightTheme()
{
    TerminalTheme theme;
    theme.foreground = L"#1d1f21";
    theme.background = L"#ffffff";
    theme.cursor = L"#1d1f21";
    theme.selectionBackground = L"#b4d5fe";
    theme.ansi = {
        L"#000000",   // 0  Black
        L"#c82829",   // 1  Red
        L"#718c00",   // 2  Green
        L"#eab700",   // 3  Yellow
        L"#4271ae",   // 4  Blue
        L"#8959a8",   // 5  Magenta
        L"#3e999f",   // 6  Cyan
        L"#c5c8c6",   // 7  White
        L"#969896",   // 8  Bright Black
        L"#cc6666",   // 9  Bright Red
        L"#b5bd68",   // 10 Bright Green
        L"#f0c674",   // 11 Bright Yellow
        L"#81a2be",   // 12 Bright Blue
        L"#b294bb",   // 13 Bright Magenta
        L"#8abeb7",   // 14 Bright Cyan
        L"#ffffff"    // 15 Bright White
    };
    return theme;
}

TerminalTheme ThemeManager::defaultDarkTheme()
{
    TerminalTheme theme;
    theme.foreground = L"#c5c8c6";
    theme.background = L"#1d1f21";
    theme.cursor = L"#c5c8c6";
    theme.selectionBackground = L"#373b41";
    theme.ansi = {
        L"#000000",   // 0  Black
        L"#cc6666",   // 1  Red
        L"#b5bd68",   // 2  Green
        L"#f0c674",   // 3  Yellow
        L"#81a2be",   // 4  Blue
        L"#b294bb",   // 5  Magenta
        L"#8abeb7",   // 6  Cyan
        L"#c5c8c6",   // 7  White
        L"#969896",   // 8  Bright Black
        L"#cc6666",   // 9  Bright Red
        L"#b5bd68",   // 10 Bright Green
        L"#f0c674",   // 11 Bright Yellow
        L"#81a2be",   // 12 Bright Blue
        L"#b294bb",   // 13 Bright Magenta
        L"#8abeb7",   // 14 Bright Cyan
        L"#ffffff"    // 15 Bright White
    };
    return theme;
}

bool ThemeManager::systemIsDark()
{
    try {
        Windows::UI::ViewManagement::UISettings uiSettings;
        auto fg = uiSettings.GetColorValue(Windows::UI::ViewManagement::UIColorType::Foreground);
        // If foreground is light (high luminance), the system theme is dark
        return (fg.R + fg.G + fg.B) > 384;  // Threshold: average > 128
    } catch (...) {
        return false; // Default to light if detection fails
    }
}

void ThemeManager::onSystemThemeChanged()
{
    if (s_currentMode == L"auto") {
        s_resolvedDark = systemIsDark();
        // TODO: Notify all open windows/terminals to update their themes
        // EventBus::publish("theme-changed", s_resolvedDark);
    }
}

} // namespace VTerminal
