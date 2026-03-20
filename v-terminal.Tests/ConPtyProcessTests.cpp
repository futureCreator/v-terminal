#include <gtest/gtest.h>
#include "ConPtyProcess.h"
#include <thread>
#include <chrono>
#include <mutex>

TEST(ConPtyProcessTest, SpawnAndReceiveOutput) {
    VTerminal::ConPtyProcess proc;
    std::string output;
    std::mutex mtx;

    proc.onData([&](const std::string& data) {
        std::lock_guard<std::mutex> lock(mtx);
        output += data;
    });

    bool started = proc.start(L"cmd.exe", {}, L".", 80, 24);
    ASSERT_TRUE(started);

    // Wait for ConPTY initialization sequences
    std::this_thread::sleep_for(std::chrono::milliseconds(1000));

    {
        std::lock_guard<std::mutex> lock(mtx);
        // ConPTY should send at least VT initialization sequences
        EXPECT_GT(output.size(), 0u)
            << "Expected ConPTY to produce VT output";
    }

    // Verify write doesn't crash
    proc.write("echo hello\r\n");
    std::this_thread::sleep_for(std::chrono::milliseconds(500));

    proc.kill();
}

TEST(ConPtyProcessTest, Resize) {
    VTerminal::ConPtyProcess proc;
    bool started = proc.start(L"cmd.exe", {}, L".", 80, 24);
    ASSERT_TRUE(started);

    bool resized = proc.resize(120, 40);
    EXPECT_TRUE(resized);

    proc.kill();
}

TEST(ConPtyProcessTest, OnExitCallback) {
    VTerminal::ConPtyProcess proc;
    bool exitCalled = false;

    proc.onExit([&](int) {
        exitCalled = true;
    });

    bool started = proc.start(L"cmd.exe", {}, L".", 80, 24);
    ASSERT_TRUE(started);

    proc.kill();
    EXPECT_TRUE(exitCalled);
}
