#include "TodoStore.h"
#define WIN32_LEAN_AND_MEAN
#include <Windows.h>
#include <combaseapi.h>
#include <algorithm>
#include <sstream>
#include <iomanip>

namespace VTerminal {

namespace {
    std::string toUtf8(const std::wstring& ws) {
        if (ws.empty()) return {};
        int sz = WideCharToMultiByte(CP_UTF8, 0, ws.data(), static_cast<int>(ws.size()), nullptr, 0, nullptr, nullptr);
        std::string out(sz, '\0');
        WideCharToMultiByte(CP_UTF8, 0, ws.data(), static_cast<int>(ws.size()), out.data(), sz, nullptr, nullptr);
        return out;
    }

    std::wstring toWide(const std::string& s) {
        if (s.empty()) return {};
        int sz = MultiByteToWideChar(CP_UTF8, 0, s.data(), static_cast<int>(s.size()), nullptr, 0);
        std::wstring out(sz, L'\0');
        MultiByteToWideChar(CP_UTF8, 0, s.data(), static_cast<int>(s.size()), out.data(), sz);
        return out;
    }
} // anonymous namespace

TodoStore::TodoStore(const std::filesystem::path& configDir)
    : m_store(configDir / "todos.json")
{
    auto loaded = m_store.load();
    if (loaded.has_value()) {
        const auto& j = loaded.value();
        if (j.contains("todos") && j["todos"].is_array()) {
            for (const auto& item : j["todos"]) {
                TodoItem todo;
                if (item.contains("id")) todo.id = toWide(item["id"].get<std::string>());
                if (item.contains("text")) todo.text = toWide(item["text"].get<std::string>());
                if (item.contains("completed")) todo.completed = item["completed"].get<bool>();
                m_todos.push_back(std::move(todo));
            }
        }
    }
}

void TodoStore::addTodo(const std::wstring& text) {
    TodoItem todo;
    todo.id = generateId();
    todo.text = text;
    todo.completed = false;
    m_todos.push_back(std::move(todo));
    save();
}

void TodoStore::toggleTodo(const std::wstring& id) {
    for (auto& todo : m_todos) {
        if (todo.id == id) {
            todo.completed = !todo.completed;
            break;
        }
    }
    save();
}

void TodoStore::deleteTodo(const std::wstring& id) {
    m_todos.erase(
        std::remove_if(m_todos.begin(), m_todos.end(),
            [&id](const TodoItem& t) { return t.id == id; }),
        m_todos.end());
    save();
}

void TodoStore::clearCompleted() {
    m_todos.erase(
        std::remove_if(m_todos.begin(), m_todos.end(),
            [](const TodoItem& t) { return t.completed; }),
        m_todos.end());
    save();
}

std::vector<TodoItem> TodoStore::getTodos() const {
    return m_todos;
}

void TodoStore::save() {
    nlohmann::json arr = nlohmann::json::array();
    for (const auto& todo : m_todos) {
        arr.push_back({
            {"id", toUtf8(todo.id)},
            {"text", toUtf8(todo.text)},
            {"completed", todo.completed}
        });
    }
    m_store.save({{"todos", arr}});
}

std::wstring TodoStore::generateId() {
    GUID guid;
    CoCreateGuid(&guid);
    std::wostringstream ss;
    ss << std::hex << std::setfill(L'0')
       << std::setw(8) << guid.Data1 << L'-'
       << std::setw(4) << guid.Data2 << L'-'
       << std::setw(4) << guid.Data3 << L'-'
       << std::setw(2) << guid.Data4[0]
       << std::setw(2) << guid.Data4[1] << L'-'
       << std::setw(2) << guid.Data4[2]
       << std::setw(2) << guid.Data4[3]
       << std::setw(2) << guid.Data4[4]
       << std::setw(2) << guid.Data4[5]
       << std::setw(2) << guid.Data4[6]
       << std::setw(2) << guid.Data4[7];
    return ss.str();
}

} // namespace VTerminal
