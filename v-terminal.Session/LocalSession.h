#pragma once
#include "ISession.h"
#include "ConPtyProcess.h"
#include <string>
#include <optional>

namespace VTerminal {

class LocalSession : public ISession {
public:
    explicit LocalSession(const std::optional<std::wstring>& cwd = std::nullopt);
    ~LocalSession() override;

    bool start(short cols, short rows) override;
    void write(const std::string& data) override;
    bool resize(short cols, short rows) override;
    void kill() override;

private:
    ConPtyProcess m_process;
    std::wstring m_cwd;
};

} // namespace VTerminal
