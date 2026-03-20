#include "SessionManager.h"
#include "LocalSession.h"
#define WIN32_LEAN_AND_MEAN
#include <Windows.h>
#include <combaseapi.h>

namespace VTerminal {

SessionId SessionManager::createSession(SessionType type, const PanelConnection& connection) {
    std::unique_ptr<ISession> session;

    switch (type) {
    case SessionType::Local:
        session = std::make_unique<LocalSession>(connection.cwd);
        break;
    case SessionType::Wsl:
        // TODO: implement WslSession
        session = std::make_unique<LocalSession>(connection.cwd);
        break;
    case SessionType::Ssh:
        // TODO: implement SshSession
        return {};
    case SessionType::Note:
        // Notes don't need a process session
        return {};
    }

    auto id = generateId();
    m_sessions[id] = std::move(session);
    return id;
}

void SessionManager::killSession(const SessionId& id) {
    auto it = m_sessions.find(id);
    if (it != m_sessions.end()) {
        it->second->kill();
        m_sessions.erase(it);
    }
}

bool SessionManager::hasSession(const SessionId& id) const {
    return m_sessions.count(id) > 0;
}

ISession* SessionManager::getSession(const SessionId& id) {
    auto it = m_sessions.find(id);
    return (it != m_sessions.end()) ? it->second.get() : nullptr;
}

SessionId SessionManager::generateId() {
    GUID guid;
    CoCreateGuid(&guid);
    wchar_t buf[64];
    swprintf_s(buf, L"%08lx-%04x-%04x-%02x%02x-%02x%02x%02x%02x%02x%02x",
        guid.Data1, guid.Data2, guid.Data3,
        guid.Data4[0], guid.Data4[1], guid.Data4[2], guid.Data4[3],
        guid.Data4[4], guid.Data4[5], guid.Data4[6], guid.Data4[7]);
    return buf;
}

} // namespace VTerminal
