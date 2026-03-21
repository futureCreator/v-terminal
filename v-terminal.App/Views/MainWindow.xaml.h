#pragma once

#include "MainWindow.g.h"
#include "MainWindow.xaml.g.h"

namespace winrt::VTerminal::implementation
{
    struct MainWindow : MainWindowT<MainWindow>
    {
        MainWindow();
    };
}

namespace winrt::VTerminal::factory_implementation
{
    struct MainWindow : MainWindowT<MainWindow, implementation::MainWindow>
    {
    };
}
