#include "Settings.h"
#define WIN32_LEAN_AND_MEAN
#include <Windows.h>

namespace VTerminal {

namespace {
    std::string toUtf8(const std::wstring& ws) {
        if (ws.empty()) return {};
        int sz = WideCharToMultiByte(CP_UTF8, 0, ws.data(), static_cast<int>(ws.size()), nullptr, 0, nullptr, nullptr);
        std::string out(sz, '\0');
        WideCharToMultiByte(CP_UTF8, 0, ws.data(), static_cast<int>(ws.size()), out.data(), sz, nullptr, nullptr);
        return out;
    }

    std::wstring toWide(const std::string& s) {
        if (s.empty()) return {};
        int sz = MultiByteToWideChar(CP_UTF8, 0, s.data(), static_cast<int>(s.size()), nullptr, 0);
        std::wstring out(sz, L'\0');
        MultiByteToWideChar(CP_UTF8, 0, s.data(), static_cast<int>(s.size()), out.data(), sz);
        return out;
    }
} // anonymous namespace

Settings::Settings(const std::filesystem::path& configDir)
    : m_store(configDir / "settings.json")
{
    auto loaded = m_store.load();
    if (loaded.has_value()) {
        m_settings = fromJson(loaded.value());
    }
}

AppSettings Settings::getAppSettings() const {
    return m_settings;
}

void Settings::setAppSettings(const AppSettings& settings) {
    m_settings = settings;
    m_store.save(toJson(m_settings));
}

nlohmann::json Settings::toJson(const AppSettings& s) {
    return {
        {"theme", toUtf8(s.theme)},
        {"language", toUtf8(s.language)},
        {"noteBackground", static_cast<int>(s.noteBackground)},
        {"terminal", terminalConfigToJson(s.terminal)},
        {"lightTheme", themeToJson(s.lightTheme)},
        {"darkTheme", themeToJson(s.darkTheme)}
    };
}

AppSettings Settings::fromJson(const nlohmann::json& j) {
    AppSettings s;
    if (j.contains("theme")) s.theme = toWide(j["theme"].get<std::string>());
    if (j.contains("language")) s.language = toWide(j["language"].get<std::string>());
    if (j.contains("noteBackground")) s.noteBackground = static_cast<NoteBackground>(j["noteBackground"].get<int>());
    if (j.contains("terminal")) s.terminal = terminalConfigFromJson(j["terminal"]);
    if (j.contains("lightTheme")) s.lightTheme = themeFromJson(j["lightTheme"]);
    if (j.contains("darkTheme")) s.darkTheme = themeFromJson(j["darkTheme"]);
    return s;
}

nlohmann::json Settings::terminalConfigToJson(const TerminalConfig& tc) {
    return {
        {"fontFamily", toUtf8(tc.fontFamily)},
        {"fontSize", tc.fontSize},
        {"cursorStyle", static_cast<int>(tc.cursorStyle)},
        {"cursorBlink", tc.cursorBlink},
        {"lineHeight", tc.lineHeight},
        {"scrollbackLines", tc.scrollbackLines}
    };
}

TerminalConfig Settings::terminalConfigFromJson(const nlohmann::json& j) {
    TerminalConfig tc;
    if (j.contains("fontFamily")) tc.fontFamily = toWide(j["fontFamily"].get<std::string>());
    if (j.contains("fontSize")) tc.fontSize = j["fontSize"].get<int>();
    if (j.contains("cursorStyle")) tc.cursorStyle = static_cast<CursorStyle>(j["cursorStyle"].get<int>());
    if (j.contains("cursorBlink")) tc.cursorBlink = j["cursorBlink"].get<bool>();
    if (j.contains("lineHeight")) tc.lineHeight = j["lineHeight"].get<double>();
    if (j.contains("scrollbackLines")) tc.scrollbackLines = j["scrollbackLines"].get<int>();
    return tc;
}

nlohmann::json Settings::themeToJson(const TerminalTheme& t) {
    nlohmann::json ansi = nlohmann::json::array();
    for (const auto& c : t.ansi) ansi.push_back(toUtf8(c));
    return {
        {"foreground", toUtf8(t.foreground)},
        {"background", toUtf8(t.background)},
        {"cursor", toUtf8(t.cursor)},
        {"selectionBackground", toUtf8(t.selectionBackground)},
        {"ansi", ansi}
    };
}

TerminalTheme Settings::themeFromJson(const nlohmann::json& j) {
    TerminalTheme t;
    if (j.contains("foreground")) t.foreground = toWide(j["foreground"].get<std::string>());
    if (j.contains("background")) t.background = toWide(j["background"].get<std::string>());
    if (j.contains("cursor")) t.cursor = toWide(j["cursor"].get<std::string>());
    if (j.contains("selectionBackground")) t.selectionBackground = toWide(j["selectionBackground"].get<std::string>());
    if (j.contains("ansi")) {
        for (const auto& c : j["ansi"]) {
            t.ansi.push_back(toWide(c.get<std::string>()));
        }
    }
    return t;
}

} // namespace VTerminal
