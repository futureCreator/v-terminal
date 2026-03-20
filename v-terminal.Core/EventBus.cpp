#include "EventBus.h"
#include <algorithm>

namespace VTerminal {

void EventBus::unsubscribe(SubscriptionId id) {
    for (auto& [event, handlers] : m_handlers) {
        auto it = std::remove_if(handlers.begin(), handlers.end(),
            [id](const Handler& h) { return h.id == id; });
        handlers.erase(it, handlers.end());
    }
}

} // namespace VTerminal
