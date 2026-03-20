#pragma once
#include "ISession.h"
#include "ConPtyProcess.h"
#include <string>

namespace VTerminal {

class WslSession : public ISession {
public:
    explicit WslSession(const std::wstring& distroName = L"");
    ~WslSession() override;

    bool start(short cols, short rows) override;
    void write(const std::string& data) override;
    bool resize(short cols, short rows) override;
    void kill() override;

private:
    ConPtyProcess m_process;
    std::wstring m_distroName;
};

} // namespace VTerminal
