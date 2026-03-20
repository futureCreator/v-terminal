#include "SshSession.h"

namespace VTerminal {

SshSession::SshSession(SshConnectionPool& pool, const SshConnectionKey& key,
                       const std::string& password, const std::string& identityFile)
    : m_pool(pool), m_key(key), m_password(password), m_identityFile(identityFile) {}

SshSession::~SshSession() {
    kill();
}

bool SshSession::start(short cols, short rows) {
    m_conn = m_pool.acquire(m_key, m_password, m_identityFile);
    if (!m_conn || !m_conn->session) return false;

    m_channel = libssh2_channel_open_session(m_conn->session);
    if (!m_channel) return false;

    if (libssh2_channel_request_pty_ex(m_channel, "xterm-256color", 15,
            nullptr, 0, cols, rows, 0, 0) != 0) {
        libssh2_channel_free(m_channel);
        m_channel = nullptr;
        return false;
    }

    if (libssh2_channel_shell(m_channel) != 0) {
        libssh2_channel_free(m_channel);
        m_channel = nullptr;
        return false;
    }

    // Set non-blocking for the read loop
    libssh2_session_set_blocking(m_conn->session, 0);

    m_running = true;
    m_readThread = std::thread(&SshSession::readLoop, this);
    return true;
}

void SshSession::write(const std::string& data) {
    if (!m_channel) return;
    libssh2_session_set_blocking(m_conn->session, 1);
    libssh2_channel_write(m_channel, data.data(), data.size());
    libssh2_session_set_blocking(m_conn->session, 0);
}

bool SshSession::resize(short cols, short rows) {
    if (!m_channel) return false;
    return libssh2_channel_request_pty_size(m_channel, cols, rows) == 0;
}

void SshSession::kill() {
    m_running = false;

    if (m_channel) {
        libssh2_channel_close(m_channel);
        libssh2_channel_free(m_channel);
        m_channel = nullptr;
    }

    if (m_readThread.joinable()) {
        m_readThread.join();
    }

    if (m_conn) {
        m_pool.release(m_key);
        m_conn = nullptr;
    }
}

void SshSession::readLoop() {
    char buf[4096];
    while (m_running) {
        auto rc = libssh2_channel_read(m_channel, buf, sizeof(buf));
        if (rc > 0) {
            if (m_onData) {
                m_onData(std::string(buf, rc));
            }
        } else if (rc == LIBSSH2_ERROR_EAGAIN) {
            Sleep(1);
        } else {
            break; // EOF or error
        }

        if (libssh2_channel_eof(m_channel)) {
            break;
        }
    }

    if (m_onExit) {
        int exitCode = libssh2_channel_get_exit_status(m_channel);
        m_onExit(exitCode);
    }
}

} // namespace VTerminal
