#include "AlarmManager.h"
#define WIN32_LEAN_AND_MEAN
#include <Windows.h>
#include <algorithm>
#include <sstream>
#include <iomanip>

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

AlarmManager::AlarmManager(const std::filesystem::path& configDir)
    : m_store(configDir / "alarms.json")
{
    auto loaded = m_store.load();
    if (loaded.has_value()) {
        const auto& j = loaded.value();
        if (j.contains("alarms") && j["alarms"].is_array()) {
            for (const auto& item : j["alarms"]) {
                AlarmEntry alarm;
                if (item.contains("id")) alarm.id = toWide(item["id"].get<std::string>());
                if (item.contains("label")) alarm.label = toWide(item["label"].get<std::string>());
                if (item.contains("time")) alarm.time = toWide(item["time"].get<std::string>());
                if (item.contains("weekdays") && item["weekdays"].is_array()) {
                    for (const auto& d : item["weekdays"]) {
                        alarm.weekdays.push_back(d.get<int>());
                    }
                }
                if (item.contains("enabled")) alarm.enabled = item["enabled"].get<bool>();
                m_alarms.push_back(std::move(alarm));
            }
        }
    }
}

void AlarmManager::addAlarm(const AlarmEntry& alarm) {
    m_alarms.push_back(alarm);
    save();
}

void AlarmManager::removeAlarm(const std::wstring& id) {
    m_alarms.erase(
        std::remove_if(m_alarms.begin(), m_alarms.end(),
            [&id](const AlarmEntry& a) { return a.id == id; }),
        m_alarms.end());
    save();
}

void AlarmManager::toggleAlarm(const std::wstring& id) {
    for (auto& alarm : m_alarms) {
        if (alarm.id == id) {
            alarm.enabled = !alarm.enabled;
            break;
        }
    }
    save();
}

std::vector<AlarmEntry> AlarmManager::getAlarms() const {
    return m_alarms;
}

void AlarmManager::checkAlarms(int hour, int minute, int weekday) {
    // Format current time as HH:mm for comparison
    std::wostringstream ss;
    ss << std::setfill(L'0') << std::setw(2) << hour
       << L':' << std::setw(2) << minute;
    std::wstring currentTime = ss.str();

    for (const auto& alarm : m_alarms) {
        if (!alarm.enabled) continue;
        if (alarm.time != currentTime) continue;

        // Check if weekday matches (empty weekdays means every day)
        if (!alarm.weekdays.empty()) {
            bool dayMatch = std::find(alarm.weekdays.begin(), alarm.weekdays.end(), weekday)
                            != alarm.weekdays.end();
            if (!dayMatch) continue;
        }

        if (m_onAlarm) {
            m_onAlarm(alarm.label);
        }
    }
}

void AlarmManager::onAlarm(std::function<void(const std::wstring& label)> cb) {
    m_onAlarm = std::move(cb);
}

void AlarmManager::save() {
    nlohmann::json arr = nlohmann::json::array();
    for (const auto& alarm : m_alarms) {
        nlohmann::json weekdays = nlohmann::json::array();
        for (int d : alarm.weekdays) {
            weekdays.push_back(d);
        }
        arr.push_back({
            {"id", toUtf8(alarm.id)},
            {"label", toUtf8(alarm.label)},
            {"time", toUtf8(alarm.time)},
            {"weekdays", weekdays},
            {"enabled", alarm.enabled}
        });
    }
    m_store.save({{"alarms", arr}});
}

} // namespace VTerminal
