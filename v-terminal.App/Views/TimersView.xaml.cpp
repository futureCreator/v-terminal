#include "pch.h"
#include "TimersView.xaml.h"
#if __has_include("TimersView.g.cpp")
#include "TimersView.g.cpp"
#endif

using namespace winrt;
using namespace Microsoft::UI::Xaml;
using namespace Microsoft::UI::Xaml::Controls;

namespace winrt::VTerminal::implementation
{
    TimersView::TimersView()
    {
        InitializeComponent();
    }

    TimersView::~TimersView()
    {
        m_countdownTimers.clear();
    }

    void TimersView::SetPomodoroTimer(::VTerminal::PomodoroTimer* timer)
    {
        m_pomodoroTimer = timer;
        if (m_pomodoroTimer) {
            auto config = m_pomodoroTimer->config();
            FocusMinutesBox().Value(config.focusMinutes);
            BreakMinutesBox().Value(config.breakMinutes);
            LongBreakMinutesBox().Value(config.longBreakMinutes);
        }
        UpdatePomodoroDisplay();
    }

    void TimersView::SetAlarmManager(::VTerminal::AlarmManager* alarmMgr)
    {
        m_alarmManager = alarmMgr;
        RefreshAlarmsList();
    }

    void TimersView::Tick(int elapsedMs)
    {
        // Tick pomodoro
        if (m_pomodoroTimer && m_pomodoroTimer->isRunning()) {
            m_pomodoroTimer->tick(elapsedMs);
            UpdatePomodoroDisplay();
        }

        // Tick countdown timers
        for (auto it = m_countdownTimers.begin(); it != m_countdownTimers.end(); ) {
            (*it)->tick(elapsedMs);
            if ((*it)->isFinished()) {
                // TODO: Show toast notification for finished timer
                it = m_countdownTimers.erase(it);
            } else {
                ++it;
            }
        }
        RefreshTimersList();
    }

    void TimersView::UpdatePomodoroDisplay()
    {
        if (!m_pomodoroTimer) return;

        int remainMs = m_pomodoroTimer->remainingMs();
        int totalSec = remainMs / 1000;
        int minutes = totalSec / 60;
        int seconds = totalSec % 60;

        wchar_t buf[16];
        swprintf_s(buf, L"%02d:%02d", minutes, seconds);
        PomodoroTimeText().Text(buf);

        // Update phase text
        switch (m_pomodoroTimer->phase()) {
            case ::VTerminal::PomodoroPhase::Focus:
                PomodoroPhaseText().Text(L"Focus");
                break;
            case ::VTerminal::PomodoroPhase::Break:
                PomodoroPhaseText().Text(L"Break");
                break;
            case ::VTerminal::PomodoroPhase::LongBreak:
                PomodoroPhaseText().Text(L"Long Break");
                break;
        }

        // Update progress ring
        auto config = m_pomodoroTimer->config();
        int totalMs = 0;
        switch (m_pomodoroTimer->phase()) {
            case ::VTerminal::PomodoroPhase::Focus:
                totalMs = config.focusMinutes * 60 * 1000;
                break;
            case ::VTerminal::PomodoroPhase::Break:
                totalMs = config.breakMinutes * 60 * 1000;
                break;
            case ::VTerminal::PomodoroPhase::LongBreak:
                totalMs = config.longBreakMinutes * 60 * 1000;
                break;
        }
        if (totalMs > 0) {
            double progress = static_cast<double>(remainMs) / totalMs * 100.0;
            PomodoroRing().Value(progress);
        }

        // Update button states
        bool running = m_pomodoroTimer->isRunning();
        PomodoroStartBtn().IsEnabled(!running);
        PomodoroPauseBtn().IsEnabled(running);

        UpdateSessionDots();
    }

    void TimersView::UpdateSessionDots()
    {
        // TODO: Show dots representing completed Pomodoro sessions
        // For now, clear and rebuild based on session count
        auto dots = SessionDots();
        dots.Children().Clear();

        // Placeholder: show 4 dots
        for (int i = 0; i < 4; ++i) {
            auto dot = Microsoft::UI::Xaml::Shapes::Ellipse();
            dot.Width(8);
            dot.Height(8);
            dot.Fill(Microsoft::UI::Xaml::Media::SolidColorBrush(
                Windows::UI::Color{60, 128, 128, 128}));
            dots.Children().Append(dot);
        }
    }

    void TimersView::RefreshTimersList()
    {
        auto list = TimersList();
        list.Children().Clear();

        for (const auto& timer : m_countdownTimers) {
            int remainMs = timer->remainingMs();
            int totalSec = remainMs / 1000;
            int minutes = totalSec / 60;
            int seconds = totalSec % 60;

            auto grid = Grid();
            auto col0 = ColumnDefinition();
            col0.Width(GridLengthHelper::FromValueAndType(1, GridUnitType::Star));
            auto col1 = ColumnDefinition();
            col1.Width(GridLengthHelper::Auto());
            grid.ColumnDefinitions().Append(col0);
            grid.ColumnDefinitions().Append(col1);

            auto text = TextBlock();
            wchar_t buf[32];
            swprintf_s(buf, L"%02d:%02d", minutes, seconds);
            text.Text(buf);
            text.VerticalAlignment(VerticalAlignment::Center);
            Grid::SetColumn(text, 0);
            grid.Children().Append(text);

            auto progress = ProgressBar();
            progress.Width(80);
            progress.IsIndeterminate(false);
            // TODO: Set progress value based on elapsed/total
            Grid::SetColumn(progress, 1);
            grid.Children().Append(progress);

            list.Children().Append(grid);
        }
    }

    void TimersView::RefreshAlarmsList()
    {
        if (!m_alarmManager) return;

        auto list = AlarmsList();
        list.Children().Clear();

        for (const auto& alarm : m_alarmManager->getAlarms()) {
            auto grid = Grid();
            auto col0 = ColumnDefinition();
            col0.Width(GridLengthHelper::FromValueAndType(1, GridUnitType::Star));
            auto col1 = ColumnDefinition();
            col1.Width(GridLengthHelper::Auto());
            auto col2 = ColumnDefinition();
            col2.Width(GridLengthHelper::Auto());
            grid.ColumnDefinitions().Append(col0);
            grid.ColumnDefinitions().Append(col1);
            grid.ColumnDefinitions().Append(col2);
            grid.Padding(ThicknessHelper::FromLengths(0, 4, 0, 4));

            // Label + time
            auto text = TextBlock();
            text.Text(hstring(alarm.label) + L" " + hstring(alarm.time));
            text.VerticalAlignment(VerticalAlignment::Center);
            Grid::SetColumn(text, 0);
            grid.Children().Append(text);

            // Enable/disable toggle
            auto toggle = ToggleSwitch();
            toggle.IsOn(alarm.enabled);
            auto alarmId = alarm.id;
            toggle.Toggled([this, alarmId](auto&&, auto&&) {
                if (m_alarmManager) {
                    m_alarmManager->toggleAlarm(alarmId);
                }
            });
            Grid::SetColumn(toggle, 1);
            grid.Children().Append(toggle);

            // Delete button
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
            deleteBtn.Click([this, alarmId](auto&&, auto&&) {
                if (m_alarmManager) {
                    m_alarmManager->removeAlarm(alarmId);
                    RefreshAlarmsList();
                }
            });
            Grid::SetColumn(deleteBtn, 2);
            grid.Children().Append(deleteBtn);

            list.Children().Append(grid);
        }
    }

    void TimersView::OnPomodoroStartClick(IInspectable const&, RoutedEventArgs const&)
    {
        if (m_pomodoroTimer) {
            m_pomodoroTimer->start();
            UpdatePomodoroDisplay();
        }
    }

    void TimersView::OnPomodoroPauseClick(IInspectable const&, RoutedEventArgs const&)
    {
        if (m_pomodoroTimer) {
            m_pomodoroTimer->pause();
            UpdatePomodoroDisplay();
        }
    }

    void TimersView::OnPomodoroResetClick(IInspectable const&, RoutedEventArgs const&)
    {
        if (m_pomodoroTimer) {
            m_pomodoroTimer->reset();
            UpdatePomodoroDisplay();
        }
    }

    void TimersView::OnPomodoroSettingsChanged(NumberBox const&, NumberBoxValueChangedEventArgs const&)
    {
        if (!m_pomodoroTimer) return;

        ::VTerminal::PomodoroConfig config;
        config.focusMinutes = static_cast<int>(FocusMinutesBox().Value());
        config.breakMinutes = static_cast<int>(BreakMinutesBox().Value());
        config.longBreakMinutes = static_cast<int>(LongBreakMinutesBox().Value());
        m_pomodoroTimer->setConfig(config);
        UpdatePomodoroDisplay();
    }

    void TimersView::OnAddTimerClick(IInspectable const&, RoutedEventArgs const&)
    {
        auto label = std::wstring(TimerLabelInput().Text());
        int minutes = static_cast<int>(TimerMinutesInput().Value());
        if (label.empty() || minutes <= 0) return;

        auto timer = std::make_unique<::VTerminal::CountdownTimer>(label, minutes * 60 * 1000);
        timer->onFinish([label]() {
            // TODO: Send Windows ToastNotification
            // ToastNotificationManager::CreateToastNotifier().Show(...)
        });
        timer->start();
        m_countdownTimers.push_back(std::move(timer));

        TimerLabelInput().Text(L"");
        RefreshTimersList();
    }

    void TimersView::OnAddAlarmClick(IInspectable const&, RoutedEventArgs const&)
    {
        if (!m_alarmManager) return;

        auto label = std::wstring(AlarmLabelInput().Text());
        if (label.empty()) return;

        auto time = AlarmTimePicker().Time();
        int hours = static_cast<int>(time.Hours);
        int minutes = static_cast<int>(time.Minutes);

        wchar_t timeBuf[8];
        swprintf_s(timeBuf, L"%02d:%02d", hours, minutes);

        // Collect selected weekdays
        std::vector<int> weekdays;
        if (MonToggle().IsChecked()) weekdays.push_back(0);
        if (TueToggle().IsChecked()) weekdays.push_back(1);
        if (WedToggle().IsChecked()) weekdays.push_back(2);
        if (ThuToggle().IsChecked()) weekdays.push_back(3);
        if (FriToggle().IsChecked()) weekdays.push_back(4);
        if (SatToggle().IsChecked()) weekdays.push_back(5);
        if (SunToggle().IsChecked()) weekdays.push_back(6);

        if (weekdays.empty()) return; // Must select at least one day

        ::VTerminal::AlarmEntry alarm;
        alarm.id = std::to_wstring(std::chrono::system_clock::now().time_since_epoch().count());
        alarm.label = label;
        alarm.time = timeBuf;
        alarm.weekdays = std::move(weekdays);
        alarm.enabled = true;

        m_alarmManager->addAlarm(alarm);
        AlarmLabelInput().Text(L"");
        RefreshAlarmsList();
    }
}
