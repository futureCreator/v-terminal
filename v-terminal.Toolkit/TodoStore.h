#pragma once
#include "Types.h"
#include "JsonStore.h"
#include <filesystem>
#include <string>
#include <vector>

namespace VTerminal {

class TodoStore {
public:
    explicit TodoStore(const std::filesystem::path& configDir);

    void addTodo(const std::wstring& text);
    void toggleTodo(const std::wstring& id);
    void deleteTodo(const std::wstring& id);
    void clearCompleted();
    std::vector<TodoItem> getTodos() const;

private:
    JsonStore m_store;
    std::vector<TodoItem> m_todos;
    void save();
    static std::wstring generateId();
};

} // namespace VTerminal
