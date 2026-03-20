#pragma once
#include "ISession.h"
#include "SshConnectionPool.h"
#include <thread>
#include <atomic>

namespace VTerminal {

class SshSession : public ISession {
public:
    SshSession(SshConnectionPool& pool, const SshConnectionKey& key,
               const std::string& password = "", const std::string& identityFile = "");
    ~SshSession() override;

    bool start(short cols, short rows) override;
    void write(const std::string& data) override;
    bool resize(short cols, short rows) override;
    void kill() override;

private:
    void readLoop();

    SshConnectionPool& m_pool;
    SshConnectionKey m_key;
    std::string m_password;
    std::string m_identityFile;
    SshConnection* m_conn = nullptr;
    LIBSSH2_CHANNEL* m_channel = nullptr;
    std::thread m_readThread;
    std::atomic<bool> m_running{false};
};

} // namespace VTerminal
