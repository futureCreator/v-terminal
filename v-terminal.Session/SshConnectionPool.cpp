#include "SshConnectionPool.h"
#include <WS2tcpip.h>

#pragma comment(lib, "ws2_32.lib")

namespace VTerminal {

SshConnectionPool::~SshConnectionPool() {
    std::lock_guard lock(m_mutex);
    for (auto& [key, conn] : m_pool) {
        disconnect(*conn);
    }
    m_pool.clear();
}

SshConnection* SshConnectionPool::acquire(const SshConnectionKey& key,
                                           const std::string& password,
                                           const std::string& identityFile) {
    std::lock_guard lock(m_mutex);

    auto it = m_pool.find(key);
    if (it != m_pool.end()) {
        it->second->channelCount++;
        return it->second.get();
    }

    auto conn = std::make_unique<SshConnection>();
    if (!connect(*conn, key, password, identityFile)) {
        return nullptr;
    }
    conn->channelCount = 1;
    auto* ptr = conn.get();
    m_pool[key] = std::move(conn);
    return ptr;
}

void SshConnectionPool::release(const SshConnectionKey& key) {
    std::lock_guard lock(m_mutex);
    auto it = m_pool.find(key);
    if (it == m_pool.end()) return;

    it->second->channelCount--;
    if (it->second->channelCount <= 0) {
        disconnect(*it->second);
        m_pool.erase(it);
    }
}

bool SshConnectionPool::connect(SshConnection& conn, const SshConnectionKey& key,
                                 const std::string& password, const std::string& identityFile) {
    // Initialize WinSock
    WSADATA wsaData;
    WSAStartup(MAKEWORD(2, 2), &wsaData);

    // Resolve host
    struct addrinfo hints = {}, *result = nullptr;
    hints.ai_family = AF_INET;
    hints.ai_socktype = SOCK_STREAM;
    std::string portStr = std::to_string(key.port);
    if (getaddrinfo(key.host.c_str(), portStr.c_str(), &hints, &result) != 0) {
        return false;
    }

    conn.socket = socket(result->ai_family, result->ai_socktype, result->ai_protocol);
    if (conn.socket == INVALID_SOCKET) {
        freeaddrinfo(result);
        return false;
    }

    if (::connect(conn.socket, result->ai_addr, static_cast<int>(result->ai_addrlen)) != 0) {
        closesocket(conn.socket);
        conn.socket = INVALID_SOCKET;
        freeaddrinfo(result);
        return false;
    }
    freeaddrinfo(result);

    // Initialize libssh2 session
    conn.session = libssh2_session_init();
    if (!conn.session) {
        closesocket(conn.socket);
        conn.socket = INVALID_SOCKET;
        return false;
    }

    if (libssh2_session_handshake(conn.session, static_cast<libssh2_socket_t>(conn.socket)) != 0) {
        libssh2_session_free(conn.session);
        conn.session = nullptr;
        closesocket(conn.socket);
        conn.socket = INVALID_SOCKET;
        return false;
    }

    // Authenticate
    int rc = -1;
    if (!identityFile.empty()) {
        rc = libssh2_userauth_publickey_fromfile(conn.session, key.username.c_str(),
            nullptr, identityFile.c_str(), password.c_str());
    }
    if (rc != 0 && !password.empty()) {
        rc = libssh2_userauth_password(conn.session, key.username.c_str(), password.c_str());
    }
    if (rc != 0) {
        libssh2_session_disconnect(conn.session, "Auth failed");
        libssh2_session_free(conn.session);
        conn.session = nullptr;
        closesocket(conn.socket);
        conn.socket = INVALID_SOCKET;
        return false;
    }

    return true;
}

void SshConnectionPool::disconnect(SshConnection& conn) {
    if (conn.session) {
        libssh2_session_disconnect(conn.session, "Bye");
        libssh2_session_free(conn.session);
        conn.session = nullptr;
    }
    if (conn.socket != INVALID_SOCKET) {
        closesocket(conn.socket);
        conn.socket = INVALID_SOCKET;
    }
}

} // namespace VTerminal
