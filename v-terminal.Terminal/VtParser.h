#pragma once
#include "TerminalBuffer.h"
#include <string>
#include <vector>

namespace VTerminal {

class VtParser {
public:
    explicit VtParser(TerminalBuffer& buffer);
    void feed(const std::string& data);

private:
    void handleChar(char c);
    void handleCsiSequence();
    void handleSgr(const std::vector<int>& params);
    void advanceCursor();
    void newline();
    std::vector<int> parseCsiParams() const;

    TerminalBuffer& m_buffer;
    int m_cursorRow = 0;
    int m_cursorCol = 0;
    uint32_t m_currentFg = 7;  // default white
    uint32_t m_currentBg = 0;  // default black
    uint8_t m_currentAttrs = 0;

    enum class State { Normal, Escape, Csi, OscString };
    State m_state = State::Normal;
    std::string m_csiBuffer;
};

} // namespace VTerminal
