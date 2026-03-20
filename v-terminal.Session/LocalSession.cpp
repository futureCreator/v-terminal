#include "LocalSession.h"
#define WIN32_LEAN_AND_MEAN
#include <Windows.h>
#include <Shlobj.h>

namespace VTerminal {

LocalSession::LocalSession(const std::optional<std::wstring>& cwd) {
    if (cwd.has_value()) {
        m_cwd = cwd.value();
    } else {
        // Default to user's home directory
        wchar_t* userProfile = nullptr;
        if (SUCCEEDED(SHGetKnownFolderPath(FOLDERID_Profile, 0, nullptr, &userProfile))) {
            m_cwd = userProfile;
            CoTaskMemFree(userProfile);
        } else {
            m_cwd = L".";
        }
    }
}

LocalSession::~LocalSession() {
    kill();
}

bool LocalSession::start(short cols, short rows) {
    m_process.onData([this](const std::string& data) {
        if (m_onData) m_onData(data);
    });
    m_process.onExit([this](int exitCode) {
        if (m_onExit) m_onExit(exitCode);
    });

    // Detect default shell: prefer PowerShell, fallback to cmd.exe
    std::wstring shell = L"cmd.exe";
    wchar_t pwshPath[MAX_PATH];
    if (SearchPathW(nullptr, L"pwsh.exe", nullptr, MAX_PATH, pwshPath, nullptr)) {
        shell = pwshPath;
    } else if (SearchPathW(nullptr, L"powershell.exe", nullptr, MAX_PATH, pwshPath, nullptr)) {
        shell = pwshPath;
    }

    return m_process.start(shell, {}, m_cwd, cols, rows);
}

void LocalSession::write(const std::string& data) {
    m_process.write(data);
}

bool LocalSession::resize(short cols, short rows) {
    return m_process.resize(cols, rows);
}

void LocalSession::kill() {
    m_process.kill();
}

} // namespace VTerminal
