#pragma once

#include "TodoView.xaml.g.h"
#include "TodoStore.h"

#include <memory>

namespace winrt::VTerminal::implementation
{
    struct TodoView : TodoViewT<TodoView>
    {
        TodoView();

        // Initialize with TodoStore instance
        void SetTodoStore(::VTerminal::TodoStore* store);

        // Refresh the displayed list
        void RefreshList();

        // XAML event handlers
        void OnAddClick(winrt::Windows::Foundation::IInspectable const& sender,
                         winrt::Microsoft::UI::Xaml::RoutedEventArgs const& e);
        void OnInputKeyDown(winrt::Windows::Foundation::IInspectable const& sender,
                             winrt::Microsoft::UI::Xaml::Input::KeyRoutedEventArgs const& e);
        void OnTodoToggle(winrt::Windows::Foundation::IInspectable const& sender,
                           winrt::Microsoft::UI::Xaml::RoutedEventArgs const& e);
        void OnTodoDelete(winrt::Windows::Foundation::IInspectable const& sender,
                           winrt::Microsoft::UI::Xaml::RoutedEventArgs const& e);
        void OnClearCompletedClick(winrt::Windows::Foundation::IInspectable const& sender,
                                    winrt::Microsoft::UI::Xaml::RoutedEventArgs const& e);

    private:
        void AddTodoFromInput();
        void UpdateRemainingCount();

        ::VTerminal::TodoStore* m_store = nullptr;
    };
}

namespace winrt::VTerminal::factory_implementation
{
    struct TodoView : TodoViewT<TodoView, implementation::TodoView>
    {
    };
}
