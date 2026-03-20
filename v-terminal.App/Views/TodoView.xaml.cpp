#include "pch.h"
#include "TodoView.xaml.h"
#if __has_include("TodoView.g.cpp")
#include "TodoView.g.cpp"
#endif

using namespace winrt;
using namespace Microsoft::UI::Xaml;
using namespace Microsoft::UI::Xaml::Controls;
using namespace Windows::System;

namespace winrt::VTerminal::implementation
{
    TodoView::TodoView()
    {
        InitializeComponent();
    }

    void TodoView::SetTodoStore(::VTerminal::TodoStore* store)
    {
        m_store = store;
        RefreshList();
    }

    void TodoView::RefreshList()
    {
        if (!m_store) return;

        auto todos = m_store->getTodos();

        // Clear and rebuild the ListView
        // TODO: In production, use IObservableVector or manual ItemsSource binding
        // For now, rebuild items programmatically
        auto items = TodoList().Items();
        items.Clear();

        for (const auto& todo : todos) {
            // Create a simple data object for the DataTemplate binding
            // TODO: Use proper IInspectable wrapper for data binding
            // For now, create inline UI elements

            auto grid = Grid();
            auto col0 = ColumnDefinition();
            col0.Width(GridLengthHelper::Auto());
            auto col1 = ColumnDefinition();
            col1.Width(GridLengthHelper::FromValueAndType(1, GridUnitType::Star));
            auto col2 = ColumnDefinition();
            col2.Width(GridLengthHelper::Auto());
            grid.ColumnDefinitions().Append(col0);
            grid.ColumnDefinitions().Append(col1);
            grid.ColumnDefinitions().Append(col2);
            grid.Padding(ThicknessHelper::FromLengths(0, 4, 0, 4));

            auto checkbox = CheckBox();
            checkbox.IsChecked(todo.completed);
            checkbox.MinWidth(0);
            auto todoId = todo.id;
            checkbox.Click([this, todoId](auto&&, auto&&) {
                if (m_store) {
                    m_store->toggleTodo(todoId);
                    RefreshList();
                }
            });
            Grid::SetColumn(checkbox, 0);
            grid.Children().Append(checkbox);

            auto textBlock = TextBlock();
            textBlock.Text(hstring(todo.text));
            textBlock.VerticalAlignment(VerticalAlignment::Center);
            textBlock.TextTrimming(TextTrimming::CharacterEllipsis);
            textBlock.Margin(ThicknessHelper::FromLengths(4, 0, 4, 0));
            if (todo.completed) {
                textBlock.TextDecorations(Windows::UI::Text::TextDecorations::Strikethrough);
                textBlock.Opacity(0.5);
            }
            Grid::SetColumn(textBlock, 1);
            grid.Children().Append(textBlock);

            auto deleteBtn = Button();
            auto deleteIcon = FontIcon();
            deleteIcon.Glyph(L"\xE74D");
            deleteIcon.FontSize(12);
            deleteBtn.Content(deleteIcon);
            deleteBtn.Width(28);
            deleteBtn.Height(28);
            deleteBtn.Padding(ThicknessHelper::FromUniformLength(0));
            deleteBtn.Background(Microsoft::UI::Xaml::Media::SolidColorBrush(
                Microsoft::UI::Colors::Transparent()));
            deleteBtn.BorderThickness(ThicknessHelper::FromUniformLength(0));
            deleteBtn.Click([this, todoId](auto&&, auto&&) {
                if (m_store) {
                    m_store->deleteTodo(todoId);
                    RefreshList();
                }
            });
            Grid::SetColumn(deleteBtn, 2);
            grid.Children().Append(deleteBtn);

            items.Append(grid);
        }

        UpdateRemainingCount();
    }

    void TodoView::AddTodoFromInput()
    {
        auto text = TodoInput().Text();
        if (text.empty()) return;

        if (m_store) {
            m_store->addTodo(std::wstring(text));
            TodoInput().Text(L"");
            RefreshList();
        }
    }

    void TodoView::UpdateRemainingCount()
    {
        if (!m_store) {
            RemainingCount().Text(L"0 remaining");
            return;
        }

        auto todos = m_store->getTodos();
        int remaining = 0;
        for (const auto& t : todos) {
            if (!t.completed) ++remaining;
        }

        // TODO: Use localized string with placeholder
        RemainingCount().Text(to_hstring(remaining) + L" remaining");
    }

    void TodoView::OnAddClick(IInspectable const&, RoutedEventArgs const&)
    {
        AddTodoFromInput();
    }

    void TodoView::OnInputKeyDown(IInspectable const&, Input::KeyRoutedEventArgs const& e)
    {
        if (e.Key() == VirtualKey::Enter) {
            AddTodoFromInput();
            e.Handled(true);
        }
    }

    void TodoView::OnTodoToggle(IInspectable const& sender, RoutedEventArgs const&)
    {
        // Handled via lambda in RefreshList
    }

    void TodoView::OnTodoDelete(IInspectable const& sender, RoutedEventArgs const&)
    {
        // Handled via lambda in RefreshList
    }

    void TodoView::OnClearCompletedClick(IInspectable const&, RoutedEventArgs const&)
    {
        if (m_store) {
            m_store->clearCompleted();
            RefreshList();
        }
    }
}
