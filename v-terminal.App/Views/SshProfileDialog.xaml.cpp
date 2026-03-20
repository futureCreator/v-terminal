#include "pch.h"
#include "SshProfileDialog.xaml.h"
#if __has_include("SshProfileDialog.g.cpp")
#include "SshProfileDialog.g.cpp"
#endif

using namespace winrt;
using namespace Microsoft::UI::Xaml;
using namespace Microsoft::UI::Xaml::Controls;

namespace winrt::VTerminal::implementation
{
    SshProfileDialog::SshProfileDialog()
    {
        InitializeComponent();
    }

    void SshProfileDialog::SetViewModel(::VTerminal::SshProfileViewModel* viewModel)
    {
        m_viewModel = viewModel;
        RefreshProfileList();
    }

    std::vector<::VTerminal::SshProfile> SshProfileDialog::GetProfiles() const
    {
        if (m_viewModel) {
            return m_viewModel->getProfiles();
        }
        return {};
    }

    void SshProfileDialog::RefreshProfileList()
    {
        if (!m_viewModel) return;

        auto items = ProfileList().Items();
        items.Clear();

        for (const auto& profile : m_viewModel->getProfiles()) {
            items.Append(box_value(hstring(profile.name)));
        }

        if (m_selectedIndex >= 0 && m_selectedIndex < static_cast<int>(items.Size())) {
            ProfileList().SelectedIndex(m_selectedIndex);
        }
    }

    void SshProfileDialog::LoadProfileToForm(int index)
    {
        if (!m_viewModel) return;

        auto profiles = m_viewModel->getProfiles();
        if (index < 0 || index >= static_cast<int>(profiles.size())) {
            // Clear form
            NameBox().Text(L"");
            HostBox().Text(L"");
            PortBox().Value(22);
            UsernameBox().Text(L"");
            IdentityBox().Text(L"");
            EditForm().IsEnabled(false);
            return;
        }

        EditForm().IsEnabled(true);
        const auto& profile = profiles[index];
        NameBox().Text(hstring(profile.name));
        HostBox().Text(hstring(profile.host));
        PortBox().Value(profile.port);
        UsernameBox().Text(hstring(profile.username));
        IdentityBox().Text(profile.identityFile.has_value()
            ? hstring(profile.identityFile.value()) : hstring(L""));
    }

    void SshProfileDialog::SaveFormToProfile(int index)
    {
        if (!m_viewModel) return;

        ::VTerminal::SshProfile profile;
        profile.name = std::wstring(NameBox().Text());
        profile.host = std::wstring(HostBox().Text());
        profile.port = static_cast<int>(PortBox().Value());
        profile.username = std::wstring(UsernameBox().Text());
        auto identity = std::wstring(IdentityBox().Text());
        if (!identity.empty()) {
            profile.identityFile = identity;
        }

        m_viewModel->updateProfile(index, profile);
    }

    void SshProfileDialog::OnProfileSelected(IInspectable const&, SelectionChangedEventArgs const&)
    {
        // Save current profile before switching
        if (m_selectedIndex >= 0 && m_viewModel) {
            SaveFormToProfile(m_selectedIndex);
        }

        m_selectedIndex = ProfileList().SelectedIndex();
        LoadProfileToForm(m_selectedIndex);
    }

    void SshProfileDialog::OnAddProfileClick(IInspectable const&, RoutedEventArgs const&)
    {
        if (!m_viewModel) return;

        m_viewModel->addProfile();
        RefreshProfileList();

        // Select the newly added profile
        auto profiles = m_viewModel->getProfiles();
        m_selectedIndex = static_cast<int>(profiles.size()) - 1;
        ProfileList().SelectedIndex(m_selectedIndex);
        LoadProfileToForm(m_selectedIndex);
    }

    void SshProfileDialog::OnDeleteProfileClick(IInspectable const&, RoutedEventArgs const&)
    {
        if (!m_viewModel || m_selectedIndex < 0) return;

        m_viewModel->removeProfile(m_selectedIndex);
        m_selectedIndex = -1;
        RefreshProfileList();
        LoadProfileToForm(-1);
    }

    void SshProfileDialog::OnSaveClick(ContentDialog const&, ContentDialogButtonClickEventArgs const&)
    {
        // Save current profile before closing
        if (m_selectedIndex >= 0 && m_viewModel) {
            SaveFormToProfile(m_selectedIndex);
        }

        // Persist to disk
        if (m_viewModel) {
            m_viewModel->save();
        }
    }

    void SshProfileDialog::OnBrowseIdentityClick(IInspectable const&, RoutedEventArgs const&)
    {
        // TODO: Open file picker dialog for SSH identity file
        // Use Windows.Storage.Pickers.FileOpenPicker
    }

    void SshProfileDialog::OnTestConnectionClick(IInspectable const&, RoutedEventArgs const&)
    {
        // TODO: Attempt SSH connection with current form values
        // Display success/failure in TestResultText
        TestResultText().Text(L"Testing...");

        // TODO: Run async SSH connection test
        // On success: TestResultText().Text(L"Connected!");
        // On failure: TestResultText().Text(L"Connection failed: ...");
    }
}
