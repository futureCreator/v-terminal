#pragma once
#include <filesystem>
#include <optional>
#include <nlohmann/json.hpp>

namespace VTerminal {

class JsonStore {
public:
    explicit JsonStore(std::filesystem::path filePath);
    std::optional<nlohmann::json> load();
    void save(const nlohmann::json& data);

private:
    std::filesystem::path m_filePath;
};

} // namespace VTerminal
