#include "CountdownTimer.h"

namespace VTerminal {

CountdownTimer::CountdownTimer(const std::wstring& label, int durationMs)
    : m_label(label)
    , m_durationMs(durationMs)
    , m_remainingMs(durationMs)
{
}

void CountdownTimer::start() {
    m_running = true;
}

void CountdownTimer::tick(int elapsedMs) {
    if (!m_running || m_finished) return;

    m_remainingMs -= elapsedMs;
    if (m_remainingMs <= 0) {
        m_remainingMs = 0;
        m_running = false;
        m_finished = true;
        if (m_onFinish) {
            m_onFinish();
        }
    }
}

int CountdownTimer::remainingMs() const {
    return m_remainingMs;
}

bool CountdownTimer::isFinished() const {
    return m_finished;
}

void CountdownTimer::onFinish(std::function<void()> cb) {
    m_onFinish = std::move(cb);
}

} // namespace VTerminal
