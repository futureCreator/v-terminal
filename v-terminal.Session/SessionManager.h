#pragma once
#include "ISession.h"
#include "Types.h"
#include <map>
#include <memory>
#include <string>
#include <optional>

namespace VTerminal {

class SessionManager {
public:
    SessionId createSession(SessionType type, const PanelConnection& connection);
    void killSession(const SessionId& id);
    bool hasSession(const SessionId& id) const;
    ISession* getSession(const SessionId& id);

private:
    static SessionId generateId();
    std::map<SessionId, std::unique_ptr<ISession>> m_sessions;
};

} // namespace VTerminal
