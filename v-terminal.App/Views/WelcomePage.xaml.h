#pragma once

#include "WelcomePage.xaml.g.h"

#include <functional>

namespace winrt::VTerminal::implementation
{
    struct WelcomePage : WelcomePageT<WelcomePage>
    {
        WelcomePage();

        /// Callback when onboarding is complete (user clicks "Get Started" or "Skip")
        std::function<void()> OnOnboardingComplete;

        // XAML event handlers
        void OnNextClick(winrt::Windows::Foundation::IInspectable const& sender,
                          winrt::Microsoft::UI::Xaml::RoutedEventArgs const& e);
        void OnBackClick(winrt::Windows::Foundation::IInspectable const& sender,
                          winrt::Microsoft::UI::Xaml::RoutedEventArgs const& e);
        void OnSkipClick(winrt::Windows::Foundation::IInspectable const& sender,
                          winrt::Microsoft::UI::Xaml::RoutedEventArgs const& e);

    private:
        void ShowSlide(int index);
        void UpdateDots();
        void CompleteOnboarding();

        int m_currentSlide = 0;
        static constexpr int TOTAL_SLIDES = 3;
    };
}

namespace winrt::VTerminal::factory_implementation
{
    struct WelcomePage : WelcomePageT<WelcomePage, implementation::WelcomePage>
    {
    };
}
