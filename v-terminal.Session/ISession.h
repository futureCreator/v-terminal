#pragma once
#include "Types.h"
#include <functional>
#include <string>

namespace VTerminal {

class ISession {
public:
    virtual ~ISession() = default;
    virtual bool start(short cols, short rows) = 0;
    virtual void write(const std::string& data) = 0;
    virtual bool resize(short cols, short rows) = 0;
    virtual void kill() = 0;

    void onData(std::function<void(const std::string&)> cb) { m_onData = std::move(cb); }
    void onExit(std::function<void(int)> cb) { m_onExit = std::move(cb); }

protected:
    std::function<void(const std::string&)> m_onData;
    std::function<void(int)> m_onExit;
};

} // namespace VTerminal
