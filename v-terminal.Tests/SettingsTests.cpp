#include <gtest/gtest.h>
#include "Settings.h"
#include <filesystem>

class SettingsTest : public ::testing::Test {
protected:
    std::filesystem::path testDir;
    void SetUp() override {
        testDir = std::filesystem::temp_directory_path() / "v-terminal-settings-test";
        std::filesystem::create_directories(testDir);
    }
    void TearDown() override {
        std::filesystem::remove_all(testDir);
    }
};

TEST_F(SettingsTest, DefaultSettingsOnFirstRun) {
    VTerminal::Settings settings(testDir);
    auto config = settings.getAppSettings();
    EXPECT_EQ(config.theme, L"auto");
    EXPECT_EQ(config.terminal.fontFamily, L"JetBrains Mono");
    EXPECT_EQ(config.terminal.fontSize, 14);
}

TEST_F(SettingsTest, SaveAndReload) {
    {
        VTerminal::Settings settings(testDir);
        auto config = settings.getAppSettings();
        config.theme = L"dark";
        config.terminal.fontSize = 18;
        settings.setAppSettings(config);
    }
    {
        VTerminal::Settings settings(testDir);
        auto config = settings.getAppSettings();
        EXPECT_EQ(config.theme, L"dark");
        EXPECT_EQ(config.terminal.fontSize, 18);
    }
}
