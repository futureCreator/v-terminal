#include "FuzzyMatch.h"
#include <algorithm>
#include <cctype>

namespace VTerminal {

int fuzzyMatch(const std::wstring& query, const std::wstring& target) {
    if (query.empty()) return 1; // empty query matches everything
    if (target.empty()) return 0;

    std::wstring lowerQuery, lowerTarget;
    lowerQuery.resize(query.size());
    lowerTarget.resize(target.size());
    std::transform(query.begin(), query.end(), lowerQuery.begin(), ::towlower);
    std::transform(target.begin(), target.end(), lowerTarget.begin(), ::towlower);

    // Subsequence match
    size_t qi = 0;
    int score = 0;
    bool prevMatched = false;

    for (size_t ti = 0; ti < lowerTarget.size() && qi < lowerQuery.size(); ++ti) {
        if (lowerTarget[ti] == lowerQuery[qi]) {
            score += 10;
            // Bonus for consecutive matches
            if (prevMatched) score += 5;
            // Bonus for matching at word boundary
            if (ti == 0 || lowerTarget[ti - 1] == L' ' || lowerTarget[ti - 1] == L'_' || lowerTarget[ti - 1] == L'-') {
                score += 10;
            }
            prevMatched = true;
            qi++;
        } else {
            prevMatched = false;
        }
    }

    // All query chars must match
    if (qi < lowerQuery.size()) return 0;

    // Bonus for exact match
    if (lowerQuery == lowerTarget) score += 50;

    return score;
}

} // namespace VTerminal
