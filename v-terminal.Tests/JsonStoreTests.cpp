#include <gtest/gtest.h>
#include "JsonStore.h"
#include <filesystem>
#include <fstream>

namespace fs = std::filesystem;

class JsonStoreTest : public ::testing::Test {
protected:
    fs::path testDir;
    void SetUp() override {
        testDir = fs::temp_directory_path() / "v-terminal-test";
        fs::create_directories(testDir);
    }
    void TearDown() override {
        fs::remove_all(testDir);
    }
};

TEST_F(JsonStoreTest, SaveAndLoad) {
    VTerminal::JsonStore store(testDir / "test.json");
    nlohmann::json data = {{"key", "value"}, {"number", 42}};
    store.save(data);

    auto loaded = store.load();
    ASSERT_TRUE(loaded.has_value());
    EXPECT_EQ(loaded.value()["key"], "value");
    EXPECT_EQ(loaded.value()["number"], 42);
}

TEST_F(JsonStoreTest, LoadMissingFileReturnsNullopt) {
    VTerminal::JsonStore store(testDir / "nonexistent.json");
    auto loaded = store.load();
    EXPECT_FALSE(loaded.has_value());
}

TEST_F(JsonStoreTest, CorruptedFileBacksUpAndReturnsNullopt) {
    auto path = testDir / "corrupt.json";
    std::ofstream(path) << "not valid json {{{";

    VTerminal::JsonStore store(path);
    auto loaded = store.load();
    EXPECT_FALSE(loaded.has_value());
    EXPECT_TRUE(fs::exists(testDir / "corrupt.json.bak"));
}
