#include "TerminalBuffer.h"
#include <algorithm>

namespace VTerminal {

TerminalBuffer::TerminalBuffer(int cols, int rows, int maxScrollback)
    : m_cols(cols), m_rows(rows), m_maxScrollback(maxScrollback)
{
    m_grid.resize(rows);
    for (auto& row : m_grid) {
        row = makeRow();
    }
}

int TerminalBuffer::cols() const {
    std::shared_lock lock(m_mutex);
    return m_cols;
}

int TerminalBuffer::rows() const {
    std::shared_lock lock(m_mutex);
    return m_rows;
}

void TerminalBuffer::writeChar(int row, int col, wchar_t ch, const CellAttributes& attrs) {
    std::unique_lock lock(m_mutex);
    if (row < 0 || row >= m_rows || col < 0 || col >= m_cols) return;
    auto& cell = m_grid[row][col];
    cell.character = ch;
    cell.fgColor = attrs.fgColor;
    cell.bgColor = attrs.bgColor;
    cell.attributes = attrs.attributes;
    m_dirtyRows.insert(row);
}

Cell TerminalBuffer::getCell(int row, int col) const {
    std::shared_lock lock(m_mutex);
    if (row < 0 || row >= m_rows || col < 0 || col >= m_cols) return {};
    return m_grid[row][col];
}

void TerminalBuffer::scrollUp(int count) {
    std::unique_lock lock(m_mutex);
    for (int i = 0; i < count && !m_grid.empty(); ++i) {
        m_scrollback.push_back(std::move(m_grid.front()));
        m_grid.erase(m_grid.begin());
        m_grid.push_back(makeRow());

        while (static_cast<int>(m_scrollback.size()) > m_maxScrollback) {
            m_scrollback.pop_front();
        }
    }
    // All visible rows are dirty after scroll
    for (int r = 0; r < m_rows; ++r) {
        m_dirtyRows.insert(r);
    }
}

int TerminalBuffer::scrollbackSize() const {
    std::shared_lock lock(m_mutex);
    return static_cast<int>(m_scrollback.size());
}

void TerminalBuffer::resize(int newCols, int newRows) {
    std::unique_lock lock(m_mutex);
    // Resize columns in existing rows
    for (auto& row : m_grid) {
        row.resize(newCols, Cell{});
    }
    // Add or remove rows
    while (static_cast<int>(m_grid.size()) < newRows) {
        m_grid.push_back(std::vector<Cell>(newCols, Cell{}));
    }
    while (static_cast<int>(m_grid.size()) > newRows) {
        m_grid.pop_back();
    }
    m_cols = newCols;
    m_rows = newRows;
    // Mark all dirty
    for (int r = 0; r < m_rows; ++r) {
        m_dirtyRows.insert(r);
    }
}

std::set<int> TerminalBuffer::getDirtyRows() const {
    std::shared_lock lock(m_mutex);
    return m_dirtyRows;
}

void TerminalBuffer::clearDirty() {
    std::unique_lock lock(m_mutex);
    m_dirtyRows.clear();
}

std::vector<Cell> TerminalBuffer::makeRow() const {
    return std::vector<Cell>(m_cols, Cell{});
}

} // namespace VTerminal
