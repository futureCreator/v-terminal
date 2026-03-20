#include "pch.h"
#include "WelcomePage.xaml.h"
#if __has_include("WelcomePage.g.cpp")
#include "WelcomePage.g.cpp"
#endif

using namespace winrt;
using namespace Microsoft::UI::Xaml;

namespace winrt::VTerminal::implementation
{
    WelcomePage::WelcomePage()
    {
        InitializeComponent();
        ShowSlide(0);
    }

    void WelcomePage::ShowSlide(int index)
    {
        m_currentSlide = index;

        // Hide all slides
        Slide1().Visibility(Visibility::Collapsed);
        Slide2().Visibility(Visibility::Collapsed);
        Slide3().Visibility(Visibility::Collapsed);

        // Show current slide
        switch (index) {
            case 0: Slide1().Visibility(Visibility::Visible); break;
            case 1: Slide2().Visibility(Visibility::Visible); break;
            case 2: Slide3().Visibility(Visibility::Visible); break;
        }

        // Update button states
        BackButton().Visibility(index > 0 ? Visibility::Visible : Visibility::Collapsed);

        if (index == TOTAL_SLIDES - 1) {
            // Last slide: change "Next" to "Get Started"
            // TODO: Use localized string
            NextButton().Content(box_value(L"Get Started"));
        } else {
            NextButton().Content(box_value(L"Next"));
        }

        UpdateDots();
    }

    void WelcomePage::UpdateDots()
    {
        auto activeBrush = Application::Current().Resources()
            .Lookup(box_value(L"SystemAccentColor"));
        auto inactiveBrush = Microsoft::UI::Xaml::Media::SolidColorBrush(
            Windows::UI::Color{80, 128, 128, 128});
        auto accentBrush = Microsoft::UI::Xaml::Media::SolidColorBrush(
            Microsoft::UI::Colors::CornflowerBlue());

        Dot1().Fill(m_currentSlide == 0 ? accentBrush : inactiveBrush);
        Dot2().Fill(m_currentSlide == 1 ? accentBrush : inactiveBrush);
        Dot3().Fill(m_currentSlide == 2 ? accentBrush : inactiveBrush);
    }

    void WelcomePage::CompleteOnboarding()
    {
        // TODO: Save onboarding completion to onboarding.json
        // JsonStore store(dataDir / "onboarding.json");
        // store.save({{"completed", true}});

        if (OnOnboardingComplete) {
            OnOnboardingComplete();
        }
    }

    void WelcomePage::OnNextClick(IInspectable const&, RoutedEventArgs const&)
    {
        if (m_currentSlide < TOTAL_SLIDES - 1) {
            ShowSlide(m_currentSlide + 1);
        } else {
            // "Get Started" clicked on last slide
            CompleteOnboarding();
        }
    }

    void WelcomePage::OnBackClick(IInspectable const&, RoutedEventArgs const&)
    {
        if (m_currentSlide > 0) {
            ShowSlide(m_currentSlide - 1);
        }
    }

    void WelcomePage::OnSkipClick(IInspectable const&, RoutedEventArgs const&)
    {
        CompleteOnboarding();
    }
}
