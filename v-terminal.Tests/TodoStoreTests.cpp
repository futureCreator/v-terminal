#include <gtest/gtest.h>
#include "TodoStore.h"
#include <filesystem>

class TodoStoreTest : public ::testing::Test {
protected:
    std::filesystem::path testDir;
    void SetUp() override {
        testDir = std::filesystem::temp_directory_path() / "v-terminal-todo-test";
        std::filesystem::create_directories(testDir);
    }
    void TearDown() override {
        std::filesystem::remove_all(testDir);
    }
};

TEST_F(TodoStoreTest, AddAndListTodos) {
    VTerminal::TodoStore store(testDir);
    store.addTodo(L"Buy milk");
    store.addTodo(L"Write code");

    auto todos = store.getTodos();
    EXPECT_EQ(todos.size(), 2);
    EXPECT_EQ(todos[0].text, L"Buy milk");
    EXPECT_FALSE(todos[0].completed);
}

TEST_F(TodoStoreTest, ToggleCompletion) {
    VTerminal::TodoStore store(testDir);
    store.addTodo(L"Task");
    auto id = store.getTodos()[0].id;
    store.toggleTodo(id);
    EXPECT_TRUE(store.getTodos()[0].completed);
}

TEST_F(TodoStoreTest, ClearCompleted) {
    VTerminal::TodoStore store(testDir);
    store.addTodo(L"Done");
    store.addTodo(L"Not done");
    store.toggleTodo(store.getTodos()[0].id);
    store.clearCompleted();

    EXPECT_EQ(store.getTodos().size(), 1);
    EXPECT_EQ(store.getTodos()[0].text, L"Not done");
}
