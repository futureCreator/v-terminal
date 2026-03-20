#pragma once

#include "Types.h"
#include <string>

// Forward declarations for WinUI types (avoid pulling full headers here)
namespace winrt::Microsoft::UI::Xaml {
    enum class ElementTheme : int32_t;
    struct Application;
}

namespace VTerminal {

/// Static utility class for managing app and terminal themes.
/// Bridges the WinUI 3 theme system with terminal color palettes.
class ThemeManager {
public:
    /// Initialize the ThemeManager. Call once during App startup.
    /// Registers for system theme change notifications.
    static void initialize();

    /// Apply the specified theme mode. Accepts "auto", "light", or "dark".
    /// Updates WinUI Application.RequestedTheme and caches the resolved mode.
    static void applyTheme(const std::wstring& mode);

    /// Get the terminal color palette for the current resolved theme.
    static TerminalTheme getCurrentTerminalTheme();

    /// Returns true if the current resolved theme is dark.
    static bool isDarkTheme();

    /// Get the default light terminal theme colors.
    static TerminalTheme defaultLightTheme();

    /// Get the default dark terminal theme colors.
    static TerminalTheme defaultDarkTheme();

private:
    /// Called when the system theme changes (auto mode only).
    static void onSystemThemeChanged();

    /// Resolve "auto" to actual light/dark based on system setting.
    static bool systemIsDark();

    // Cached state
    static std::wstring s_currentMode; // "auto", "light", "dark"
    static bool s_resolvedDark;        // Resolved theme after auto detection
    static bool s_initialized;
};

} // namespace VTerminal
