#pragma once
#include <libssh2.h>
#include <WinSock2.h>
#include <string>
#include <unordered_map>
#include <mutex>
#include <memory>
#include <thread>

namespace VTerminal {

struct SshConnectionKey {
    std::string host;
    int port;
    std::string username;
    bool operator==(const SshConnectionKey&) const = default;
};

struct SshConnectionKeyHash {
    size_t operator()(const SshConnectionKey& k) const {
        size_t h = std::hash<std::string>{}(k.host);
        h ^= std::hash<int>{}(k.port) << 1;
        h ^= std::hash<std::string>{}(k.username) << 2;
        return h;
    }
};

struct SshConnection {
    LIBSSH2_SESSION* session = nullptr;
    SOCKET socket = INVALID_SOCKET;
    int channelCount = 0;
};

class SshConnectionPool {
public:
    ~SshConnectionPool();
    SshConnection* acquire(const SshConnectionKey& key,
                           const std::string& password = "",
                           const std::string& identityFile = "");
    void release(const SshConnectionKey& key);

private:
    bool connect(SshConnection& conn, const SshConnectionKey& key,
                 const std::string& password, const std::string& identityFile);
    void disconnect(SshConnection& conn);

    std::unordered_map<SshConnectionKey, std::unique_ptr<SshConnection>, SshConnectionKeyHash> m_pool;
    std::mutex m_mutex;
};

} // namespace VTerminal
