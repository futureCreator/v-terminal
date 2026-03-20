#include <gtest/gtest.h>
#include "WslHelper.h"

TEST(WslHelperTest, GetDistrosReturnsNonEmpty) {
    auto distros = VTerminal::WslHelper::getDistros();
    if (distros.empty()) {
        GTEST_SKIP() << "WSL not available";
    }
    EXPECT_FALSE(distros[0].empty());
}
