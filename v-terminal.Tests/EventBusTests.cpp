#include <gtest/gtest.h>
#include "EventBus.h"
#include <string>

TEST(EventBusTest, SubscribeAndPublish) {
    VTerminal::EventBus bus;
    std::string received;

    bus.subscribe<std::string>("test-event", [&](const std::string& data) {
        received = data;
    });

    bus.publish("test-event", std::string("hello"));
    EXPECT_EQ(received, "hello");
}

TEST(EventBusTest, Unsubscribe) {
    VTerminal::EventBus bus;
    int count = 0;

    auto id = bus.subscribe<int>("counter", [&](const int& val) {
        count += val;
    });

    bus.publish("counter", 1);
    bus.unsubscribe(id);
    bus.publish("counter", 1);

    EXPECT_EQ(count, 1);
}
