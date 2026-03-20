#include "pch.h"
#include "App.xaml.h"

using namespace winrt;
using namespace winrt::Microsoft::UI::Xaml;

int WINAPI wWinMain(
    _In_ HINSTANCE /*hInstance*/,
    _In_opt_ HINSTANCE /*hPrevInstance*/,
    _In_ LPWSTR /*lpCmdLine*/,
    _In_ int /*nCmdShow*/)
{
    winrt::init_apartment(winrt::apartment_type::single_threaded);

    ::winrt::Microsoft::UI::Xaml::Application::Start(
        [](auto&&)
        {
            ::winrt::make<::winrt::VTerminal::implementation::App>();
        });

    return 0;
}
