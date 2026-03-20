#pragma once
#include <functional>

namespace VTerminal {

enum class PomodoroPhase { Focus, Break, LongBreak };

struct PomodoroConfig {
    int focusMinutes = 25;
    int breakMinutes = 5;
    int longBreakMinutes = 15;
    int sessionsBeforeLongBreak = 4;
};

class PomodoroTimer {
public:
    PomodoroTimer();

    void setConfig(const PomodoroConfig& config);
    PomodoroConfig config() const;

    void start();
    void pause();
    void reset();
    void tick(int elapsedMs);

    PomodoroPhase phase() const;
    bool isRunning() const;
    int remainingMs() const;

    void onPhaseChange(std::function<void(PomodoroPhase)> cb);

private:
    PomodoroConfig m_config;
    PomodoroPhase m_phase = PomodoroPhase::Focus;
    bool m_running = false;
    int m_remainingMs;
    int m_sessionCount = 0;
    std::function<void(PomodoroPhase)> m_onPhaseChange;
};

} // namespace VTerminal
