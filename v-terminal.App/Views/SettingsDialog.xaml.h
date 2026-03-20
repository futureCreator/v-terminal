#pragma once

#include "SettingsDialog.xaml.g.h"
#include "Settings.h"
#include "Types.h"

namespace winrt::VTerminal::implementation
{
    struct SettingsDialog : SettingsDialogT<SettingsDialog>
    {
        SettingsDialog();

        // Set the Settings instance to read/write from
        void SetSettings(::VTerminal::Settings* settings);

        // XAML event handlers
        void OnPrimaryButtonClick(winrt::Microsoft::UI::Xaml::Controls::ContentDialog const& sender,
                                   winrt::Microsoft::UI::Xaml::Controls::ContentDialogButtonClickEventArgs const& args);
        void OnResetOnboardingClick(winrt::Windows::Foundation::IInspectable const& sender,
                                     winrt::Microsoft::UI::Xaml::RoutedEventArgs const& e);

    private:
        void LoadSettingsToUI();
        void SaveSettingsFromUI();

        ::VTerminal::Settings* m_settings = nullptr;
    };
}

namespace winrt::VTerminal::factory_implementation
{
    struct SettingsDialog : SettingsDialogT<SettingsDialog, implementation::SettingsDialog>
    {
    };
}
