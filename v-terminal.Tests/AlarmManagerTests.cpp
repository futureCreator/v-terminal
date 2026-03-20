#include <gtest/gtest.h>
#include "AlarmManager.h"
#include <filesystem>

TEST(AlarmManagerTest, AlarmTriggersAtCorrectTime) {
    auto dir = std::filesystem::temp_directory_path() / "alarm-test";
    std::filesystem::create_directories(dir);

    VTerminal::AlarmManager mgr(dir);
    bool triggered = false;
    mgr.onAlarm([&](const std::wstring&) { triggered = true; });

    VTerminal::AlarmEntry alarm;
    alarm.id = L"1";
    alarm.label = L"Test";
    alarm.time = L"14:30";
    alarm.weekdays = {0, 1, 2, 3, 4};
    alarm.enabled = true;
    mgr.addAlarm(alarm);

    mgr.checkAlarms(14, 30, 0); // Monday
    EXPECT_TRUE(triggered);

    std::filesystem::remove_all(dir);
}
