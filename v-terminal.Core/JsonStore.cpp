#include "JsonStore.h"
#include <fstream>

namespace VTerminal {

JsonStore::JsonStore(std::filesystem::path filePath)
    : m_filePath(std::move(filePath)) {}

std::optional<nlohmann::json> JsonStore::load() {
    if (!std::filesystem::exists(m_filePath)) {
        return std::nullopt;
    }
    try {
        std::ifstream file(m_filePath);
        return nlohmann::json::parse(file);
    } catch (const nlohmann::json::parse_error&) {
        auto bakPath = m_filePath;
        bakPath += ".bak";
        std::filesystem::rename(m_filePath, bakPath);
        return std::nullopt;
    }
}

void JsonStore::save(const nlohmann::json& data) {
    auto dir = m_filePath.parent_path();
    if (!dir.empty()) {
        std::filesystem::create_directories(dir);
    }
    // Atomic write: write to temp, then rename (atomic on NTFS)
    auto tmpPath = m_filePath;
    tmpPath += L".tmp";
    {
        std::ofstream file(tmpPath);
        file << data.dump(2);
    }
    std::filesystem::rename(tmpPath, m_filePath);
}

} // namespace VTerminal
