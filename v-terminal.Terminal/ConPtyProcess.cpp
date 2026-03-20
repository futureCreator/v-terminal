#include "ConPtyProcess.h"

namespace VTerminal {

ConPtyProcess::ConPtyProcess() = default;

ConPtyProcess::~ConPtyProcess() {
    kill();
}

bool ConPtyProcess::start(const std::wstring& program,
                          const std::vector<std::wstring>& args,
                          const std::wstring& cwd,
                          short cols, short rows) {
    // Create pipes for PTY input
    if (!CreatePipe(&m_ptyInputRead, &m_ptyInputWrite, nullptr, 0)) {
        return false;
    }
    // Create pipes for PTY output
    if (!CreatePipe(&m_ptyOutputRead, &m_ptyOutputWrite, nullptr, 0)) {
        CloseHandle(m_ptyInputRead);
        CloseHandle(m_ptyInputWrite);
        return false;
    }

    // Create pseudo console
    COORD size{ cols, rows };
    HRESULT hr = CreatePseudoConsole(size, m_ptyInputRead, m_ptyOutputWrite, 0, &m_hPC);
    if (FAILED(hr)) {
        CloseHandle(m_ptyInputRead);
        CloseHandle(m_ptyInputWrite);
        CloseHandle(m_ptyOutputRead);
        CloseHandle(m_ptyOutputWrite);
        return false;
    }

    // PTY owns these ends now
    CloseHandle(m_ptyInputRead);
    m_ptyInputRead = INVALID_HANDLE_VALUE;
    CloseHandle(m_ptyOutputWrite);
    m_ptyOutputWrite = INVALID_HANDLE_VALUE;

    // Prepare STARTUPINFOEX with pseudo console attribute
    SIZE_T attrListSize = 0;
    InitializeProcThreadAttributeList(nullptr, 1, 0, &attrListSize);
    auto attrList = reinterpret_cast<LPPROC_THREAD_ATTRIBUTE_LIST>(HeapAlloc(GetProcessHeap(), 0, attrListSize));
    if (!attrList) {
        ClosePseudoConsole(m_hPC);
        m_hPC = nullptr;
        return false;
    }
    if (!InitializeProcThreadAttributeList(attrList, 1, 0, &attrListSize)) {
        HeapFree(GetProcessHeap(), 0, attrList);
        ClosePseudoConsole(m_hPC);
        m_hPC = nullptr;
        return false;
    }
    if (!UpdateProcThreadAttribute(attrList, 0, PROC_THREAD_ATTRIBUTE_PSEUDOCONSOLE, m_hPC, sizeof(HPCON), nullptr, nullptr)) {
        DeleteProcThreadAttributeList(attrList);
        HeapFree(GetProcessHeap(), 0, attrList);
        ClosePseudoConsole(m_hPC);
        m_hPC = nullptr;
        return false;
    }

    STARTUPINFOEXW si{};
    si.StartupInfo.cb = sizeof(STARTUPINFOEXW);
    si.lpAttributeList = attrList;

    // Build command line
    std::wstring cmdLine = program;
    for (const auto& arg : args) {
        cmdLine += L" ";
        cmdLine += arg;
    }

    PROCESS_INFORMATION pi{};
    BOOL success = CreateProcessW(
        nullptr,
        cmdLine.data(),
        nullptr, nullptr,
        FALSE,
        EXTENDED_STARTUPINFO_PRESENT,
        nullptr,
        cwd.empty() ? nullptr : cwd.c_str(),
        &si.StartupInfo,
        &pi
    );

    DeleteProcThreadAttributeList(attrList);
    HeapFree(GetProcessHeap(), 0, attrList);

    if (!success) {
        ClosePseudoConsole(m_hPC);
        m_hPC = nullptr;
        return false;
    }

    m_processHandle = pi.hProcess;
    CloseHandle(pi.hThread);

    // Start read loop
    m_running = true;
    m_readThread = std::thread(&ConPtyProcess::readLoop, this);

    return true;
}

void ConPtyProcess::write(const std::string& data) {
    if (m_ptyInputWrite == INVALID_HANDLE_VALUE) return;
    DWORD written = 0;
    WriteFile(m_ptyInputWrite, data.data(), static_cast<DWORD>(data.size()), &written, nullptr);
}

bool ConPtyProcess::resize(short cols, short rows) {
    if (!m_hPC) return false;
    COORD size{ cols, rows };
    return SUCCEEDED(ResizePseudoConsole(m_hPC, size));
}

void ConPtyProcess::kill() {
    m_running = false;

    if (m_hPC) {
        ClosePseudoConsole(m_hPC);
        m_hPC = nullptr;
    }

    if (m_processHandle != INVALID_HANDLE_VALUE) {
        TerminateProcess(m_processHandle, 0);
        CloseHandle(m_processHandle);
        m_processHandle = INVALID_HANDLE_VALUE;
    }

    if (m_ptyInputWrite != INVALID_HANDLE_VALUE) {
        CloseHandle(m_ptyInputWrite);
        m_ptyInputWrite = INVALID_HANDLE_VALUE;
    }

    if (m_ptyOutputRead != INVALID_HANDLE_VALUE) {
        CloseHandle(m_ptyOutputRead);
        m_ptyOutputRead = INVALID_HANDLE_VALUE;
    }

    if (m_readThread.joinable()) {
        m_readThread.join();
    }

    // Fire exit callback
    if (m_onExit) {
        m_onExit(0);
    }
}

void ConPtyProcess::onData(std::function<void(const std::string&)> callback) {
    m_onData = std::move(callback);
}

void ConPtyProcess::onExit(std::function<void(int exitCode)> callback) {
    m_onExit = std::move(callback);
}

void ConPtyProcess::readLoop() {
    constexpr DWORD bufSize = 4096;
    char buf[bufSize];

    while (m_running) {
        DWORD bytesRead = 0;
        BOOL ok = ReadFile(m_ptyOutputRead, buf, bufSize, &bytesRead, nullptr);
        if (!ok || bytesRead == 0) {
            break;
        }
        if (m_onData) {
            m_onData(std::string(buf, bytesRead));
        }
    }
}

} // namespace VTerminal
