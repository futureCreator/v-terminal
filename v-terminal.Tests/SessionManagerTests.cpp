#include <gtest/gtest.h>
#include "SessionManager.h"

TEST(SessionManagerTest, CreateLocalSession) {
    VTerminal::SessionManager mgr;
    auto id = mgr.createSession(VTerminal::SessionType::Local, {});
    EXPECT_FALSE(id.empty());
    EXPECT_TRUE(mgr.hasSession(id));
}

TEST(SessionManagerTest, KillSession) {
    VTerminal::SessionManager mgr;
    auto id = mgr.createSession(VTerminal::SessionType::Local, {});
    mgr.killSession(id);
    EXPECT_FALSE(mgr.hasSession(id));
}
