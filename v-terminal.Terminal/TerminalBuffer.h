#pragma once
#include <vector>
#include <deque>
#include <set>
#include <cstdint>
#include <shared_mutex>

namespace VTerminal {

struct Cell {
    wchar_t character = L' ';
    uint32_t fgColor = 7;   // default white
    uint32_t bgColor = 0;   // default black
    uint8_t attributes = 0; // bold=1, italic=2, underline=4
};

struct CellAttributes {
    uint32_t fgColor = 7;
    uint32_t bgColor = 0;
    uint8_t attributes = 0;
};

class TerminalBuffer {
public:
    TerminalBuffer(int cols, int rows, int maxScrollback);

    int cols() const;
    int rows() const;

    void writeChar(int row, int col, wchar_t ch, const CellAttributes& attrs);
    Cell getCell(int row, int col) const;

    void scrollUp(int count);
    int scrollbackSize() const;

    void resize(int newCols, int newRows);

    std::set<int> getDirtyRows() const;
    void clearDirty();

private:
    int m_cols;
    int m_rows;
    int m_maxScrollback;
    std::vector<std::vector<Cell>> m_grid;
    std::deque<std::vector<Cell>> m_scrollback;
    std::set<int> m_dirtyRows;
    mutable std::shared_mutex m_mutex;

    std::vector<Cell> makeRow() const;
};

} // namespace VTerminal
