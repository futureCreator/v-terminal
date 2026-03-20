#pragma once
#include "Types.h"
#include "JsonStore.h"
#include <filesystem>

namespace VTerminal {

class Settings {
public:
    explicit Settings(const std::filesystem::path& configDir);

    AppSettings getAppSettings() const;
    void setAppSettings(const AppSettings& settings);

private:
    static nlohmann::json toJson(const AppSettings& s);
    static AppSettings fromJson(const nlohmann::json& j);
    static nlohmann::json terminalConfigToJson(const TerminalConfig& tc);
    static TerminalConfig terminalConfigFromJson(const nlohmann::json& j);
    static nlohmann::json themeToJson(const TerminalTheme& t);
    static TerminalTheme themeFromJson(const nlohmann::json& j);

    JsonStore m_store;
    AppSettings m_settings;
};

} // namespace VTerminal
