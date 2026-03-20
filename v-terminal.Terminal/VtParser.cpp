#include "VtParser.h"
#include <algorithm>
#include <sstream>

namespace VTerminal {

VtParser::VtParser(TerminalBuffer& buffer)
    : m_buffer(buffer) {}

void VtParser::feed(const std::string& data) {
    for (char c : data) {
        switch (m_state) {
        case State::Normal:
            if (c == '\x1b') {
                m_state = State::Escape;
            } else {
                handleChar(c);
            }
            break;

        case State::Escape:
            if (c == '[') {
                m_state = State::Csi;
                m_csiBuffer.clear();
            } else if (c == ']') {
                m_state = State::OscString;
                m_csiBuffer.clear();
            } else {
                // Unknown escape, return to normal
                m_state = State::Normal;
            }
            break;

        case State::Csi:
            if ((c >= '0' && c <= '9') || c == ';' || c == '?') {
                m_csiBuffer += c;
            } else {
                // c is the final character
                m_csiBuffer += c;
                handleCsiSequence();
                m_state = State::Normal;
            }
            break;

        case State::OscString:
            if (c == '\x07' || c == '\x1b') {
                // BEL or ESC terminates OSC
                m_state = State::Normal;
            }
            // Ignore OSC content for now
            break;
        }
    }
}

void VtParser::handleChar(char c) {
    if (c == '\r') {
        m_cursorCol = 0;
        return;
    }
    if (c == '\n') {
        newline();
        return;
    }
    if (c == '\b') {
        if (m_cursorCol > 0) m_cursorCol--;
        return;
    }
    if (c == '\t') {
        m_cursorCol = (m_cursorCol + 8) & ~7;
        if (m_cursorCol >= m_buffer.cols()) m_cursorCol = m_buffer.cols() - 1;
        return;
    }
    if (c < 32) return; // ignore other control chars

    CellAttributes attrs;
    attrs.fgColor = m_currentFg;
    attrs.bgColor = m_currentBg;
    attrs.attributes = m_currentAttrs;
    m_buffer.writeChar(m_cursorRow, m_cursorCol, static_cast<wchar_t>(c), attrs);
    advanceCursor();
}

void VtParser::advanceCursor() {
    m_cursorCol++;
    if (m_cursorCol >= m_buffer.cols()) {
        m_cursorCol = 0;
        newline();
    }
}

void VtParser::newline() {
    m_cursorRow++;
    if (m_cursorRow >= m_buffer.rows()) {
        m_buffer.scrollUp(1);
        m_cursorRow = m_buffer.rows() - 1;
    }
}

std::vector<int> VtParser::parseCsiParams() const {
    std::vector<int> params;
    // m_csiBuffer contains params + final char; strip final char
    std::string paramStr = m_csiBuffer.substr(0, m_csiBuffer.size() - 1);
    // Strip leading '?' if present
    if (!paramStr.empty() && paramStr[0] == '?') {
        paramStr = paramStr.substr(1);
    }
    std::istringstream ss(paramStr);
    std::string token;
    while (std::getline(ss, token, ';')) {
        if (token.empty()) {
            params.push_back(0);
        } else {
            params.push_back(std::stoi(token));
        }
    }
    return params;
}

void VtParser::handleCsiSequence() {
    if (m_csiBuffer.empty()) return;
    char cmd = m_csiBuffer.back();
    auto params = parseCsiParams();

    switch (cmd) {
    case 'H': // CUP - Cursor Position
    case 'f': {
        int row = (params.size() > 0 && params[0] > 0) ? params[0] - 1 : 0;
        int col = (params.size() > 1 && params[1] > 0) ? params[1] - 1 : 0;
        m_cursorRow = std::clamp(row, 0, m_buffer.rows() - 1);
        m_cursorCol = std::clamp(col, 0, m_buffer.cols() - 1);
        break;
    }
    case 'A': { // CUU - Cursor Up
        int n = (params.size() > 0 && params[0] > 0) ? params[0] : 1;
        m_cursorRow = std::max(0, m_cursorRow - n);
        break;
    }
    case 'B': { // CUD - Cursor Down
        int n = (params.size() > 0 && params[0] > 0) ? params[0] : 1;
        m_cursorRow = std::min(m_buffer.rows() - 1, m_cursorRow + n);
        break;
    }
    case 'C': { // CUF - Cursor Forward
        int n = (params.size() > 0 && params[0] > 0) ? params[0] : 1;
        m_cursorCol = std::min(m_buffer.cols() - 1, m_cursorCol + n);
        break;
    }
    case 'D': { // CUB - Cursor Back
        int n = (params.size() > 0 && params[0] > 0) ? params[0] : 1;
        m_cursorCol = std::max(0, m_cursorCol - n);
        break;
    }
    case 'J': { // ED - Erase Display
        int n = params.empty() ? 0 : params[0];
        CellAttributes attrs{m_currentFg, m_currentBg, m_currentAttrs};
        if (n == 0) {
            // Clear from cursor to end
            for (int c = m_cursorCol; c < m_buffer.cols(); ++c)
                m_buffer.writeChar(m_cursorRow, c, L' ', attrs);
            for (int r = m_cursorRow + 1; r < m_buffer.rows(); ++r)
                for (int c = 0; c < m_buffer.cols(); ++c)
                    m_buffer.writeChar(r, c, L' ', attrs);
        } else if (n == 2) {
            // Clear entire screen
            for (int r = 0; r < m_buffer.rows(); ++r)
                for (int c = 0; c < m_buffer.cols(); ++c)
                    m_buffer.writeChar(r, c, L' ', attrs);
        }
        break;
    }
    case 'K': { // EL - Erase Line
        int n = params.empty() ? 0 : params[0];
        CellAttributes attrs{m_currentFg, m_currentBg, m_currentAttrs};
        if (n == 0) {
            for (int c = m_cursorCol; c < m_buffer.cols(); ++c)
                m_buffer.writeChar(m_cursorRow, c, L' ', attrs);
        } else if (n == 1) {
            for (int c = 0; c <= m_cursorCol; ++c)
                m_buffer.writeChar(m_cursorRow, c, L' ', attrs);
        } else if (n == 2) {
            for (int c = 0; c < m_buffer.cols(); ++c)
                m_buffer.writeChar(m_cursorRow, c, L' ', attrs);
        }
        break;
    }
    case 'm': // SGR - Select Graphic Rendition
        handleSgr(params);
        break;
    case 'h': // DECSET (private mode set) - ignore for now
    case 'l': // DECRST (private mode reset) - ignore for now
        break;
    default:
        break;
    }
}

void VtParser::handleSgr(const std::vector<int>& params) {
    if (params.empty()) {
        // Reset
        m_currentFg = 7;
        m_currentBg = 0;
        m_currentAttrs = 0;
        return;
    }
    for (size_t i = 0; i < params.size(); ++i) {
        int p = params[i];
        if (p == 0) {
            m_currentFg = 7;
            m_currentBg = 0;
            m_currentAttrs = 0;
        } else if (p == 1) {
            m_currentAttrs |= 1; // bold
        } else if (p == 3) {
            m_currentAttrs |= 2; // italic
        } else if (p == 4) {
            m_currentAttrs |= 4; // underline
        } else if (p == 22) {
            m_currentAttrs &= ~1; // not bold
        } else if (p == 23) {
            m_currentAttrs &= ~2; // not italic
        } else if (p == 24) {
            m_currentAttrs &= ~4; // not underline
        } else if (p >= 30 && p <= 37) {
            m_currentFg = static_cast<uint32_t>(p - 30);
        } else if (p == 39) {
            m_currentFg = 7; // default fg
        } else if (p >= 40 && p <= 47) {
            m_currentBg = static_cast<uint32_t>(p - 40);
        } else if (p == 49) {
            m_currentBg = 0; // default bg
        } else if (p >= 90 && p <= 97) {
            m_currentFg = static_cast<uint32_t>(p - 90 + 8); // bright fg
        } else if (p >= 100 && p <= 107) {
            m_currentBg = static_cast<uint32_t>(p - 100 + 8); // bright bg
        }
    }
}

} // namespace VTerminal
