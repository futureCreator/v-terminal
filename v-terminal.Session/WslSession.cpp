#include "WslSession.h"

namespace VTerminal {

WslSession::WslSession(const std::wstring& distroName)
    : m_distroName(distroName) {}

WslSession::~WslSession() {
    kill();
}

bool WslSession::start(short cols, short rows) {
    m_process.onData([this](const std::string& data) {
        if (m_onData) m_onData(data);
    });
    m_process.onExit([this](int exitCode) {
        if (m_onExit) m_onExit(exitCode);
    });

    std::vector<std::wstring> args;
    if (!m_distroName.empty()) {
        args.push_back(L"-d");
        args.push_back(m_distroName);
    }
    args.push_back(L"--cd");
    args.push_back(L"~");

    return m_process.start(L"wsl.exe", args, L".", cols, rows);
}

void WslSession::write(const std::string& data) {
    m_process.write(data);
}

bool WslSession::resize(short cols, short rows) {
    return m_process.resize(cols, rows);
}

void WslSession::kill() {
    m_process.kill();
}

} // namespace VTerminal
