#pragma once
#include <vector>
#include <string>

namespace VTerminal {

class WslHelper {
public:
    static std::vector<std::wstring> getDistros();
};

} // namespace VTerminal
