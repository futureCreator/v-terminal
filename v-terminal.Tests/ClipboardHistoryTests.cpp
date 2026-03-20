#include <gtest/gtest.h>
#include "ClipboardHistory.h"
#include <filesystem>

TEST(ClipboardHistoryTest, AddsEntries) {
    auto dir = std::filesystem::temp_directory_path() / "clip-test";
    std::filesystem::create_directories(dir);
    VTerminal::ClipboardHistory hist(dir, 50);

    hist.add(L"first");
    hist.add(L"second");

    auto entries = hist.getEntries();
    EXPECT_EQ(entries.size(), 2);
    EXPECT_EQ(entries[0].text, L"second");
    std::filesystem::remove_all(dir);
}

TEST(ClipboardHistoryTest, DeduplicatesAndMovesToTop) {
    auto dir = std::filesystem::temp_directory_path() / "clip-test2";
    std::filesystem::create_directories(dir);
    VTerminal::ClipboardHistory hist(dir, 50);

    hist.add(L"alpha");
    hist.add(L"beta");
    hist.add(L"alpha");

    auto entries = hist.getEntries();
    EXPECT_EQ(entries.size(), 2);
    EXPECT_EQ(entries[0].text, L"alpha");
    std::filesystem::remove_all(dir);
}

TEST(ClipboardHistoryTest, CapsAtMaxEntries) {
    auto dir = std::filesystem::temp_directory_path() / "clip-test3";
    std::filesystem::create_directories(dir);
    VTerminal::ClipboardHistory hist(dir, 3);

    hist.add(L"a");
    hist.add(L"b");
    hist.add(L"c");
    hist.add(L"d");

    EXPECT_EQ(hist.getEntries().size(), 3);
    std::filesystem::remove_all(dir);
}
