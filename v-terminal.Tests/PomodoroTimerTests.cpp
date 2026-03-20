#include <gtest/gtest.h>
#include "PomodoroTimer.h"

TEST(PomodoroTimerTest, StartsInFocusPhase) {
    VTerminal::PomodoroTimer timer;
    EXPECT_EQ(timer.phase(), VTerminal::PomodoroPhase::Focus);
    EXPECT_FALSE(timer.isRunning());
}

TEST(PomodoroTimerTest, TransitionsToBreakAfterFocus) {
    VTerminal::PomodoroTimer timer;
    VTerminal::PomodoroConfig cfg;
    cfg.focusMinutes = 1;
    timer.setConfig(cfg);
    timer.start();
    timer.tick(60000); // 60 seconds
    EXPECT_EQ(timer.phase(), VTerminal::PomodoroPhase::Break);
}

TEST(PomodoroTimerTest, Reset) {
    VTerminal::PomodoroTimer timer;
    timer.start();
    timer.tick(5000);
    timer.reset();
    EXPECT_EQ(timer.remainingMs(), timer.config().focusMinutes * 60 * 1000);
    EXPECT_FALSE(timer.isRunning());
}
