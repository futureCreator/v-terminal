#include "ClipboardHistory.h"
#define WIN32_LEAN_AND_MEAN
#include <Windows.h>
#include <algorithm>

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

ClipboardHistory::ClipboardHistory(const std::filesystem::path& configDir, int maxEntries)
    : m_store(configDir / "clipboard.json")
    , m_maxEntries(maxEntries)
{
    auto loaded = m_store.load();
    if (loaded.has_value()) {
        const auto& j = loaded.value();
        if (j.contains("entries") && j["entries"].is_array()) {
            for (const auto& item : j["entries"]) {
                ClipboardEntry entry;
                if (item.contains("text")) entry.text = toWide(item["text"].get<std::string>());
                m_entries.push_back(std::move(entry));
            }
        }
    }
}

void ClipboardHistory::add(const std::wstring& text) {
    if (text.empty()) return;

    // Deduplicate: remove existing entry with the same text
    m_entries.erase(
        std::remove_if(m_entries.begin(), m_entries.end(),
            [&text](const ClipboardEntry& e) { return e.text == text; }),
        m_entries.end());

    // Insert at front (newest first)
    m_entries.insert(m_entries.begin(), ClipboardEntry{text});

    // Cap at maxEntries
    if (static_cast<int>(m_entries.size()) > m_maxEntries) {
        m_entries.resize(m_maxEntries);
    }

    save();
}

std::vector<ClipboardEntry> ClipboardHistory::getEntries() const {
    return m_entries;
}

void ClipboardHistory::clear() {
    m_entries.clear();
    save();
}

void ClipboardHistory::save() {
    nlohmann::json arr = nlohmann::json::array();
    for (const auto& entry : m_entries) {
        arr.push_back({{"text", toUtf8(entry.text)}});
    }
    m_store.save({{"entries", arr}});
}

} // namespace VTerminal
