#pragma once
#include "JsonStore.h"
#include <filesystem>
#include <string>
#include <vector>

namespace VTerminal {

struct ClipboardEntry {
    std::wstring text;
};

class ClipboardHistory {
public:
    ClipboardHistory(const std::filesystem::path& configDir, int maxEntries);

    void add(const std::wstring& text);
    std::vector<ClipboardEntry> getEntries() const;
    void clear();

private:
    JsonStore m_store;
    std::vector<ClipboardEntry> m_entries;
    int m_maxEntries;
    void save();
};

} // namespace VTerminal
