#pragma once
#include <string>
#include <functional>

namespace VTerminal {

class CountdownTimer {
public:
    CountdownTimer(const std::wstring& label, int durationMs);

    void start();
    void tick(int elapsedMs);
    int remainingMs() const;
    bool isFinished() const;

    void onFinish(std::function<void()> cb);

private:
    std::wstring m_label;
    int m_durationMs;
    int m_remainingMs;
    bool m_running = false;
    bool m_finished = false;
    std::function<void()> m_onFinish;
};

} // namespace VTerminal
