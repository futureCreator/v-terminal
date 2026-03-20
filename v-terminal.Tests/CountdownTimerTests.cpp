#include <gtest/gtest.h>
#include "CountdownTimer.h"

TEST(CountdownTimerTest, CountsDown) {
    VTerminal::CountdownTimer timer(L"Test", 10000);
    timer.start();
    timer.tick(5000);
    EXPECT_EQ(timer.remainingMs(), 5000);
}

TEST(CountdownTimerTest, FinishesAtZero) {
    VTerminal::CountdownTimer timer(L"Test", 5000);
    bool finished = false;
    timer.onFinish([&]() { finished = true; });
    timer.start();
    timer.tick(5000);
    EXPECT_TRUE(finished);
}
