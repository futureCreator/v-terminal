#include "PomodoroTimer.h"

namespace VTerminal {

PomodoroTimer::PomodoroTimer()
    : m_remainingMs(m_config.focusMinutes * 60 * 1000)
{
}

void PomodoroTimer::setConfig(const PomodoroConfig& config) {
    m_config = config;
    reset();
}

PomodoroConfig PomodoroTimer::config() const {
    return m_config;
}

void PomodoroTimer::start() {
    m_running = true;
}

void PomodoroTimer::pause() {
    m_running = false;
}

void PomodoroTimer::reset() {
    m_running = false;
    m_phase = PomodoroPhase::Focus;
    m_remainingMs = m_config.focusMinutes * 60 * 1000;
    m_sessionCount = 0;
}

void PomodoroTimer::tick(int elapsedMs) {
    if (!m_running) return;

    m_remainingMs -= elapsedMs;
    if (m_remainingMs > 0) return;

    // Phase completed - advance to next phase
    if (m_phase == PomodoroPhase::Focus) {
        m_sessionCount++;
        if (m_sessionCount >= m_config.sessionsBeforeLongBreak) {
            m_phase = PomodoroPhase::LongBreak;
            m_remainingMs = m_config.longBreakMinutes * 60 * 1000;
            m_sessionCount = 0;
        } else {
            m_phase = PomodoroPhase::Break;
            m_remainingMs = m_config.breakMinutes * 60 * 1000;
        }
    } else {
        // Break or LongBreak completed - back to Focus
        m_phase = PomodoroPhase::Focus;
        m_remainingMs = m_config.focusMinutes * 60 * 1000;
    }

    if (m_onPhaseChange) {
        m_onPhaseChange(m_phase);
    }
}

PomodoroPhase PomodoroTimer::phase() const {
    return m_phase;
}

bool PomodoroTimer::isRunning() const {
    return m_running;
}

int PomodoroTimer::remainingMs() const {
    return m_remainingMs;
}

void PomodoroTimer::onPhaseChange(std::function<void(PomodoroPhase)> cb) {
    m_onPhaseChange = std::move(cb);
}

} // namespace VTerminal
