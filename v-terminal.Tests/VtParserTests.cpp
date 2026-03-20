#include <gtest/gtest.h>
#include "VtParser.h"

TEST(VtParserTest, PlainTextUpdatesBuffer) {
    VTerminal::TerminalBuffer buf(80, 24, 1000);
    VTerminal::VtParser parser(buf);
    parser.feed("Hello");
    EXPECT_EQ(buf.getCell(0, 0).character, L'H');
    EXPECT_EQ(buf.getCell(0, 4).character, L'o');
}

TEST(VtParserTest, NewlineMovesToNextRow) {
    VTerminal::TerminalBuffer buf(80, 24, 1000);
    VTerminal::VtParser parser(buf);
    parser.feed("A\r\nB");
    EXPECT_EQ(buf.getCell(0, 0).character, L'A');
    EXPECT_EQ(buf.getCell(1, 0).character, L'B');
}

TEST(VtParserTest, SgrColorSequence) {
    VTerminal::TerminalBuffer buf(80, 24, 1000);
    VTerminal::VtParser parser(buf);
    // ESC[31m = red foreground
    parser.feed("\x1b[31mR");
    auto cell = buf.getCell(0, 0);
    EXPECT_EQ(cell.character, L'R');
    EXPECT_EQ(cell.fgColor, 1u);
}

TEST(VtParserTest, CursorMovement) {
    VTerminal::TerminalBuffer buf(80, 24, 1000);
    VTerminal::VtParser parser(buf);
    // ESC[3;5H = move cursor to row 3, col 5 (1-based)
    parser.feed("\x1b[3;5HX");
    EXPECT_EQ(buf.getCell(2, 4).character, L'X');
}
