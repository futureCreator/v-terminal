#pragma once
#include "Types.h"
#include "JsonStore.h"
#include <filesystem>
#include <string>
#include <vector>
#include <functional>

namespace VTerminal {

class AlarmManager {
public:
    explicit AlarmManager(const std::filesystem::path& configDir);

    void addAlarm(const AlarmEntry& alarm);
    void removeAlarm(const std::wstring& id);
    void toggleAlarm(const std::wstring& id);
    std::vector<AlarmEntry> getAlarms() const;
    void checkAlarms(int hour, int minute, int weekday);

    void onAlarm(std::function<void(const std::wstring& label)> cb);

private:
    JsonStore m_store;
    std::vector<AlarmEntry> m_alarms;
    std::function<void(const std::wstring&)> m_onAlarm;
    void save();
};

} // namespace VTerminal
