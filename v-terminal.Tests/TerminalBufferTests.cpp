#include <gtest/gtest.h>
#include "TerminalBuffer.h"

TEST(TerminalBufferTest, InitializesWithCorrectDimensions) {
    VTerminal::TerminalBuffer buf(80, 24, 1000);
    EXPECT_EQ(buf.cols(), 80);
    EXPECT_EQ(buf.rows(), 24);
}

TEST(TerminalBufferTest, WriteCharacterAtCursor) {
    VTerminal::TerminalBuffer buf(80, 24, 1000);
    buf.writeChar(0, 0, L'A', {});
    auto cell = buf.getCell(0, 0);
    EXPECT_EQ(cell.character, L'A');
}

TEST(TerminalBufferTest, ScrollbackPushesLinesUp) {
    VTerminal::TerminalBuffer buf(80, 3, 100);
    for (int row = 0; row < 3; ++row)
        buf.writeChar(row, 0, L'0' + row, {});
    buf.scrollUp(1);
    EXPECT_EQ(buf.scrollbackSize(), 1);
}

TEST(TerminalBufferTest, ResizePreservesContent) {
    VTerminal::TerminalBuffer buf(80, 24, 1000);
    buf.writeChar(0, 0, L'X', {});
    buf.resize(120, 40);
    EXPECT_EQ(buf.cols(), 120);
    EXPECT_EQ(buf.rows(), 40);
    EXPECT_EQ(buf.getCell(0, 0).character, L'X');
}

TEST(TerminalBufferTest, DirtyRegionTracking) {
    VTerminal::TerminalBuffer buf(80, 24, 1000);
    buf.writeChar(5, 10, L'Z', {});
    auto dirty = buf.getDirtyRows();
    EXPECT_TRUE(dirty.count(5) > 0);
    buf.clearDirty();
    EXPECT_TRUE(buf.getDirtyRows().empty());
}
