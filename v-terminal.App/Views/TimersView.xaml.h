#pragma once

#include "TimersView.xaml.g.h"
#include "PomodoroTimer.h"
#include "CountdownTimer.h"
#include "AlarmManager.h"

#include <vector>
#include <memory>

namespace winrt::VTerminal::implementation
{
    struct TimersView : TimersViewT<TimersView>
    {
        TimersView();
        ~TimersView();

        // Initialize with toolkit stores
        void SetPomodoroTimer(::VTerminal::PomodoroTimer* timer);
        void SetAlarmManager(::VTerminal::AlarmManager* alarmMgr);

        // Tick method called by timer thread (dispatched to UI)
        void Tick(int elapsedMs);

        // XAML event handlers — Pomodoro
        void OnPomodoroStartClick(winrt::Windows::Foundation::IInspectable const& sender,
                                    winrt::Microsoft::UI::Xaml::RoutedEventArgs const& e);
        void OnPomodoroPauseClick(winrt::Windows::Foundation::IInspectable const& sender,
                                    winrt::Microsoft::UI::Xaml::RoutedEventArgs const& e);
        void OnPomodoroResetClick(winrt::Windows::Foundation::IInspectable const& sender,
                                    winrt::Microsoft::UI::Xaml::RoutedEventArgs const& e);
        void OnPomodoroSettingsChanged(winrt::Microsoft::UI::Xaml::Controls::NumberBox const& sender,
                                        winrt::Microsoft::UI::Xaml::Controls::NumberBoxValueChangedEventArgs const& e);

        // XAML event handlers — Countdown
        void OnAddTimerClick(winrt::Windows::Foundation::IInspectable const& sender,
                              winrt::Microsoft::UI::Xaml::RoutedEventArgs const& e);

        // XAML event handlers — Alarms
        void OnAddAlarmClick(winrt::Windows::Foundation::IInspectable const& sender,
                              winrt::Microsoft::UI::Xaml::RoutedEventArgs const& e);

    private:
        void UpdatePomodoroDisplay();
        void UpdateSessionDots();
        void RefreshTimersList();
        void RefreshAlarmsList();

        ::VTerminal::PomodoroTimer* m_pomodoroTimer = nullptr;
        ::VTerminal::AlarmManager* m_alarmManager = nullptr;

        // Countdown timers (owned by this view)
        std::vector<std::unique_ptr<::VTerminal::CountdownTimer>> m_countdownTimers;
    };
}

namespace winrt::VTerminal::factory_implementation
{
    struct TimersView : TimersViewT<TimersView, implementation::TimersView>
    {
    };
}
