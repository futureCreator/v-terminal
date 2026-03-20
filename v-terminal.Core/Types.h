#pragma once
#include <string>
#include <vector>
#include <optional>
#include <cstdint>

namespace VTerminal {

using SessionId = std::wstring;

enum class SessionType { Local, Ssh, Wsl, Note };

enum class CursorStyle { Block, Underline, Bar };

enum class NoteBackground { None, Ruled, Grid, Dots };

struct PanelConnection {
    SessionType type = SessionType::Local;
    std::optional<std::wstring> sshProfileId;
    std::optional<std::wstring> cwd;
    std::optional<std::wstring> noteContent;
};

struct TabState {
    std::wstring label;
    int layout = 1;
    std::wstring cwd;
    std::vector<PanelConnection> panels;
};

struct WindowState {
    int x = 100;
    int y = 100;
    int width = 1280;
    int height = 720;
    bool maximized = false;
};

struct WorkspaceState {
    int version = 1;
    WindowState windowState;
    std::vector<TabState> tabs;
};

struct SshProfile {
    std::wstring id;
    std::wstring name;
    std::wstring host;
    int port = 22;
    std::wstring username;
    std::optional<std::wstring> identityFile;
};

struct TerminalTheme {
    std::wstring foreground;
    std::wstring background;
    std::wstring cursor;
    std::wstring selectionBackground;
    std::vector<std::wstring> ansi; // 16 colors
};

struct TerminalConfig {
    std::wstring fontFamily = L"JetBrains Mono";
    int fontSize = 14;
    CursorStyle cursorStyle = CursorStyle::Block;
    bool cursorBlink = true;
    double lineHeight = 1.2;
    int scrollbackLines = 5000;
};

struct AppSettings {
    std::wstring theme = L"auto"; // auto, light, dark
    std::wstring language = L"en";
    NoteBackground noteBackground = NoteBackground::None;
    TerminalConfig terminal;
    TerminalTheme lightTheme;
    TerminalTheme darkTheme;
};

struct TodoItem {
    std::wstring id;
    std::wstring text;
    bool completed = false;
};

struct AlarmEntry {
    std::wstring id;
    std::wstring label;
    std::wstring time; // HH:mm
    std::vector<int> weekdays; // 0=Mon..6=Sun
    bool enabled = true;
};

} // namespace VTerminal
