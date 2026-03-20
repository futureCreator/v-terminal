#pragma once
#include <string>
#include <functional>
#include <unordered_map>
#include <vector>
#include <any>
#include <cstdint>

namespace VTerminal {

class EventBus {
public:
    using SubscriptionId = uint64_t;

    template<typename T>
    SubscriptionId subscribe(const std::string& event, std::function<void(const T&)> callback) {
        auto id = m_nextId++;
        auto wrapper = [cb = std::move(callback)](const std::any& data) {
            cb(std::any_cast<const T&>(data));
        };
        m_handlers[event].push_back({id, std::move(wrapper)});
        return id;
    }

    template<typename T>
    void publish(const std::string& event, const T& data) {
        auto it = m_handlers.find(event);
        if (it == m_handlers.end()) return;
        for (auto& handler : it->second) {
            handler.callback(std::any(data));
        }
    }

    void unsubscribe(SubscriptionId id);

private:
    struct Handler {
        SubscriptionId id;
        std::function<void(const std::any&)> callback;
    };

    std::unordered_map<std::string, std::vector<Handler>> m_handlers;
    SubscriptionId m_nextId = 1;
};

} // namespace VTerminal
