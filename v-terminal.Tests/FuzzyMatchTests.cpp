#include <gtest/gtest.h>
#include "FuzzyMatch.h"

TEST(FuzzyMatchTest, ExactMatch) {
    auto score = VTerminal::fuzzyMatch(L"settings", L"settings");
    EXPECT_GT(score, 0);
}

TEST(FuzzyMatchTest, SubsequenceMatch) {
    auto score = VTerminal::fuzzyMatch(L"nwtab", L"New Tab");
    EXPECT_GT(score, 0);
}

TEST(FuzzyMatchTest, NoMatch) {
    auto score = VTerminal::fuzzyMatch(L"xyz", L"New Tab");
    EXPECT_EQ(score, 0);
}

TEST(FuzzyMatchTest, CaseInsensitive) {
    auto s1 = VTerminal::fuzzyMatch(L"SET", L"Settings");
    auto s2 = VTerminal::fuzzyMatch(L"set", L"Settings");
    EXPECT_EQ(s1, s2);
}
