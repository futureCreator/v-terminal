#pragma once

#include "SshProfileDialog.xaml.g.h"
#include "SshProfileViewModel.h"
#include "Types.h"

#include <vector>
#include <string>

namespace winrt::VTerminal::implementation
{
    struct SshProfileDialog : SshProfileDialogT<SshProfileDialog>
    {
        SshProfileDialog();

        // Initialize with existing profiles
        void SetViewModel(::VTerminal::SshProfileViewModel* viewModel);

        // Get the updated profiles after dialog closes
        std::vector<::VTerminal::SshProfile> GetProfiles() const;

        // XAML event handlers
        void OnProfileSelected(winrt::Windows::Foundation::IInspectable const& sender,
                                winrt::Microsoft::UI::Xaml::Controls::SelectionChangedEventArgs const& e);
        void OnAddProfileClick(winrt::Windows::Foundation::IInspectable const& sender,
                                winrt::Microsoft::UI::Xaml::RoutedEventArgs const& e);
        void OnDeleteProfileClick(winrt::Windows::Foundation::IInspectable const& sender,
                                   winrt::Microsoft::UI::Xaml::RoutedEventArgs const& e);
        void OnSaveClick(winrt::Microsoft::UI::Xaml::Controls::ContentDialog const& sender,
                          winrt::Microsoft::UI::Xaml::Controls::ContentDialogButtonClickEventArgs const& args);
        void OnBrowseIdentityClick(winrt::Windows::Foundation::IInspectable const& sender,
                                    winrt::Microsoft::UI::Xaml::RoutedEventArgs const& e);
        void OnTestConnectionClick(winrt::Windows::Foundation::IInspectable const& sender,
                                    winrt::Microsoft::UI::Xaml::RoutedEventArgs const& e);

    private:
        void RefreshProfileList();
        void LoadProfileToForm(int index);
        void SaveFormToProfile(int index);

        ::VTerminal::SshProfileViewModel* m_viewModel = nullptr;
        int m_selectedIndex = -1;
    };
}

namespace winrt::VTerminal::factory_implementation
{
    struct SshProfileDialog : SshProfileDialogT<SshProfileDialog, implementation::SshProfileDialog>
    {
    };
}
