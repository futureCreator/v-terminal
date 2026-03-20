#pragma once
#define WIN32_LEAN_AND_MEAN
#include <Windows.h>
#include <string>
#include <vector>
#include <functional>
#include <thread>
#include <atomic>

namespace VTerminal {

class ConPtyProcess {
public:
    ConPtyProcess();
    ~ConPtyProcess();

    bool start(const std::wstring& program,
               const std::vector<std::wstring>& args,
               const std::wstring& cwd,
               short cols, short rows);
    void write(const std::string& data);
    bool resize(short cols, short rows);
    void kill();

    void onData(std::function<void(const std::string&)> callback);
    void onExit(std::function<void(int exitCode)> callback);

private:
    void readLoop();

    HPCON m_hPC = nullptr;
    // Pair 1: App writes -> PTY reads (PTY input)
    HANDLE m_ptyInputRead = INVALID_HANDLE_VALUE;
    HANDLE m_ptyInputWrite = INVALID_HANDLE_VALUE;
    // Pair 2: PTY writes -> App reads (PTY output)
    HANDLE m_ptyOutputRead = INVALID_HANDLE_VALUE;
    HANDLE m_ptyOutputWrite = INVALID_HANDLE_VALUE;
    HANDLE m_processHandle = INVALID_HANDLE_VALUE;
    std::thread m_readThread;
    std::atomic<bool> m_running{false};

    std::function<void(const std::string&)> m_onData;
    std::function<void(int)> m_onExit;
};

} // namespace VTerminal
