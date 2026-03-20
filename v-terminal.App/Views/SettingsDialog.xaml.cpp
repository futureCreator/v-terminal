#include "pch.h"
#include "SettingsDialog.xaml.h"
#if __has_include("SettingsDialog.g.cpp")
#include "SettingsDialog.g.cpp"
#endif

#include "ThemeManager.h"

using namespace winrt;
using namespace Microsoft::UI::Xaml;
using namespace Microsoft::UI::Xaml::Controls;

namespace winrt::VTerminal::implementation
{
    SettingsDialog::SettingsDialog()
    {
        InitializeComponent();
    }

    void SettingsDialog::SetSettings(::VTerminal::Settings* settings)
    {
        m_settings = settings;
        LoadSettingsToUI();
    }

    void SettingsDialog::LoadSettingsToUI()
    {
        if (!m_settings) return;

        auto config = m_settings->getAppSettings();

        // Theme
        if (config.theme == L"auto")       ThemeCombo().SelectedIndex(0);
        else if (config.theme == L"light") ThemeCombo().SelectedIndex(1);
        else if (config.theme == L"dark")  ThemeCombo().SelectedIndex(2);

        // Language
        if (config.language == L"en")      LangCombo().SelectedIndex(0);
        else if (config.language == L"ko") LangCombo().SelectedIndex(1);

        // Note background
        switch (config.noteBackground) {
            case ::VTerminal::NoteBackground::None:  NoteBgCombo().SelectedIndex(0); break;
            case ::VTerminal::NoteBackground::Ruled: NoteBgCombo().SelectedIndex(1); break;
            case ::VTerminal::NoteBackground::Grid:  NoteBgCombo().SelectedIndex(2); break;
            case ::VTerminal::NoteBackground::Dots:  NoteBgCombo().SelectedIndex(3); break;
        }

        // Terminal settings
        // Find the matching font in the combo box
        auto fontFamily = config.terminal.fontFamily;
        for (int i = 0; i < static_cast<int>(FontCombo().Items().Size()); ++i) {
            auto item = FontCombo().Items().GetAt(i).as<ComboBoxItem>();
            if (item.Content().as<hstring>() == hstring(fontFamily)) {
                FontCombo().SelectedIndex(i);
                break;
            }
        }

        FontSizeBox().Value(config.terminal.fontSize);

        switch (config.terminal.cursorStyle) {
            case ::VTerminal::CursorStyle::Block:     CursorStyleRadio().SelectedIndex(0); break;
            case ::VTerminal::CursorStyle::Underline:  CursorStyleRadio().SelectedIndex(1); break;
            case ::VTerminal::CursorStyle::Bar:        CursorStyleRadio().SelectedIndex(2); break;
        }

        CursorBlinkToggle().IsOn(config.terminal.cursorBlink);
        LineHeightSlider().Value(config.terminal.lineHeight);
        ScrollbackBox().Value(config.terminal.scrollbackLines);
    }

    void SettingsDialog::SaveSettingsFromUI()
    {
        if (!m_settings) return;

        auto config = m_settings->getAppSettings();

        // Theme
        switch (ThemeCombo().SelectedIndex()) {
            case 0: config.theme = L"auto"; break;
            case 1: config.theme = L"light"; break;
            case 2: config.theme = L"dark"; break;
        }

        // Language
        switch (LangCombo().SelectedIndex()) {
            case 0: config.language = L"en"; break;
            case 1: config.language = L"ko"; break;
        }

        // Note background
        switch (NoteBgCombo().SelectedIndex()) {
            case 0: config.noteBackground = ::VTerminal::NoteBackground::None; break;
            case 1: config.noteBackground = ::VTerminal::NoteBackground::Ruled; break;
            case 2: config.noteBackground = ::VTerminal::NoteBackground::Grid; break;
            case 3: config.noteBackground = ::VTerminal::NoteBackground::Dots; break;
        }

        // Font
        if (FontCombo().SelectedItem()) {
            auto item = FontCombo().SelectedItem().as<ComboBoxItem>();
            config.terminal.fontFamily = std::wstring(item.Content().as<hstring>());
        }

        config.terminal.fontSize = static_cast<int>(FontSizeBox().Value());

        switch (CursorStyleRadio().SelectedIndex()) {
            case 0: config.terminal.cursorStyle = ::VTerminal::CursorStyle::Block; break;
            case 1: config.terminal.cursorStyle = ::VTerminal::CursorStyle::Underline; break;
            case 2: config.terminal.cursorStyle = ::VTerminal::CursorStyle::Bar; break;
        }

        config.terminal.cursorBlink = CursorBlinkToggle().IsOn();
        config.terminal.lineHeight = LineHeightSlider().Value();
        config.terminal.scrollbackLines = static_cast<int>(ScrollbackBox().Value());

        m_settings->setAppSettings(config);

        // Apply theme change immediately
        ::VTerminal::ThemeManager::applyTheme(config.theme);

        // TODO: Apply language change (requires PrimaryLanguageOverride and resource reload)
        // TODO: Notify all TerminalPanes of config change
    }

    void SettingsDialog::OnPrimaryButtonClick(ContentDialog const&,
                                               ContentDialogButtonClickEventArgs const&)
    {
        SaveSettingsFromUI();
    }

    void SettingsDialog::OnResetOnboardingClick(IInspectable const&, RoutedEventArgs const&)
    {
        // TODO: Write { "completed": false } to onboarding.json via JsonStore
        // JsonStore onboardingStore(dataDir / "onboarding.json");
        // onboardingStore.save({{"completed", false}});
    }
}
