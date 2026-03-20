#pragma once
#include <string>

namespace VTerminal {

// Returns score > 0 for match, 0 for no match. Case-insensitive subsequence match.
int fuzzyMatch(const std::wstring& query, const std::wstring& target);

} // namespace VTerminal
