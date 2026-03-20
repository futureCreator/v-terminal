#include "WslHelper.h"
#define WIN32_LEAN_AND_MEAN
#include <Windows.h>
#include <sstream>

namespace VTerminal {

std::vector<std::wstring> WslHelper::getDistros() {
    std::vector<std::wstring> distros;

    // Run "wsl --list --quiet" and capture output
    HANDLE hReadPipe, hWritePipe;
    SECURITY_ATTRIBUTES sa = { sizeof(sa), nullptr, TRUE };
    if (!CreatePipe(&hReadPipe, &hWritePipe, &sa, 0)) return distros;

    STARTUPINFOW si = {};
    si.cb = sizeof(si);
    si.hStdOutput = hWritePipe;
    si.hStdError = hWritePipe;
    si.dwFlags = STARTF_USESTDHANDLES;

    PROCESS_INFORMATION pi = {};
    wchar_t cmd[] = L"wsl.exe --list --quiet";
    if (!CreateProcessW(nullptr, cmd, nullptr, nullptr, TRUE, CREATE_NO_WINDOW,
                        nullptr, nullptr, &si, &pi)) {
        CloseHandle(hReadPipe);
        CloseHandle(hWritePipe);
        return distros;
    }

    CloseHandle(hWritePipe);
    WaitForSingleObject(pi.hProcess, 5000);

    // Read output (UTF-16 LE from wsl.exe)
    char buf[4096];
    DWORD bytesRead = 0;
    std::string raw;
    while (ReadFile(hReadPipe, buf, sizeof(buf), &bytesRead, nullptr) && bytesRead > 0) {
        raw.append(buf, bytesRead);
    }
    CloseHandle(hReadPipe);
    CloseHandle(pi.hProcess);
    CloseHandle(pi.hThread);

    // wsl --list outputs UTF-16 LE
    if (raw.size() >= 2) {
        const wchar_t* wstr = reinterpret_cast<const wchar_t*>(raw.data());
        size_t wlen = raw.size() / sizeof(wchar_t);
        // Skip BOM if present
        if (wlen > 0 && wstr[0] == 0xFEFF) { wstr++; wlen--; }

        std::wstring line;
        for (size_t i = 0; i < wlen; ++i) {
            if (wstr[i] == L'\n' || wstr[i] == L'\r') {
                if (!line.empty()) {
                    // Remove null chars that wsl.exe sometimes inserts
                    std::wstring clean;
                    for (wchar_t c : line) {
                        if (c != L'\0') clean += c;
                    }
                    if (!clean.empty()) distros.push_back(clean);
                    line.clear();
                }
            } else if (wstr[i] != L'\0') {
                line += wstr[i];
            }
        }
        if (!line.empty()) {
            std::wstring clean;
            for (wchar_t c : line) {
                if (c != L'\0') clean += c;
            }
            if (!clean.empty()) distros.push_back(clean);
        }
    }

    return distros;
}

} // namespace VTerminal
