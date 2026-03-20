# v-terminal Native Rewrite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite v-terminal from Tauri/React to WinUI 3 + C++/WinRT as a native Windows terminal application.

**Architecture:** Multi-project MSBuild solution with 5 projects (App, Terminal, Session, Toolkit, Core). MVVM pattern for UI. ConPTY for shell processes. DirectWrite/Direct2D for terminal rendering on SwapChainPanel.

**Tech Stack:** C++20, WinUI 3, C++/WinRT, ConPTY, DirectWrite/Direct2D, libssh2, nlohmann-json, vcpkg, MSBuild, Google Test

**Spec:** `docs/superpowers/specs/2026-03-21-v-terminal-native-rewrite-design.md`

**Prerequisites:** Windows 11, Visual Studio 2022 with C++ Desktop & WinUI workloads, Windows SDK 10.0.22621.0+, vcpkg installed and integrated.

---

## Phase 1: Foundation

### Task 1: Solution Scaffolding

**Files:**
- Create: `v-terminal.sln`
- Create: `v-terminal.App/v-terminal.App.vcxproj`
- Create: `v-terminal.App/App.xaml` + `App.xaml.h` + `App.xaml.cpp`
- Create: `v-terminal.App/Views/MainWindow.xaml` + `.xaml.h` + `.xaml.cpp`
- Create: `v-terminal.Terminal/v-terminal.Terminal.vcxproj`
- Create: `v-terminal.Session/v-terminal.Session.vcxproj`
- Create: `v-terminal.Toolkit/v-terminal.Toolkit.vcxproj`
- Create: `v-terminal.Core/v-terminal.Core.vcxproj`
- Create: `v-terminal.Tests/v-terminal.Tests.vcxproj`
- Create: `vcpkg.json`
- Create: `.gitignore`

- [ ] **Step 1: Create solution and App project**

Use Visual Studio 2022 → New Project → "Blank App, Packaged (WinUI 3 in Desktop)" C++. Name: `v-terminal.App`. Solution name: `v-terminal`.

- [ ] **Step 2: Add static library projects**

Add 4 C++ Static Library projects to the solution:
- `v-terminal.Core`
- `v-terminal.Terminal`
- `v-terminal.Session`
- `v-terminal.Toolkit`

Set all to C++20 standard (`/std:c++20`), Windows SDK 10.0.22621.0.

- [ ] **Step 3: Configure project references**

In Solution Explorer, add project references:
- `v-terminal.App` → references `Terminal`, `Session`, `Toolkit`, `Core`
- `v-terminal.Terminal` → references `Core`
- `v-terminal.Session` → references `Terminal`, `Core`
- `v-terminal.Toolkit` → references `Core`

- [ ] **Step 4: Set up vcpkg manifest**

Create `vcpkg.json` at solution root:

```json
{
  "name": "v-terminal",
  "version": "2.0.0",
  "dependencies": [
    "nlohmann-json",
    "libssh2",
    "gtest"
  ]
}
```

- [ ] **Step 5: Add test project**

Add a Google Test project: `v-terminal.Tests`. Reference all library projects. Verify it builds and runs an empty test.

- [ ] **Step 6: Configure .gitignore and verify build**

```gitignore
# Build
x64/
Debug/
Release/
*.user
*.suo
*.db
*.opendb
.vs/
packages/
```

Run: Build Solution (Ctrl+Shift+B). Expected: clean build, 0 errors. The App project should launch an empty window.

- [ ] **Step 7: Commit**

```bash
git init
git add -A
git commit -m "feat: scaffold solution with 5 projects and test infrastructure"
```

---

### Task 2: Core — Types and JsonStore

**Files:**
- Create: `v-terminal.Core/Types.h`
- Create: `v-terminal.Core/JsonStore.h`
- Create: `v-terminal.Core/JsonStore.cpp`
- Test: `v-terminal.Tests/JsonStoreTests.cpp`

- [ ] **Step 1: Write Types.h**

```cpp
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
```

- [ ] **Step 2: Write failing JsonStore test**

```cpp
#include <gtest/gtest.h>
#include "JsonStore.h"
#include <filesystem>

namespace fs = std::filesystem;

class JsonStoreTest : public ::testing::Test {
protected:
    fs::path testDir;
    void SetUp() override {
        testDir = fs::temp_directory_path() / "v-terminal-test";
        fs::create_directories(testDir);
    }
    void TearDown() override {
        fs::remove_all(testDir);
    }
};

TEST_F(JsonStoreTest, SaveAndLoad) {
    VTerminal::JsonStore store(testDir / "test.json");
    nlohmann::json data = {{"key", "value"}, {"number", 42}};
    store.save(data);

    auto loaded = store.load();
    ASSERT_TRUE(loaded.has_value());
    EXPECT_EQ(loaded.value()["key"], "value");
    EXPECT_EQ(loaded.value()["number"], 42);
}

TEST_F(JsonStoreTest, LoadMissingFileReturnsNullopt) {
    VTerminal::JsonStore store(testDir / "nonexistent.json");
    auto loaded = store.load();
    EXPECT_FALSE(loaded.has_value());
}

TEST_F(JsonStoreTest, CorruptedFileBacksUpAndReturnsNullopt) {
    auto path = testDir / "corrupt.json";
    std::ofstream(path) << "not valid json {{{";

    VTerminal::JsonStore store(path);
    auto loaded = store.load();
    EXPECT_FALSE(loaded.has_value());
    EXPECT_TRUE(fs::exists(testDir / "corrupt.json.bak"));
}
```

- [ ] **Step 3: Run test to verify it fails**

Run: `v-terminal.Tests.exe --gtest_filter=JsonStore*`
Expected: FAIL — `JsonStore.h` not found.

- [ ] **Step 4: Implement JsonStore**

```cpp
// JsonStore.h
#pragma once
#include <filesystem>
#include <optional>
#include <nlohmann/json.hpp>

namespace VTerminal {

class JsonStore {
public:
    explicit JsonStore(std::filesystem::path filePath);
    std::optional<nlohmann::json> load();
    void save(const nlohmann::json& data);

private:
    std::filesystem::path m_filePath;
};

} // namespace VTerminal
```

```cpp
// JsonStore.cpp
#include "JsonStore.h"
#include <fstream>

namespace VTerminal {

JsonStore::JsonStore(std::filesystem::path filePath)
    : m_filePath(std::move(filePath)) {}

std::optional<nlohmann::json> JsonStore::load() {
    if (!std::filesystem::exists(m_filePath)) {
        return std::nullopt;
    }
    try {
        std::ifstream file(m_filePath);
        return nlohmann::json::parse(file);
    } catch (const nlohmann::json::parse_error&) {
        auto bakPath = m_filePath;
        bakPath += ".bak";
        std::filesystem::rename(m_filePath, bakPath);
        return std::nullopt;
    }
}

void JsonStore::save(const nlohmann::json& data) {
    auto dir = m_filePath.parent_path();
    if (!dir.empty()) {
        std::filesystem::create_directories(dir);
    }
    // Atomic write: write to temp, then rename (atomic on NTFS)
    auto tmpPath = m_filePath;
    tmpPath += L".tmp";
    {
        std::ofstream file(tmpPath);
        file << data.dump(2);
    }
    std::filesystem::rename(tmpPath, m_filePath);
}

} // namespace VTerminal
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `v-terminal.Tests.exe --gtest_filter=JsonStore*`
Expected: 3 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add v-terminal.Core/ v-terminal.Tests/JsonStoreTests.cpp
git commit -m "feat(core): add Types and JsonStore with JSON file persistence"
```

---

### Task 3: Core — Settings Manager

**Files:**
- Create: `v-terminal.Core/Settings.h`
- Create: `v-terminal.Core/Settings.cpp`
- Test: `v-terminal.Tests/SettingsTests.cpp`

- [ ] **Step 1: Write failing Settings test**

```cpp
#include <gtest/gtest.h>
#include "Settings.h"
#include <filesystem>

class SettingsTest : public ::testing::Test {
protected:
    std::filesystem::path testDir;
    void SetUp() override {
        testDir = std::filesystem::temp_directory_path() / "v-terminal-settings-test";
        std::filesystem::create_directories(testDir);
    }
    void TearDown() override {
        std::filesystem::remove_all(testDir);
    }
};

TEST_F(SettingsTest, DefaultSettingsOnFirstRun) {
    VTerminal::Settings settings(testDir);
    auto config = settings.getAppSettings();
    EXPECT_EQ(config.theme, L"auto");
    EXPECT_EQ(config.terminal.fontFamily, L"JetBrains Mono");
    EXPECT_EQ(config.terminal.fontSize, 14);
}

TEST_F(SettingsTest, SaveAndReload) {
    {
        VTerminal::Settings settings(testDir);
        auto config = settings.getAppSettings();
        config.theme = L"dark";
        config.terminal.fontSize = 18;
        settings.setAppSettings(config);
    }
    {
        VTerminal::Settings settings(testDir);
        auto config = settings.getAppSettings();
        EXPECT_EQ(config.theme, L"dark");
        EXPECT_EQ(config.terminal.fontSize, 18);
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `v-terminal.Tests.exe --gtest_filter=Settings*`
Expected: FAIL.

- [ ] **Step 3: Implement Settings**

`Settings` wraps `JsonStore` for `settings.json`. Provides typed access to `AppSettings` with serialization to/from JSON. Constructor takes a directory path, loads `settings.json` from it (or creates defaults).

- [ ] **Step 4: Run tests to verify they pass**

Run: `v-terminal.Tests.exe --gtest_filter=Settings*`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add v-terminal.Core/Settings.* v-terminal.Tests/SettingsTests.cpp
git commit -m "feat(core): add Settings manager with typed AppSettings"
```

---

### Task 4: Core — EventBus

**Files:**
- Create: `v-terminal.Core/EventBus.h`
- Create: `v-terminal.Core/EventBus.cpp`
- Test: `v-terminal.Tests/EventBusTests.cpp`

- [ ] **Step 1: Write failing EventBus test**

```cpp
#include <gtest/gtest.h>
#include "EventBus.h"
#include <string>

TEST(EventBusTest, SubscribeAndPublish) {
    VTerminal::EventBus bus;
    std::string received;

    bus.subscribe<std::string>("test-event", [&](const std::string& data) {
        received = data;
    });

    bus.publish("test-event", std::string("hello"));
    EXPECT_EQ(received, "hello");
}

TEST(EventBusTest, Unsubscribe) {
    VTerminal::EventBus bus;
    int count = 0;

    auto id = bus.subscribe<int>("counter", [&](const int& val) {
        count += val;
    });

    bus.publish("counter", 1);
    bus.unsubscribe(id);
    bus.publish("counter", 1);

    EXPECT_EQ(count, 1);
}
```

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Implement EventBus**

Type-erased pub/sub with `std::any`. Subscription returns an ID for unsubscribing. For UI thread dispatch in production, the caller wraps callbacks with `DispatcherQueue.TryEnqueue()` — the EventBus itself is thread-agnostic in the Core library.

- [ ] **Step 4: Run tests to verify they pass**

- [ ] **Step 5: Commit**

```bash
git add v-terminal.Core/EventBus.* v-terminal.Tests/EventBusTests.cpp
git commit -m "feat(core): add EventBus pub/sub for component communication"
```

---

## Phase 2: Terminal Engine

### Task 5: Terminal — ConPtyProcess

**Files:**
- Create: `v-terminal.Terminal/ConPtyProcess.h`
- Create: `v-terminal.Terminal/ConPtyProcess.cpp`
- Test: `v-terminal.Tests/ConPtyProcessTests.cpp`

- [ ] **Step 1: Write integration test for ConPTY**

```cpp
#include <gtest/gtest.h>
#include "ConPtyProcess.h"
#include <thread>
#include <chrono>

TEST(ConPtyProcessTest, SpawnAndReceiveOutput) {
    VTerminal::ConPtyProcess proc;
    std::string output;

    proc.onData([&](const std::string& data) {
        output += data;
    });

    bool started = proc.start(L"cmd.exe", {}, L".", 80, 24);
    ASSERT_TRUE(started);

    proc.write("echo hello\r\n");
    std::this_thread::sleep_for(std::chrono::milliseconds(500));

    EXPECT_TRUE(output.find("hello") != std::string::npos);
    proc.kill();
}

TEST(ConPtyProcessTest, Resize) {
    VTerminal::ConPtyProcess proc;
    bool started = proc.start(L"cmd.exe", {}, L".", 80, 24);
    ASSERT_TRUE(started);

    bool resized = proc.resize(120, 40);
    EXPECT_TRUE(resized);

    proc.kill();
}
```

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Implement ConPtyProcess**

```cpp
// ConPtyProcess.h
#pragma once
#include <Windows.h>
#include <string>
#include <functional>
#include <thread>
#include <atomic>

namespace VTerminal {

class ConPtyProcess {
public:
    ConPtyProcess();
    ~ConPtyProcess();

    bool start(const std::wstring& program,
               const std::vector<std::wstring>& args,
               const std::wstring& cwd,
               short cols, short rows);
    void write(const std::string& data);
    bool resize(short cols, short rows);
    void kill();

    void onData(std::function<void(const std::string&)> callback);
    void onExit(std::function<void(int exitCode)> callback);

private:
    void readLoop();

    HPCON m_hPC = nullptr;
    // Two pipe pairs for ConPTY:
    // Pair 1: App writes → PTY reads (PTY input)
    HANDLE m_ptyInputRead = INVALID_HANDLE_VALUE;   // passed to CreatePseudoConsole
    HANDLE m_ptyInputWrite = INVALID_HANDLE_VALUE;  // app writes to this
    // Pair 2: PTY writes → App reads (PTY output)
    HANDLE m_ptyOutputRead = INVALID_HANDLE_VALUE;  // app reads from this (in readLoop)
    HANDLE m_ptyOutputWrite = INVALID_HANDLE_VALUE; // passed to CreatePseudoConsole
    HANDLE m_processHandle = INVALID_HANDLE_VALUE;
    std::thread m_readThread;
    std::atomic<bool> m_running{false};

    std::function<void(const std::string&)> m_onData;
    std::function<void(int)> m_onExit;
};

} // namespace VTerminal
```

Key implementation details:
- `CreatePipe(&m_ptyInputRead, &m_ptyInputWrite, ...)` for PTY input
- `CreatePipe(&m_ptyOutputRead, &m_ptyOutputWrite, ...)` for PTY output
- `CreatePseudoConsole(size, m_ptyInputRead, m_ptyOutputWrite, 0, &m_hPC)`
- Close `m_ptyInputRead` and `m_ptyOutputWrite` after creating pseudo console (PTY owns these ends)
- `STARTUPINFOEX` with `PROC_THREAD_ATTRIBUTE_PSEUDOCONSOLE`
- `CreateProcess()` to spawn shell
- Dedicated read thread calls `ReadFile(m_ptyOutputRead, ...)` in loop, invokes `m_onData`
- App writes via `WriteFile(m_ptyInputWrite, ...)`
- `kill()` closes pseudo console, terminates process, joins thread

- [ ] **Step 4: Run tests to verify they pass**

Run: `v-terminal.Tests.exe --gtest_filter=ConPtyProcess*`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add v-terminal.Terminal/ConPtyProcess.* v-terminal.Tests/ConPtyProcessTests.cpp
git commit -m "feat(terminal): add ConPtyProcess for Windows Pseudo Console management"
```

---

### Task 6: Terminal — TerminalBuffer

**Files:**
- Create: `v-terminal.Terminal/TerminalBuffer.h`
- Create: `v-terminal.Terminal/TerminalBuffer.cpp`
- Test: `v-terminal.Tests/TerminalBufferTests.cpp`

- [ ] **Step 1: Write failing tests**

```cpp
TEST(TerminalBufferTest, InitializesWithCorrectDimensions) {
    VTerminal::TerminalBuffer buf(80, 24, 1000);
    EXPECT_EQ(buf.cols(), 80);
    EXPECT_EQ(buf.rows(), 24);
}

TEST(TerminalBufferTest, WriteCharacterAtCursor) {
    VTerminal::TerminalBuffer buf(80, 24, 1000);
    buf.writeChar(0, 0, L'A', {});
    auto cell = buf.getCell(0, 0);
    EXPECT_EQ(cell.character, L'A');
}

TEST(TerminalBufferTest, ScrollbackPushesLinesUp) {
    VTerminal::TerminalBuffer buf(80, 3, 100);
    // Fill 3 visible rows, then scroll — first row goes to scrollback
    for (int row = 0; row < 3; ++row)
        buf.writeChar(row, 0, L'0' + row, {});
    buf.scrollUp(1);
    EXPECT_EQ(buf.scrollbackSize(), 1);
}

TEST(TerminalBufferTest, ResizePreservesContent) {
    VTerminal::TerminalBuffer buf(80, 24, 1000);
    buf.writeChar(0, 0, L'X', {});
    buf.resize(120, 40);
    EXPECT_EQ(buf.cols(), 120);
    EXPECT_EQ(buf.rows(), 40);
    EXPECT_EQ(buf.getCell(0, 0).character, L'X');
}

TEST(TerminalBufferTest, DirtyRegionTracking) {
    VTerminal::TerminalBuffer buf(80, 24, 1000);
    buf.writeChar(5, 10, L'Z', {});
    auto dirty = buf.getDirtyRows();
    EXPECT_TRUE(dirty.count(5) > 0);
    buf.clearDirty();
    EXPECT_TRUE(buf.getDirtyRows().empty());
}
```

- [ ] **Step 2: Run tests to verify they fail**

- [ ] **Step 3: Implement TerminalBuffer**

Cell struct: `wchar_t character`, `uint32_t fgColor`, `uint32_t bgColor`, `uint8_t attributes` (bold/italic/underline bitmask). Grid is `vector<vector<Cell>>`. Scrollback is `deque<vector<Cell>>` capped at max lines. Dirty tracking via `set<int>` of row indices.

**Thread safety:** TerminalBuffer is written from I/O thread and read from UI thread. Use `std::shared_mutex` — I/O thread takes exclusive lock for writes, UI thread takes shared lock for reads. All public methods must acquire the appropriate lock. Add `lockForRead()`/`unlockRead()` RAII wrapper or use `std::shared_lock`/`std::unique_lock` internally.

- [ ] **Step 4: Run tests to verify they pass**

- [ ] **Step 5: Commit**

```bash
git add v-terminal.Terminal/TerminalBuffer.* v-terminal.Tests/TerminalBufferTests.cpp
git commit -m "feat(terminal): add TerminalBuffer with cell grid and scrollback"
```

---

### Task 7: Terminal — VtParser Integration

**Files:**
- Create: `v-terminal.Terminal/VtParser.h`
- Create: `v-terminal.Terminal/VtParser.cpp`
- Test: `v-terminal.Tests/VtParserTests.cpp`

- [ ] **Step 1: Add libvterm via vcpkg**

Use libvterm as the primary VT parser (proven, lightweight, available via vcpkg). microsoft/terminal core extraction is a future optimization if needed.

Add to `vcpkg.json`:
```json
"libvterm"
```

Run: `vcpkg install` and verify libvterm headers are available.

- [ ] **Step 2: Write failing VtParser test**

```cpp
TEST(VtParserTest, PlainTextUpdatesBuffer) {
    VTerminal::TerminalBuffer buf(80, 24, 1000);
    VTerminal::VtParser parser(buf);
    parser.feed("Hello");
    EXPECT_EQ(buf.getCell(0, 0).character, L'H');
    EXPECT_EQ(buf.getCell(0, 4).character, L'o');
}

TEST(VtParserTest, NewlineMovesToNextRow) {
    VTerminal::TerminalBuffer buf(80, 24, 1000);
    VTerminal::VtParser parser(buf);
    parser.feed("A\r\nB");
    EXPECT_EQ(buf.getCell(0, 0).character, L'A');
    EXPECT_EQ(buf.getCell(1, 0).character, L'B');
}

TEST(VtParserTest, SgrColorSequence) {
    VTerminal::TerminalBuffer buf(80, 24, 1000);
    VTerminal::VtParser parser(buf);
    // ESC[31m = red foreground
    parser.feed("\x1b[31mR");
    auto cell = buf.getCell(0, 0);
    EXPECT_EQ(cell.character, L'R');
    // Verify foreground is ANSI red (index 1)
    EXPECT_EQ(cell.fgColor, 1u);
}

TEST(VtParserTest, CursorMovement) {
    VTerminal::TerminalBuffer buf(80, 24, 1000);
    VTerminal::VtParser parser(buf);
    // ESC[3;5H = move cursor to row 3, col 5 (1-based)
    parser.feed("\x1b[3;5HX");
    EXPECT_EQ(buf.getCell(2, 4).character, L'X');
}
```

- [ ] **Step 3: Run tests to verify they fail**

- [ ] **Step 4: Implement VtParser**

`VtParser` wraps the chosen VT parsing library and translates parsed events into `TerminalBuffer` operations. Maintains cursor position (row, col) and current SGR attributes. Handles: plain text output, CR/LF, CSI sequences (cursor movement, erase, SGR colors), and scrolling.

```cpp
// VtParser.h
#pragma once
#include "TerminalBuffer.h"
#include <string>

namespace VTerminal {

class VtParser {
public:
    explicit VtParser(TerminalBuffer& buffer);
    void feed(const std::string& data);

private:
    void handleChar(char c);
    void handleEscapeSequence();
    void handleCsiSequence();
    void handleSgr(const std::vector<int>& params);

    TerminalBuffer& m_buffer;
    int m_cursorRow = 0;
    int m_cursorCol = 0;
    uint32_t m_currentFg = 7;  // default white
    uint32_t m_currentBg = 0;  // default black
    uint8_t m_currentAttrs = 0;

    enum class State { Normal, Escape, Csi };
    State m_state = State::Normal;
    std::string m_csiBuffer;
};

} // namespace VTerminal
```

- [ ] **Step 5: Run tests to verify they pass**

- [ ] **Step 6: Commit**

```bash
git add v-terminal.Terminal/VtParser.* v-terminal.Tests/VtParserTests.cpp
git commit -m "feat(terminal): add VtParser for VT sequence processing"
```

---

### Task 8: Terminal — TerminalRenderer (DirectWrite/Direct2D)

**Files:**
- Create: `v-terminal.Terminal/TerminalRenderer.h`
- Create: `v-terminal.Terminal/TerminalRenderer.cpp`

Note: Renderer requires a D2D render target (SwapChainPanel), so testing is manual/visual. No unit tests for this task.

- [ ] **Step 1: Implement TerminalRenderer**

```cpp
// TerminalRenderer.h
#pragma once
#include "TerminalBuffer.h"
#include <d2d1_1.h>
#include <dwrite_3.h>
#include <dxgi1_3.h>
#include <wrl/client.h>
#include <string>
#include <unordered_map>

namespace VTerminal {

struct RendererConfig {
    std::wstring fontFamily = L"JetBrains Mono";
    float fontSize = 14.0f;
    float lineHeight = 1.2f;
    bool cursorBlink = true;
    CursorStyle cursorStyle = CursorStyle::Block;
};

class TerminalRenderer {
public:
    TerminalRenderer();
    ~TerminalRenderer();

    bool initialize(ISwapChainPanelNative* panelNative, float width, float height);
    void setConfig(const RendererConfig& config);
    void setTheme(const TerminalTheme& theme);
    void render(const TerminalBuffer& buffer, int cursorRow, int cursorCol);
    void resize(float width, float height);

    float cellWidth() const { return m_cellWidth; }
    float cellHeight() const { return m_cellHeight; }

private:
    void createDeviceResources();
    void renderCell(const TerminalBuffer::Cell& cell, int row, int col);
    void renderCursor(int row, int col);
    ID2D1SolidColorBrush* getBrush(uint32_t color);

    Microsoft::WRL::ComPtr<ID2D1Factory1> m_d2dFactory;
    Microsoft::WRL::ComPtr<ID2D1Device> m_d2dDevice;
    Microsoft::WRL::ComPtr<ID2D1DeviceContext> m_d2dContext;
    Microsoft::WRL::ComPtr<IDXGISwapChain2> m_swapChain;
    Microsoft::WRL::ComPtr<IDWriteFactory3> m_dwriteFactory;
    Microsoft::WRL::ComPtr<IDWriteTextFormat> m_textFormat;

    // Glyph cache: character -> cached bitmap
    std::unordered_map<wchar_t, Microsoft::WRL::ComPtr<ID2D1Bitmap>> m_glyphCache;

    RendererConfig m_config;
    TerminalTheme m_theme;
    float m_cellWidth = 0;
    float m_cellHeight = 0;
};

} // namespace VTerminal
```

Key implementation:
- Create DXGI swap chain bound to `SwapChainPanel`
- `IDWriteFactory3::CreateTextFormat()` for font configuration
- Measure cell size from font metrics (`IDWriteFontFace::GetDesignGlyphMetrics`)
- `render()`: iterate dirty rows, draw background rect with `FillRectangle`, draw text with `DrawGlyphRun`
- Ligature support: use `IDWriteTextLayout` with OpenType features enabled
- CJK: check `GetUnicodeCategory` for East Asian Width, render across 2 cells
- Cursor: draw Block/Underline/Bar shape at cursor position

- [ ] **Step 2: Verify it compiles**

Build the Terminal project. Expected: 0 errors. No runtime test yet — visual verification happens in Task 12.

- [ ] **Step 3: Commit**

```bash
git add v-terminal.Terminal/TerminalRenderer.*
git commit -m "feat(terminal): add DirectWrite/Direct2D terminal renderer"
```

---

## Phase 3: Session Management

### Task 9: Session — ISession Interface and LocalSession

**Files:**
- Create: `v-terminal.Session/ISession.h`
- Create: `v-terminal.Session/SessionManager.h`
- Create: `v-terminal.Session/SessionManager.cpp`
- Create: `v-terminal.Session/LocalSession.h`
- Create: `v-terminal.Session/LocalSession.cpp`
- Test: `v-terminal.Tests/SessionManagerTests.cpp`

- [ ] **Step 1: Write ISession interface**

```cpp
// ISession.h
#pragma once
#include "Types.h"
#include <functional>
#include <string>

namespace VTerminal {

class ISession {
public:
    virtual ~ISession() = default;
    virtual bool start(short cols, short rows) = 0;
    virtual void write(const std::string& data) = 0;
    virtual bool resize(short cols, short rows) = 0;
    virtual void kill() = 0;

    void onData(std::function<void(const std::string&)> cb) { m_onData = std::move(cb); }
    void onExit(std::function<void(int)> cb) { m_onExit = std::move(cb); }

protected:
    std::function<void(const std::string&)> m_onData;
    std::function<void(int)> m_onExit;
};

} // namespace VTerminal
```

- [ ] **Step 2: Write failing SessionManager test**

```cpp
TEST(SessionManagerTest, CreateLocalSession) {
    VTerminal::SessionManager mgr;
    auto id = mgr.createSession(VTerminal::SessionType::Local, {});
    EXPECT_FALSE(id.empty());
    EXPECT_TRUE(mgr.hasSession(id));
}

TEST(SessionManagerTest, KillSession) {
    VTerminal::SessionManager mgr;
    auto id = mgr.createSession(VTerminal::SessionType::Local, {});
    mgr.killSession(id);
    EXPECT_FALSE(mgr.hasSession(id));
}
```

- [ ] **Step 3: Run tests to verify they fail**

- [ ] **Step 4: Implement LocalSession and SessionManager**

`LocalSession` wraps `ConPtyProcess`. `SessionManager` holds `map<SessionId, unique_ptr<ISession>>`, generates UUID via `CoCreateGuid()`.

- [ ] **Step 5: Run tests to verify they pass**

- [ ] **Step 6: Commit**

```bash
git add v-terminal.Session/ v-terminal.Tests/SessionManagerTests.cpp
git commit -m "feat(session): add SessionManager and LocalSession"
```

---

### Task 10: Session — SshSession with Connection Pooling

**Files:**
- Create: `v-terminal.Session/SshSession.h`
- Create: `v-terminal.Session/SshSession.cpp`
- Create: `v-terminal.Session/SshConnectionPool.h`
- Create: `v-terminal.Session/SshConnectionPool.cpp`

- [ ] **Step 1: Implement SshConnectionPool**

```cpp
// SshConnectionPool.h
#pragma once
#include <libssh2.h>
#include <string>
#include <unordered_map>
#include <mutex>
#include <memory>
#include <thread>

namespace VTerminal {

struct SshConnectionKey {
    std::string host;
    int port;
    std::string username;
    bool operator==(const SshConnectionKey&) const = default;
};

// Hash for SshConnectionKey
struct SshConnectionKeyHash {
    size_t operator()(const SshConnectionKey& k) const;
};

struct SshConnection {
    LIBSSH2_SESSION* session = nullptr;
    SOCKET socket = INVALID_SOCKET;  // WinSock2 SOCKET type (64-bit safe)
    std::thread ioThread;
    int channelCount = 0;
};

class SshConnectionPool {
public:
    ~SshConnectionPool();
    // Returns existing or creates new connection. Increments channel count.
    SshConnection* acquire(const SshConnectionKey& key,
                           const std::string& password = "",
                           const std::string& identityFile = "");
    // Decrements channel count. Closes connection when count reaches 0.
    void release(const SshConnectionKey& key);

private:
    std::unordered_map<SshConnectionKey, std::unique_ptr<SshConnection>, SshConnectionKeyHash> m_pool;
    std::mutex m_mutex;
};

} // namespace VTerminal
```

- [ ] **Step 2: Implement SshSession**

`SshSession` implements `ISession`. Uses `SshConnectionPool::acquire()` to get a connection, opens a channel with `libssh2_channel_open_session()`, requests PTY with `libssh2_channel_request_pty("xterm-256color")`, starts shell with `libssh2_channel_shell()`. Data read on the connection's I/O thread via `libssh2_channel_read()`.

- [ ] **Step 3: Verify it compiles**

No automated test (requires SSH server). Manual test will happen after UI integration.

- [ ] **Step 4: Commit**

```bash
git add v-terminal.Session/Ssh*
git commit -m "feat(session): add SshSession with connection pooling"
```

---

### Task 11: Session — WslSession

**Files:**
- Create: `v-terminal.Session/WslSession.h`
- Create: `v-terminal.Session/WslSession.cpp`
- Create: `v-terminal.Session/WslHelper.h`
- Create: `v-terminal.Session/WslHelper.cpp`
- Test: `v-terminal.Tests/WslHelperTests.cpp`

- [ ] **Step 1: Implement WslHelper**

```cpp
// WslHelper.h
#pragma once
#include <vector>
#include <string>

namespace VTerminal {

class WslHelper {
public:
    // Runs "wsl --list --quiet" and parses output
    static std::vector<std::wstring> getDistros();
};

} // namespace VTerminal
```

- [ ] **Step 2: Implement WslSession**

`WslSession` extends `ISession`. Internally creates a `ConPtyProcess` with program `wsl.exe` and args `{"-d", distroName, "--cd", "~"}`. Delegates all operations (write, resize, kill) to the inner `ConPtyProcess`.

- [ ] **Step 3: Write WslHelper test (conditional)**

```cpp
TEST(WslHelperTest, GetDistrosReturnsNonEmpty) {
    auto distros = VTerminal::WslHelper::getDistros();
    // This test only passes on machines with WSL installed
    // Skip gracefully if WSL is not available
    if (distros.empty()) {
        GTEST_SKIP() << "WSL not available";
    }
    EXPECT_FALSE(distros[0].empty());
}
```

- [ ] **Step 4: Commit**

```bash
git add v-terminal.Session/Wsl* v-terminal.Tests/WslHelperTests.cpp
git commit -m "feat(session): add WslSession with distro detection"
```

---

## Phase 4: App Shell

### Task 12: App — MainWindow with TerminalPane

**Files:**
- Modify: `v-terminal.App/Views/MainWindow.xaml`
- Modify: `v-terminal.App/Views/MainWindow.xaml.h`
- Modify: `v-terminal.App/Views/MainWindow.xaml.cpp`
- Create: `v-terminal.App/Views/TerminalPane.xaml` + `.xaml.h` + `.xaml.cpp`
- Create: `v-terminal.App/ViewModels/TerminalPaneViewModel.h` + `.cpp`

This is the first visual integration point — a single terminal panel rendering shell output.

- [ ] **Step 1: Create TerminalPane XAML**

```xml
<!-- TerminalPane.xaml -->
<UserControl x:Class="VTerminal.App.Views.TerminalPane"
    xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
    xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
    <Grid>
        <SwapChainPanel x:Name="TerminalSwapChain"
                        SizeChanged="OnSizeChanged"
                        PointerPressed="OnPointerPressed" />
        <!-- Error/restart overlay, hidden by default -->
        <StackPanel x:Name="ErrorOverlay" Visibility="Collapsed"
                    HorizontalAlignment="Center" VerticalAlignment="Center">
            <TextBlock x:Name="ErrorText" />
            <Button Content="Restart" Click="OnRestartClick" />
        </StackPanel>
    </Grid>
</UserControl>
```

- [ ] **Step 2: Wire TerminalPane to Terminal engine**

In `TerminalPane.xaml.cpp`:
- On load: create `TerminalBuffer`, `VtParser`, `TerminalRenderer`
- Initialize renderer with `SwapChainPanel`'s `ISwapChainPanelNative`
- Create a `LocalSession` via `SessionManager`
- Session `onData` → `VtParser::feed()` → renderer re-render dirty regions
- `KeyDown` event → translate to VT bytes → `session.write()`
- `SizeChanged` → calculate new cols/rows from panel size and cell dimensions → `session.resize()` + `buffer.resize()`

- [ ] **Step 3: Add TerminalPane to MainWindow**

```xml
<!-- MainWindow.xaml (minimal, single pane for now) -->
<Window x:Class="VTerminal.App.Views.MainWindow"
    xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
    xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
    xmlns:local="using:VTerminal.App.Views">
    <Grid>
        <local:TerminalPane x:Name="MainTerminal" />
    </Grid>
</Window>
```

- [ ] **Step 4: Build, launch, and verify**

Run the app. Expected: a window opens with a working cmd.exe terminal. You can type commands and see output rendered with DirectWrite.

- [ ] **Step 5: Commit**

```bash
git add v-terminal.App/Views/ v-terminal.App/ViewModels/
git commit -m "feat(app): add TerminalPane with full rendering pipeline"
```

---

### Task 13: App — Custom TitleBar

**Files:**
- Modify: `v-terminal.App/Views/MainWindow.xaml`
- Modify: `v-terminal.App/Views/MainWindow.xaml.h`
- Modify: `v-terminal.App/Views/MainWindow.xaml.cpp`

- [ ] **Step 1: Implement custom title bar**

```xml
<!-- Add to MainWindow.xaml, top of root Grid -->
<Grid x:Name="AppTitleBar" Height="32" VerticalAlignment="Top">
    <Grid.ColumnDefinitions>
        <ColumnDefinition Width="Auto" />  <!-- App icon -->
        <ColumnDefinition Width="*" />     <!-- Drag region -->
        <ColumnDefinition Width="Auto" />  <!-- Window buttons area (system) -->
    </Grid.ColumnDefinitions>
    <Image Source="/Assets/app-icon.png" Width="16" Height="16" Margin="8,0" />
    <TextBlock Grid.Column="0" Text="v-terminal" VerticalAlignment="Center"
               Margin="32,0,0,0" Style="{StaticResource CaptionTextBlockStyle}" />
</Grid>
```

In code-behind:
```cpp
// MainWindow.xaml.cpp constructor
ExtendsContentIntoTitleBar(true);
SetTitleBar(AppTitleBar());
```

- [ ] **Step 2: Verify custom title bar renders**

Run app. Expected: custom title bar with "v-terminal" text, system minimize/maximize/close buttons on right.

- [ ] **Step 3: Commit**

```bash
git add v-terminal.App/Views/MainWindow.*
git commit -m "feat(app): add custom title bar"
```

---

### Task 14: App — TabBar

**Files:**
- Create: `v-terminal.App/Views/TabBar.xaml` + `.xaml.h` + `.xaml.cpp`
- Create: `v-terminal.App/ViewModels/TabViewModel.h` + `.cpp`
- Modify: `v-terminal.App/Views/MainWindow.xaml`

- [ ] **Step 1: Create TabBar XAML**

Horizontal tab strip below title bar. Each tab: label text + close button. "+" button at the end for new tab. Double-click tab label to rename.

```xml
<UserControl x:Class="VTerminal.App.Views.TabBar">
    <Grid Height="36">
        <ScrollViewer HorizontalScrollBarVisibility="Auto"
                      VerticalScrollBarVisibility="Disabled">
            <StackPanel x:Name="TabList" Orientation="Horizontal" />
        </ScrollViewer>
        <Button x:Name="NewTabButton" Content="+" Click="OnNewTab"
                HorizontalAlignment="Right" Width="36" Height="36" />
    </Grid>
</UserControl>
```

- [ ] **Step 2: Implement TabViewModel**

```cpp
struct TabViewModel {
    std::wstring id;        // UUID
    std::wstring label;
    int layout = 1;
    bool isBroadcast = false;
    std::vector<PanelConnection> panels;
};
```

Methods: `addTab()`, `removeTab(id)`, `setActiveTab(id)`, `renameTab(id, label)`.

- [ ] **Step 3: Wire TabBar to MainWindow**

Add `TabBar` to `MainWindow.xaml` between title bar and content area. Tab selection changes which panels are displayed. New tab creates a single-panel layout with default local shell.

- [ ] **Step 4: Verify tabs work**

Run app. Expected: single tab visible, "+" creates new tabs, clicking tabs switches content, close button removes tabs (prevents closing last tab).

- [ ] **Step 5: Commit**

```bash
git add v-terminal.App/Views/TabBar.* v-terminal.App/ViewModels/Tab*
git commit -m "feat(app): add TabBar with tab management"
```

---

### Task 15: App — Layout System and PanelGrid

**Files:**
- Create: `v-terminal.App/Views/PanelGrid.xaml` + `.xaml.h` + `.xaml.cpp`
- Create: `v-terminal.App/Views/SplitToolbar.xaml` + `.xaml.h` + `.xaml.cpp`
- Create: `v-terminal.App/ViewModels/LayoutManager.h` + `.cpp`

- [ ] **Step 1: Implement LayoutManager**

```cpp
// LayoutManager.h
#pragma once
#include <vector>
#include <utility>

namespace VTerminal {

struct GridSlot {
    int row, col, rowSpan, colSpan;
};

struct LayoutPreset {
    int panelCount;
    int gridRows, gridCols;
    std::vector<GridSlot> slots;
};

class LayoutManager {
public:
    static const LayoutPreset& getPreset(int index); // 1-6
    static int panelCount(int presetIndex);
};

} // namespace VTerminal
```

Define 6 presets with exact grid definitions per spec:
- Preset 1: 1x1, [{0,0,1,1}]
- Preset 2: 1x2, [{0,0,1,1}, {0,1,1,1}]
- Preset 3: 2 rows x 2 cols, [{0,0,2,1}, {0,1,1,1}, {1,1,1,1}]
- Preset 4: 2x2, [{0,0,1,1}, {0,1,1,1}, {1,0,1,1}, {1,1,1,1}]
- Preset 5: 2 rows x 3 cols, [{0,0,2,1}, {0,1,1,1}, {0,2,1,1}, {1,1,1,1}, {1,2,1,1}] (left column spans 2 rows, 2x2 on right)
- Preset 6: 3x2, [{0,0,1,1}, {0,1,1,1}, {1,0,1,1}, {1,1,1,1}, {2,0,1,1}, {2,1,1,1}]

- [ ] **Step 2: Implement PanelGrid**

XAML `Grid` with dynamic `RowDefinitions`/`ColumnDefinitions`. On layout change:
1. Get new preset from LayoutManager
2. If new panel count < current: kill excess sessions
3. If new panel count > current: create new `TerminalPane` instances with default local shell
4. Re-assign `Grid.Row`/`Grid.Column`/`Grid.RowSpan`/`Grid.ColumnSpan` per preset slots

- [ ] **Step 3: Create SplitToolbar**

Horizontal toolbar below TabBar with:
- 6 layout preset buttons (icons representing each layout)
- Broadcast toggle button
- Toolkit sidebar toggle button

- [ ] **Step 4: Wire everything to MainWindow**

```xml
<!-- MainWindow.xaml structure -->
<Grid>
    <Grid.RowDefinitions>
        <RowDefinition Height="32" />  <!-- TitleBar -->
        <RowDefinition Height="36" />  <!-- TabBar -->
        <RowDefinition Height="36" />  <!-- SplitToolbar -->
        <RowDefinition Height="*" />   <!-- Content -->
    </Grid.RowDefinitions>
    <!-- TitleBar in Row 0 -->
    <!-- TabBar in Row 1 -->
    <!-- SplitToolbar in Row 2 -->
    <Grid Grid.Row="3">
        <Grid.ColumnDefinitions>
            <ColumnDefinition Width="*" />       <!-- PanelGrid -->
            <ColumnDefinition Width="Auto" />    <!-- SidePanel (toolkit) -->
        </Grid.ColumnDefinitions>
        <local:PanelGrid x:Name="PanelGrid" />
        <!-- SidePanel added in later task -->
    </Grid>
</Grid>
```

- [ ] **Step 5: Verify layout switching**

Run app. Expected: clicking layout buttons switches between 1-6 panel configurations. Each panel has a working terminal. Switching from 4 panels to 2 kills 2 sessions. Switching from 2 to 4 creates 2 new sessions.

- [ ] **Step 6: Commit**

```bash
git add v-terminal.App/Views/PanelGrid.* v-terminal.App/Views/SplitToolbar.* v-terminal.App/ViewModels/LayoutManager.*
git commit -m "feat(app): add layout system with 6 presets and panel grid"
```

---

### Task 16: App — Panel Context Menu and Connection Switching

**Files:**
- Modify: `v-terminal.App/Views/TerminalPane.xaml`
- Create: `v-terminal.App/Views/NotePane.xaml` + `.xaml.h` + `.xaml.cpp`

- [ ] **Step 1: Add context menu to TerminalPane**

```xml
<SwapChainPanel.ContextFlyout>
    <MenuFlyout>
        <MenuFlyoutItem Text="Local Shell" Click="OnSwitchLocal" />
        <MenuFlyoutSubItem Text="SSH">
            <!-- Dynamically populated from SSH profiles -->
        </MenuFlyoutSubItem>
        <MenuFlyoutSubItem Text="WSL">
            <!-- Dynamically populated from WSL distros -->
        </MenuFlyoutSubItem>
        <MenuFlyoutSeparator />
        <MenuFlyoutItem Text="Note" Click="OnSwitchNote" />
    </MenuFlyout>
</SwapChainPanel.ContextFlyout>
```

- [ ] **Step 2: Implement connection switching**

On switch: kill current session, create new session of selected type, rebind data callbacks.

- [ ] **Step 3: Implement NotePane**

Simple `RichEditBox` or `TextBox` with `AcceptsReturn="True"` for markdown editing. Background style (ruled/grid/dots) rendered as overlay via Direct2D or XAML shapes.

- [ ] **Step 4: Verify context menu and switching**

Run app. Right-click a panel → select "Note" → panel switches to note editor. Right-click → "Local Shell" → switches back to terminal.

- [ ] **Step 5: Commit**

```bash
git add v-terminal.App/Views/TerminalPane.* v-terminal.App/Views/NotePane.*
git commit -m "feat(app): add panel context menu and connection switching"
```

---

### Task 17: App — Zoom Mode and Broadcast

**Files:**
- Modify: `v-terminal.App/Views/PanelGrid.xaml.cpp`
- Modify: `v-terminal.App/Views/SplitToolbar.xaml.cpp`

- [ ] **Step 1: Implement zoom mode**

Add `zoomPanel(panelIndex)` to PanelGrid. Hides all panels except the selected one, sets it to fill the entire grid. Other panels' sessions keep running. `unzoom()` restores the previous layout.

- [ ] **Step 2: Implement broadcast mode**

When broadcast is enabled on the tab, `TerminalPane.KeyDown` handler writes input to ALL panels' sessions in the current tab (not just the focused one).

- [ ] **Step 3: Verify**

Run app with 4-panel layout. Zoom one panel — it fills the screen. Unzoom — back to 4 panels. Enable broadcast — typing in one panel appears in all.

- [ ] **Step 4: Commit**

```bash
git add v-terminal.App/Views/PanelGrid.* v-terminal.App/Views/SplitToolbar.*
git commit -m "feat(app): add zoom mode and broadcast input"
```

---

## Phase 5: Command Palette

### Task 18: App — Command Palette

**Files:**
- Create: `v-terminal.App/Views/CommandPalette.xaml` + `.xaml.h` + `.xaml.cpp`
- Create: `v-terminal.App/ViewModels/CommandPaletteViewModel.h` + `.cpp`
- Create: `v-terminal.Core/FuzzyMatch.h` + `.cpp`
- Test: `v-terminal.Tests/FuzzyMatchTests.cpp`

- [ ] **Step 1: Write failing FuzzyMatch test**

```cpp
TEST(FuzzyMatchTest, ExactMatch) {
    auto score = VTerminal::fuzzyMatch(L"settings", L"settings");
    EXPECT_GT(score, 0);
}

TEST(FuzzyMatchTest, SubsequenceMatch) {
    auto score = VTerminal::fuzzyMatch(L"nwtab", L"New Tab");
    EXPECT_GT(score, 0);
}

TEST(FuzzyMatchTest, NoMatch) {
    auto score = VTerminal::fuzzyMatch(L"xyz", L"New Tab");
    EXPECT_EQ(score, 0);
}

TEST(FuzzyMatchTest, CaseInsensitive) {
    auto s1 = VTerminal::fuzzyMatch(L"SET", L"Settings");
    auto s2 = VTerminal::fuzzyMatch(L"set", L"Settings");
    EXPECT_EQ(s1, s2);
}
```

- [ ] **Step 2: Implement FuzzyMatch**

- [ ] **Step 3: Run tests to verify they pass**

- [ ] **Step 4: Implement CommandPalette XAML**

```xml
<ContentDialog x:Class="VTerminal.App.Views.CommandPalette"
    FullSizeDesired="False">
    <StackPanel Width="500">
        <TextBox x:Name="SearchBox" PlaceholderText="Type a command..."
                 TextChanged="OnSearchChanged" KeyDown="OnKeyDown" />
        <ListView x:Name="ResultList" MaxHeight="400"
                  ItemClick="OnItemClick" IsItemClickEnabled="True">
            <ListView.ItemTemplate>
                <DataTemplate>
                    <StackPanel Orientation="Horizontal" Padding="8,4">
                        <TextBlock Text="{Binding Label}" />
                        <TextBlock Text="{Binding Shortcut}" Opacity="0.5"
                                   Margin="16,0,0,0" />
                    </StackPanel>
                </DataTemplate>
            </ListView.ItemTemplate>
        </ListView>
    </StackPanel>
</ContentDialog>
```

- [ ] **Step 5: Implement prefix routing**

In `OnSearchChanged`:
- First character `!` → filter to tab list, strip prefix for search
- First character `@` → filter to connections
- First character `#` → filter to layouts
- First character `$` → filter to clipboard history
- No prefix → fuzzy match against all commands

- [ ] **Step 6: Wire Ctrl+K in MainWindow**

```cpp
void MainWindow::OnKeyDown(/* ... */) {
    if (e.Key() == VirtualKey::K &&
        (InputKeyboardSource::GetKeyStateForCurrentThread(VirtualKey::Control)
         & CoreVirtualKeyStates::Down) == CoreVirtualKeyStates::Down) {
        ToggleCommandPalette();
        e.Handled(true);
    }
}
```

- [ ] **Step 7: Verify**

Run app. Ctrl+K opens palette. Type "new" → shows "New Tab". Press Enter → new tab created. Type "!" → shows tab list. Type "#" → shows layouts.

- [ ] **Step 8: Commit**

```bash
git add v-terminal.Core/FuzzyMatch.* v-terminal.Tests/FuzzyMatchTests.cpp v-terminal.App/Views/CommandPalette.* v-terminal.App/ViewModels/CommandPalette*
git commit -m "feat(app): add command palette with prefix modes and fuzzy search"
```

---

## Phase 6: Productivity Tools

### Task 19: Toolkit — TodoStore

**Files:**
- Create: `v-terminal.Toolkit/TodoStore.h`
- Create: `v-terminal.Toolkit/TodoStore.cpp`
- Test: `v-terminal.Tests/TodoStoreTests.cpp`

- [ ] **Step 1: Write failing tests**

```cpp
class TodoStoreTest : public ::testing::Test {
protected:
    std::filesystem::path testDir;
    void SetUp() override {
        testDir = std::filesystem::temp_directory_path() / "v-terminal-todo-test";
        std::filesystem::create_directories(testDir);
    }
    void TearDown() override {
        std::filesystem::remove_all(testDir);
    }
};

TEST_F(TodoStoreTest, AddAndListTodos) {
    VTerminal::TodoStore store(testDir);
    store.addTodo(L"Buy milk");
    store.addTodo(L"Write code");

    auto todos = store.getTodos();
    EXPECT_EQ(todos.size(), 2);
    EXPECT_EQ(todos[0].text, L"Buy milk");
    EXPECT_FALSE(todos[0].completed);
}

TEST_F(TodoStoreTest, ToggleCompletion) {
    VTerminal::TodoStore store(testDir);
    store.addTodo(L"Task");
    auto id = store.getTodos()[0].id;
    store.toggleTodo(id);
    EXPECT_TRUE(store.getTodos()[0].completed);
}

TEST_F(TodoStoreTest, ClearCompleted) {
    VTerminal::TodoStore store(testDir);
    store.addTodo(L"Done");
    store.addTodo(L"Not done");
    store.toggleTodo(store.getTodos()[0].id);
    store.clearCompleted();

    EXPECT_EQ(store.getTodos().size(), 1);
    EXPECT_EQ(store.getTodos()[0].text, L"Not done");
}
```

- [ ] **Step 2: Implement TodoStore**

- [ ] **Step 3: Run tests to verify they pass**

- [ ] **Step 4: Commit**

```bash
git add v-terminal.Toolkit/TodoStore.* v-terminal.Tests/TodoStoreTests.cpp
git commit -m "feat(toolkit): add TodoStore with persistence"
```

---

### Task 20: Toolkit — PomodoroTimer

**Files:**
- Create: `v-terminal.Toolkit/PomodoroTimer.h`
- Create: `v-terminal.Toolkit/PomodoroTimer.cpp`
- Test: `v-terminal.Tests/PomodoroTimerTests.cpp`

- [ ] **Step 1: Write failing tests**

```cpp
TEST(PomodoroTimerTest, StartsInFocusPhase) {
    VTerminal::PomodoroTimer timer;
    EXPECT_EQ(timer.phase(), VTerminal::PomodoroPhase::Focus);
    EXPECT_FALSE(timer.isRunning());
}

TEST(PomodoroTimerTest, TransitionsToBreakAfterFocus) {
    VTerminal::PomodoroTimer timer;
    timer.setConfig({.focusMinutes = 1}); // 1 minute for testing
    timer.start();
    // Simulate elapsed time
    timer.tick(60000); // 60 seconds in ms
    EXPECT_EQ(timer.phase(), VTerminal::PomodoroPhase::Break);
}

TEST(PomodoroTimerTest, Reset) {
    VTerminal::PomodoroTimer timer;
    timer.start();
    timer.tick(5000);
    timer.reset();
    EXPECT_EQ(timer.remainingMs(), timer.config().focusMinutes * 60 * 1000);
    EXPECT_FALSE(timer.isRunning());
}
```

- [ ] **Step 2: Implement PomodoroTimer**

Phases: Focus → Break → Focus → ... → LongBreak (after N sessions). Config: focusMinutes, breakMinutes, longBreakMinutes, sessionsBeforeLongBreak. `tick(elapsedMs)` advances the timer. Callbacks: `onPhaseChange`, `onComplete`.

- [ ] **Step 3: Run tests to verify they pass**

- [ ] **Step 4: Commit**

```bash
git add v-terminal.Toolkit/PomodoroTimer.* v-terminal.Tests/PomodoroTimerTests.cpp
git commit -m "feat(toolkit): add PomodoroTimer with phase transitions"
```

---

### Task 21: Toolkit — CountdownTimer and AlarmManager

**Files:**
- Create: `v-terminal.Toolkit/CountdownTimer.h` + `.cpp`
- Create: `v-terminal.Toolkit/AlarmManager.h` + `.cpp`
- Test: `v-terminal.Tests/CountdownTimerTests.cpp`
- Test: `v-terminal.Tests/AlarmManagerTests.cpp`

- [ ] **Step 1: Write failing CountdownTimer tests**

```cpp
TEST(CountdownTimerTest, CountsDown) {
    VTerminal::CountdownTimer timer(L"Test", 10000); // 10 seconds
    timer.start();
    timer.tick(5000);
    EXPECT_EQ(timer.remainingMs(), 5000);
}

TEST(CountdownTimerTest, FinishesAtZero) {
    VTerminal::CountdownTimer timer(L"Test", 5000);
    bool finished = false;
    timer.onFinish([&]() { finished = true; });
    timer.start();
    timer.tick(5000);
    EXPECT_TRUE(finished);
}
```

- [ ] **Step 2: Write failing AlarmManager tests**

```cpp
TEST(AlarmManagerTest, AlarmTriggersAtCorrectTime) {
    VTerminal::AlarmManager mgr(std::filesystem::temp_directory_path() / "alarm-test");
    bool triggered = false;
    mgr.onAlarm([&](const std::wstring& label) { triggered = true; });

    VTerminal::AlarmEntry alarm;
    alarm.id = L"1";
    alarm.label = L"Test";
    alarm.time = L"14:30";
    alarm.weekdays = {0, 1, 2, 3, 4}; // Mon-Fri
    alarm.enabled = true;
    mgr.addAlarm(alarm);

    // Simulate check at 14:30 on a Monday
    mgr.checkAlarms(14, 30, 0); // hour, minute, weekday
    EXPECT_TRUE(triggered);
}
```

- [ ] **Step 3: Implement both**

- [ ] **Step 4: Run tests to verify they pass**

- [ ] **Step 5: Commit**

```bash
git add v-terminal.Toolkit/CountdownTimer.* v-terminal.Toolkit/AlarmManager.* v-terminal.Tests/CountdownTimerTests.cpp v-terminal.Tests/AlarmManagerTests.cpp
git commit -m "feat(toolkit): add CountdownTimer and AlarmManager"
```

---

### Task 22: Toolkit — ClipboardHistory

**Files:**
- Create: `v-terminal.Toolkit/ClipboardHistory.h`
- Create: `v-terminal.Toolkit/ClipboardHistory.cpp`
- Test: `v-terminal.Tests/ClipboardHistoryTests.cpp`

- [ ] **Step 1: Write failing tests**

```cpp
TEST(ClipboardHistoryTest, AddsEntries) {
    auto dir = std::filesystem::temp_directory_path() / "clip-test";
    std::filesystem::create_directories(dir);
    VTerminal::ClipboardHistory hist(dir, 50);

    hist.add(L"first");
    hist.add(L"second");

    auto entries = hist.getEntries();
    EXPECT_EQ(entries.size(), 2);
    EXPECT_EQ(entries[0].text, L"second"); // newest first
    std::filesystem::remove_all(dir);
}

TEST(ClipboardHistoryTest, DeduplicatesAndMovesToTop) {
    auto dir = std::filesystem::temp_directory_path() / "clip-test2";
    std::filesystem::create_directories(dir);
    VTerminal::ClipboardHistory hist(dir, 50);

    hist.add(L"alpha");
    hist.add(L"beta");
    hist.add(L"alpha"); // duplicate

    auto entries = hist.getEntries();
    EXPECT_EQ(entries.size(), 2);
    EXPECT_EQ(entries[0].text, L"alpha"); // moved to top
    std::filesystem::remove_all(dir);
}

TEST(ClipboardHistoryTest, CapsAtMaxEntries) {
    auto dir = std::filesystem::temp_directory_path() / "clip-test3";
    std::filesystem::create_directories(dir);
    VTerminal::ClipboardHistory hist(dir, 3);

    hist.add(L"a");
    hist.add(L"b");
    hist.add(L"c");
    hist.add(L"d");

    EXPECT_EQ(hist.getEntries().size(), 3);
    std::filesystem::remove_all(dir);
}
```

- [ ] **Step 2: Implement ClipboardHistory**

Uses `AddClipboardFormatListener` / `WM_CLIPBOARDUPDATE` for monitoring. Stores entries in JSON. Max 50 entries. Deduplicates by moving duplicates to top.

- [ ] **Step 3: Run tests to verify they pass**

- [ ] **Step 4: Commit**

```bash
git add v-terminal.Toolkit/ClipboardHistory.* v-terminal.Tests/ClipboardHistoryTests.cpp
git commit -m "feat(toolkit): add ClipboardHistory with deduplication and cap"
```

---

### Task 23: App — Toolkit SidePanel UI

**Files:**
- Create: `v-terminal.App/Views/SidePanel.xaml` + `.xaml.h` + `.xaml.cpp`
- Create: `v-terminal.App/Views/TodoView.xaml` + `.xaml.h` + `.xaml.cpp`
- Create: `v-terminal.App/Views/TimersView.xaml` + `.xaml.h` + `.xaml.cpp`
- Modify: `v-terminal.App/Views/MainWindow.xaml`

- [ ] **Step 1: Implement SidePanel with tab switching**

```xml
<UserControl x:Class="VTerminal.App.Views.SidePanel" Width="280">
    <Grid>
        <Grid.RowDefinitions>
            <RowDefinition Height="Auto" />
            <RowDefinition Height="*" />
        </Grid.RowDefinitions>
        <!-- Tab switcher -->
        <StackPanel Orientation="Horizontal" Padding="8">
            <Button x:Name="TodosTab" Content="Todos" Click="OnTodosTab" />
            <Button x:Name="TimersTab" Content="Timers" Click="OnTimersTab" />
        </StackPanel>
        <!-- Content -->
        <local:TodoView x:Name="TodoContent" Grid.Row="1" />
        <local:TimersView x:Name="TimersContent" Grid.Row="1" Visibility="Collapsed" />
    </Grid>
</UserControl>
```

- [ ] **Step 2: Implement TodoView**

Input field + Add button at top. `ListView` of todo items (checkbox + text + delete button). Footer: remaining count + "Clear completed" button. Binds to `TodoStore`.

- [ ] **Step 3: Implement TimersView**

Three sections vertically stacked:
1. **Pomodoro:** Progress ring (custom `Canvas` or `ProgressRing` with manual drawing), phase indicator dots, Start/Pause/Reset buttons, settings expander.
2. **Countdown Timers:** "Add Timer" form + list of running timers with progress bars.
3. **Recurring Alarms:** "Add Alarm" form (time picker + weekday toggles) + list of alarms with enable/disable toggle.

Alarm triggers → `ToastNotificationManager` to show Windows notification.

- [ ] **Step 4: Wire SidePanel to MainWindow**

Add to `MainWindow.xaml` content grid as the second column. Toggle visibility via `Ctrl+Shift+N` and toolbar button.

- [ ] **Step 5: Verify**

Run app. Ctrl+Shift+N toggles sidebar. Add todos, start pomodoro, create countdown timer, set alarm. All persist across app restart.

- [ ] **Step 6: Commit**

```bash
git add v-terminal.App/Views/SidePanel.* v-terminal.App/Views/TodoView.* v-terminal.App/Views/TimersView.*
git commit -m "feat(app): add toolkit sidebar with todos, timers, and alarms"
```

---

## Phase 7: Settings, Themes, and i18n

### Task 24: App — Settings Dialog

**Files:**
- Create: `v-terminal.App/Views/SettingsDialog.xaml` + `.xaml.h` + `.xaml.cpp`

- [ ] **Step 1: Implement SettingsDialog**

```xml
<ContentDialog x:Class="VTerminal.App.Views.SettingsDialog"
    Title="Settings" PrimaryButtonText="OK" CloseButtonText="Cancel">
    <Pivot>
        <PivotItem Header="Appearance">
            <StackPanel Spacing="16" Padding="0,16">
                <ComboBox Header="Theme" x:Name="ThemeCombo">
                    <ComboBoxItem Content="Auto" />
                    <ComboBoxItem Content="Light" />
                    <ComboBoxItem Content="Dark" />
                </ComboBox>
                <ComboBox Header="Language" x:Name="LangCombo">
                    <ComboBoxItem Content="English" Tag="en" />
                    <ComboBoxItem Content="한국어" Tag="ko" />
                </ComboBox>
                <ComboBox Header="Note Background" x:Name="NoteBgCombo">
                    <ComboBoxItem Content="None" />
                    <ComboBoxItem Content="Ruled" />
                    <ComboBoxItem Content="Grid" />
                    <ComboBoxItem Content="Dots" />
                </ComboBox>
            </StackPanel>
        </PivotItem>
        <PivotItem Header="Terminal">
            <StackPanel Spacing="16" Padding="0,16">
                <ComboBox Header="Font" x:Name="FontCombo" />
                <NumberBox Header="Font Size" x:Name="FontSizeBox"
                           Minimum="10" Maximum="24" SmallChange="1" />
                <RadioButtons Header="Cursor Style" x:Name="CursorStyleRadio">
                    <RadioButton Content="Block" />
                    <RadioButton Content="Underline" />
                    <RadioButton Content="Bar" />
                </RadioButtons>
                <ToggleSwitch Header="Cursor Blink" x:Name="CursorBlinkToggle" />
                <Slider Header="Line Height" x:Name="LineHeightSlider"
                        Minimum="1.0" Maximum="1.6" StepFrequency="0.1" />
                <NumberBox Header="Scrollback Lines" x:Name="ScrollbackBox"
                           Minimum="1000" Maximum="10000" SmallChange="1000" />
            </StackPanel>
        </PivotItem>
        <PivotItem Header="General">
            <StackPanel Spacing="16" Padding="0,16">
                <Button Content="Reset Welcome Page" Click="OnResetOnboarding" />
            </StackPanel>
        </PivotItem>
    </Pivot>
</ContentDialog>
```

- [ ] **Step 2: Wire settings to AppSettings**

On dialog open: populate controls from `Settings::getAppSettings()`. On OK: save to `Settings::setAppSettings()`. Apply theme change immediately. Apply terminal config to all open `TerminalPane` instances.

- [ ] **Step 3: Verify**

Change font to "Fira Code", size to 18. Close and reopen settings → values persisted. Change theme to dark → app UI switches.

- [ ] **Step 4: Commit**

```bash
git add v-terminal.App/Views/SettingsDialog.*
git commit -m "feat(app): add settings dialog with appearance, terminal, and general tabs"
```

---

### Task 25: App — Theme System

**Files:**
- Modify: `v-terminal.App/App.xaml.cpp`
- Create: `v-terminal.App/ThemeManager.h` + `.cpp`

- [ ] **Step 1: Implement ThemeManager**

```cpp
class ThemeManager {
public:
    static void initialize(winrt::Microsoft::UI::Xaml::Application app);
    static void applyTheme(const std::wstring& mode); // "auto", "light", "dark"
    static TerminalTheme getCurrentTerminalTheme();

private:
    static void onSystemThemeChanged();
    static winrt::Microsoft::UI::Xaml::ElementTheme resolveTheme(const std::wstring& mode);
};
```

- Auto mode: listen to `UISettings.ColorValuesChanged`, apply `ElementTheme::Default`
- Light/Dark: set `Application.RequestedTheme` explicitly
- Terminal theme: return the appropriate `TerminalTheme` (light or dark) based on resolved theme

- [ ] **Step 2: Apply on app startup and settings change**

- [ ] **Step 3: Verify**

Switch between auto/light/dark in settings. System theme change updates app in auto mode.

- [ ] **Step 4: Commit**

```bash
git add v-terminal.App/ThemeManager.*
git commit -m "feat(app): add ThemeManager with system theme detection"
```

---

### Task 26: App — Internationalization (.resw)

**Files:**
- Create: `v-terminal.App/Strings/en/Resources.resw`
- Create: `v-terminal.App/Strings/ko/Resources.resw`
- Modify: All XAML views to use `x:Uid` bindings

- [ ] **Step 1: Create English resource file**

Define all UI strings with keys:

```xml
<!-- en/Resources.resw (partial) -->
<data name="NewTab.Content" xml:space="preserve"><value>New Tab</value></data>
<data name="CloseTab.Content" xml:space="preserve"><value>Close Tab</value></data>
<data name="Settings.Title" xml:space="preserve"><value>Settings</value></data>
<data name="ThemeAuto.Content" xml:space="preserve"><value>Auto</value></data>
<data name="ThemeLight.Content" xml:space="preserve"><value>Light</value></data>
<data name="ThemeDark.Content" xml:space="preserve"><value>Dark</value></data>
<data name="Todos.Header" xml:space="preserve"><value>Todos</value></data>
<data name="Timers.Header" xml:space="preserve"><value>Timers</value></data>
<!-- ... all other UI strings -->
```

- [ ] **Step 2: Create Korean resource file**

```xml
<!-- ko/Resources.resw (partial) -->
<data name="NewTab.Content" xml:space="preserve"><value>새 탭</value></data>
<data name="CloseTab.Content" xml:space="preserve"><value>탭 닫기</value></data>
<data name="Settings.Title" xml:space="preserve"><value>설정</value></data>
<!-- ... -->
```

- [ ] **Step 3: Update XAML views with x:Uid**

Replace hardcoded strings with `x:Uid` bindings:
```xml
<Button x:Uid="NewTab" />  <!-- Automatically binds Content to NewTab.Content -->
```

- [ ] **Step 4: Implement language switching**

On language change in settings, update `Windows.Globalization.ApplicationLanguages.PrimaryLanguageOverride` and restart resource loading.

- [ ] **Step 5: Verify**

Switch language to Korean in settings → all UI text changes. Switch back to English → reverts.

- [ ] **Step 6: Commit**

```bash
git add v-terminal.App/Strings/
git commit -m "feat(app): add i18n with English and Korean resources"
```

---

## Phase 8: Persistence and Polish

### Task 27: App — Workspace Persistence

**Files:**
- Create: `v-terminal.App/WorkspaceManager.h` + `.cpp`
- Modify: `v-terminal.App/App.xaml.cpp`

- [ ] **Step 1: Implement WorkspaceManager**

```cpp
class WorkspaceManager {
public:
    explicit WorkspaceManager(const std::filesystem::path& dataDir);

    void save(const WorkspaceState& state);
    std::optional<WorkspaceState> load();
    void saveWindowState(const WindowState& state);
};
```

Serializes `WorkspaceState` (tabs, panels, note contents, window geometry) to `workspace.json` via `JsonStore`. Debounced save (300ms timer).

- [ ] **Step 2: Save on state changes and app close**

- On tab/layout/connection changes: debounced save
- On `Window.Closed`: immediate save of current state including window position/size
- On panel note content change: debounced save

- [ ] **Step 3: Restore on app launch**

In `App.xaml.cpp` startup:
1. Load `workspace.json`
2. If valid: restore window geometry, recreate tabs with stored layouts
3. For each panel: create appropriate session (Local/SSH/WSL) or restore note content
4. If no workspace file: create single tab with 1-panel layout and default local shell

- [ ] **Step 4: Verify**

Open app, create 3 tabs with different layouts, write a note in one panel. Close app. Reopen — all tabs, layouts, and note restored. Window position/size preserved.

- [ ] **Step 5: Commit**

```bash
git add v-terminal.App/WorkspaceManager.*
git commit -m "feat(app): add workspace persistence with window state"
```

---

### Task 28: App — SSH Profile Manager

**Files:**
- Create: `v-terminal.App/Views/SshProfileDialog.xaml` + `.xaml.h` + `.xaml.cpp`
- Create: `v-terminal.App/ViewModels/SshProfileViewModel.h` + `.cpp`

- [ ] **Step 1: Implement SshProfileDialog**

```xml
<ContentDialog Title="SSH Profiles">
    <Grid>
        <Grid.ColumnDefinitions>
            <ColumnDefinition Width="200" />
            <ColumnDefinition Width="*" />
        </Grid.ColumnDefinitions>
        <!-- Profile list -->
        <StackPanel>
            <ListView x:Name="ProfileList" SelectionChanged="OnProfileSelected" />
            <StackPanel Orientation="Horizontal">
                <Button Content="+" Click="OnAddProfile" />
                <Button Content="-" Click="OnDeleteProfile" />
            </StackPanel>
        </StackPanel>
        <!-- Edit form -->
        <StackPanel Grid.Column="1" Spacing="8" Padding="16,0">
            <TextBox Header="Name" x:Name="NameBox" />
            <TextBox Header="Host" x:Name="HostBox" />
            <NumberBox Header="Port" x:Name="PortBox" Value="22" />
            <TextBox Header="Username" x:Name="UsernameBox" />
            <TextBox Header="Identity File (optional)" x:Name="IdentityBox" />
        </StackPanel>
    </Grid>
</ContentDialog>
```

- [ ] **Step 2: Wire to JsonStore persistence**

Profiles stored in `ssh_profiles.json`. CRUD operations. Profile list shown in command palette `@` mode and panel context menu.

- [ ] **Step 3: Verify**

Create SSH profile, see it in context menu and command palette @-mode. Connect to SSH server.

- [ ] **Step 4: Commit**

```bash
git add v-terminal.App/Views/SshProfileDialog.* v-terminal.App/ViewModels/SshProfile*
git commit -m "feat(app): add SSH profile manager dialog"
```

---

### Task 29: App — Welcome Page (Onboarding)

**Files:**
- Create: `v-terminal.App/Views/WelcomePage.xaml` + `.xaml.h` + `.xaml.cpp`

- [ ] **Step 1: Implement WelcomePage**

Multi-step onboarding with Skip/Next/Get Started buttons:
1. "Everything at your fingertips" — Command Palette intro (Ctrl+K)
2. "Your workspace, your way" — Panel layouts & connection mixing
3. "Stay focused" — Notes & Pomodoro in sidebar

Each slide: icon/illustration + title + description.

- [ ] **Step 2: Wire onboarding flow**

Show on first new tab if `onboarding.json` has `"completed": false`. After "Get Started", set `"completed": true`. Reset via Settings → General → "Reset Welcome Page".

- [ ] **Step 3: Verify**

Delete `onboarding.json`. Launch app → welcome page shows. Complete onboarding → normal tab. Reset in settings → shows again on next new tab.

- [ ] **Step 4: Commit**

```bash
git add v-terminal.App/Views/WelcomePage.*
git commit -m "feat(app): add onboarding welcome page"
```

---

### Task 30: App — Keyboard Shortcuts

**Files:**
- Modify: `v-terminal.App/Views/MainWindow.xaml.cpp`

- [ ] **Step 1: Wire all keyboard shortcuts**

In `MainWindow::OnKeyDown`:

```cpp
auto ctrl = (InputKeyboardSource::GetKeyStateForCurrentThread(VirtualKey::Control)
             & CoreVirtualKeyStates::Down) == CoreVirtualKeyStates::Down;
auto shift = (InputKeyboardSource::GetKeyStateForCurrentThread(VirtualKey::Shift)
              & CoreVirtualKeyStates::Down) == CoreVirtualKeyStates::Down;

if (ctrl && e.Key() == VirtualKey::K) {
    ToggleCommandPalette();
} else if (ctrl && shift && e.Key() == VirtualKey::T) {
    AddNewTab();
} else if (ctrl && shift && e.Key() == VirtualKey::N) {
    ToggleSidePanel();
}
```

- [ ] **Step 2: Verify all 3 shortcuts work**

- [ ] **Step 3: Commit**

```bash
git add v-terminal.App/Views/MainWindow.*
git commit -m "feat(app): wire keyboard shortcuts (Ctrl+K, Ctrl+Shift+T/N)"
```

---

## Phase 9: Packaging

### Task 31: MSIX Packaging

**Files:**
- Modify: `v-terminal.App/Package.appxmanifest`
- Create: `v-terminal.App/Assets/` (app icons at required sizes)

- [ ] **Step 1: Configure Package.appxmanifest**

Set display name, description, publisher. Add required capabilities: `internetClient` (for SSH).

- [ ] **Step 2: Add app icons**

Create icon assets at all required sizes (16, 24, 32, 44, 48, 150, 300px square). Store tile images.

- [ ] **Step 3: Build MSIX package**

Build in Release mode: Build → Publish → Create App Packages → Sideloading.

- [ ] **Step 4: Test install and launch**

Install the MSIX on a clean Windows machine. Verify app launches, all features work.

- [ ] **Step 5: Commit**

```bash
git add v-terminal.App/Package.appxmanifest v-terminal.App/Assets/
git commit -m "feat: configure MSIX packaging with app icons"
```

---

### Task 32: Terminal — KeyTranslator

**Files:**
- Create: `v-terminal.Terminal/KeyTranslator.h`
- Create: `v-terminal.Terminal/KeyTranslator.cpp`
- Test: `v-terminal.Tests/KeyTranslatorTests.cpp`

- [ ] **Step 1: Write failing tests**

```cpp
TEST(KeyTranslatorTest, PrintableCharacter) {
    EXPECT_EQ(VTerminal::KeyTranslator::translate('a', false, false, false), "a");
}

TEST(KeyTranslatorTest, EnterKey) {
    EXPECT_EQ(VTerminal::KeyTranslator::translateSpecial(VK_RETURN, false, false), "\r");
}

TEST(KeyTranslatorTest, ArrowKeys) {
    EXPECT_EQ(VTerminal::KeyTranslator::translateSpecial(VK_UP, false, false), "\x1b[A");
    EXPECT_EQ(VTerminal::KeyTranslator::translateSpecial(VK_DOWN, false, false), "\x1b[B");
    EXPECT_EQ(VTerminal::KeyTranslator::translateSpecial(VK_RIGHT, false, false), "\x1b[C");
    EXPECT_EQ(VTerminal::KeyTranslator::translateSpecial(VK_LEFT, false, false), "\x1b[D");
}

TEST(KeyTranslatorTest, CtrlC) {
    EXPECT_EQ(VTerminal::KeyTranslator::translate('c', true, false, false), "\x03");
}

TEST(KeyTranslatorTest, CtrlD) {
    EXPECT_EQ(VTerminal::KeyTranslator::translate('d', true, false, false), "\x04");
}

TEST(KeyTranslatorTest, FunctionKeys) {
    EXPECT_EQ(VTerminal::KeyTranslator::translateSpecial(VK_F1, false, false), "\x1bOP");
    EXPECT_EQ(VTerminal::KeyTranslator::translateSpecial(VK_F5, false, false), "\x1b[15~");
}

TEST(KeyTranslatorTest, HomeEndPageKeys) {
    EXPECT_EQ(VTerminal::KeyTranslator::translateSpecial(VK_HOME, false, false), "\x1b[H");
    EXPECT_EQ(VTerminal::KeyTranslator::translateSpecial(VK_END, false, false), "\x1b[F");
    EXPECT_EQ(VTerminal::KeyTranslator::translateSpecial(VK_DELETE, false, false), "\x1b[3~");
}

TEST(KeyTranslatorTest, ApplicationCursorMode) {
    EXPECT_EQ(VTerminal::KeyTranslator::translateSpecial(VK_UP, false, false, true), "\x1bOA");
}
```

- [ ] **Step 2: Run tests to verify they fail**

- [ ] **Step 3: Implement KeyTranslator**

Static class with `translate(char, ctrl, alt, shift)` for printable keys and `translateSpecial(WORD vkCode, ctrl, alt, applicationMode)` for special keys. Covers: printable ASCII, Enter/Tab/Backspace/Escape, arrow keys, Home/End/Insert/Delete/PageUp/PageDown, F1-F12, Ctrl+A-Z (map to 0x01-0x1A), and application cursor mode variants.

- [ ] **Step 4: Run tests to verify they pass**

- [ ] **Step 5: Commit**

```bash
git add v-terminal.Terminal/KeyTranslator.* v-terminal.Tests/KeyTranslatorTests.cpp
git commit -m "feat(terminal): add KeyTranslator for keyboard-to-VT sequence mapping"
```

---

### Task 33: Terminal — Text Selection

**Files:**
- Create: `v-terminal.Terminal/TextSelection.h`
- Create: `v-terminal.Terminal/TextSelection.cpp`
- Modify: `v-terminal.Terminal/TerminalRenderer.cpp` (render selection highlight)
- Modify: `v-terminal.App/Views/TerminalPane.xaml.cpp` (mouse event handlers)

- [ ] **Step 1: Implement TextSelection model**

```cpp
// TextSelection.h
#pragma once
#include <optional>
#include <string>

namespace VTerminal {

struct CellPosition {
    int row, col;
};

class TextSelection {
public:
    void startSelection(int row, int col);
    void updateSelection(int row, int col);
    void clearSelection();

    bool hasSelection() const;
    CellPosition start() const;
    CellPosition end() const;
    bool isCellSelected(int row, int col) const;

    std::wstring getSelectedText(const class TerminalBuffer& buffer) const;

private:
    std::optional<CellPosition> m_start;
    std::optional<CellPosition> m_end;
};

} // namespace VTerminal
```

- [ ] **Step 2: Add selection rendering to TerminalRenderer**

In `renderCell()`, if `TextSelection::isCellSelected(row, col)`, draw `selectionBackground` color behind the cell.

- [ ] **Step 3: Wire mouse events in TerminalPane**

- `PointerPressed` → `TextSelection::startSelection(row, col)` (calculated from pointer position and cell dimensions)
- `PointerMoved` (while pressed) → `TextSelection::updateSelection(row, col)`
- `PointerReleased` → selection finalized
- `Ctrl+C` when selection active → copy `getSelectedText()` to clipboard, clear selection
- `Ctrl+C` when no selection → pass through as VT `\x03` to session

- [ ] **Step 4: Verify**

Run app. Click and drag to select text. Selection highlighted. Ctrl+C copies text. Click elsewhere clears selection.

- [ ] **Step 5: Commit**

```bash
git add v-terminal.Terminal/TextSelection.*
git commit -m "feat(terminal): add text selection with mouse and copy support"
```

---

### Task 34: App — SSH Authentication Dialog

**Files:**
- Create: `v-terminal.App/Views/SshAuthDialog.xaml` + `.xaml.h` + `.xaml.cpp`

- [ ] **Step 1: Implement SshAuthDialog**

```xml
<ContentDialog x:Class="VTerminal.App.Views.SshAuthDialog"
    Title="SSH Authentication" PrimaryButtonText="Connect" CloseButtonText="Cancel">
    <StackPanel Spacing="12">
        <TextBlock x:Name="HostLabel" />
        <PasswordBox x:Name="PasswordBox" Header="Password"
                     PlaceholderText="Enter password..." />
    </StackPanel>
</ContentDialog>
```

- [ ] **Step 2: Wire to SshSession creation flow**

When `SshSession` needs password authentication (no identity file, or key passphrase required):
1. `SessionManager` emits an event requesting credentials
2. UI shows `SshAuthDialog`
3. User enters password → dialog returns it
4. `SshSession` retries authentication with the password
5. On failure → show dialog again with error message

- [ ] **Step 3: Verify**

Create SSH profile without identity file. Connect to SSH panel → password dialog appears. Enter correct password → connected. Enter wrong password → error + retry.

- [ ] **Step 4: Commit**

```bash
git add v-terminal.App/Views/SshAuthDialog.*
git commit -m "feat(app): add SSH authentication dialog for password/passphrase"
```

---

### Task 35: Toolkit — TimerService (Background Thread)

**Files:**
- Create: `v-terminal.Toolkit/TimerService.h`
- Create: `v-terminal.Toolkit/TimerService.cpp`

- [ ] **Step 1: Implement TimerService**

```cpp
// TimerService.h
#pragma once
#include "PomodoroTimer.h"
#include "CountdownTimer.h"
#include "AlarmManager.h"
#include <thread>
#include <atomic>
#include <functional>

namespace VTerminal {

class TimerService {
public:
    TimerService(PomodoroTimer& pomodoro,
                 std::vector<CountdownTimer>& countdowns,
                 AlarmManager& alarms);
    ~TimerService();

    void start();
    void stop();

    // Callback invoked on the timer thread; caller must dispatch to UI thread
    void onTick(std::function<void()> callback);

private:
    void tickLoop();

    PomodoroTimer& m_pomodoro;
    std::vector<CountdownTimer>& m_countdowns;
    AlarmManager& m_alarms;
    std::thread m_thread;
    std::atomic<bool> m_running{false};
    std::function<void()> m_onTick;
};

} // namespace VTerminal
```

Background thread runs a loop: sleep 100ms → compute elapsed time since last tick → call `tick(elapsed)` on Pomodoro and all active Countdowns → call `checkAlarms(hour, minute, weekday)` on AlarmManager → invoke `m_onTick` callback. Caller (TimersView) wraps `m_onTick` with `DispatcherQueue.TryEnqueue()` to update UI.

- [ ] **Step 2: Wire into TimersView (Task 23)**

In `TimersView` initialization, create `TimerService` and start it. On tick callback, update progress displays via DispatcherQueue.

- [ ] **Step 3: Verify**

Start pomodoro → progress ring updates in real-time. Create countdown → counts down visually. Set alarm for current time → Windows toast notification fires.

- [ ] **Step 4: Commit**

```bash
git add v-terminal.Toolkit/TimerService.*
git commit -m "feat(toolkit): add TimerService background thread for timer ticking"
```

---

### Task 36: Terminal — Scroll and Mouse Wheel

**Files:**
- Modify: `v-terminal.App/Views/TerminalPane.xaml.cpp`
- Modify: `v-terminal.Terminal/TerminalRenderer.cpp`

- [ ] **Step 1: Add viewport offset to TerminalRenderer**

Add `m_viewportOffset` (int, 0 = bottom of scrollback). `render()` uses this offset to determine which rows of the buffer (including scrollback) to display.

- [ ] **Step 2: Handle mouse wheel in TerminalPane**

```cpp
void TerminalPane::OnPointerWheelChanged(/* ... */) {
    int delta = e.GetCurrentPoint(*this).Properties().MouseWheelDelta();
    int lines = delta / 120 * 3; // 3 lines per notch
    m_renderer->scrollViewport(lines);
    m_renderer->render(*m_buffer, m_parser->cursorRow(), m_parser->cursorCol());
}
```

Scroll up: increase viewport offset (show scrollback). Scroll down: decrease (back to live terminal). Any keyboard input resets viewport to 0.

- [ ] **Step 3: Verify**

Run a command that produces lots of output (`dir /s`). Scroll up with mouse wheel → see history. Type → snaps back to live output.

- [ ] **Step 4: Commit**

```bash
git add v-terminal.App/Views/TerminalPane.* v-terminal.Terminal/TerminalRenderer.*
git commit -m "feat(terminal): add mouse wheel scrollback navigation"
```

---

## Task Dependency Summary

```
Phase 1: [Task 1] → [Task 2] → [Task 3] → [Task 4]
Phase 2: [Task 5] → [Task 6] → [Task 7] → [Task 8], [Task 32] (KeyTranslator parallel with 7-8)
Phase 3: [Task 9] → [Task 10], [Task 11]  (10 and 11 are independent)
Phase 4: [Task 12] → [Task 33] (Text Selection) → [Task 36] (Scroll) → [Task 13] → [Task 14] → [Task 15] → [Task 16] → [Task 17]
Phase 5: [Task 18]
Phase 6: [Task 19], [Task 20], [Task 21], [Task 22] (all independent) → [Task 35] (TimerService) → [Task 23]
Phase 7: [Task 24], [Task 25], [Task 26] (all independent)
Phase 8: [Task 27], [Task 28], [Task 34] (SSH Auth Dialog), [Task 29], [Task 30] (all independent)
Phase 9: [Task 31]

Cross-phase: Phase 2 depends on Phase 1.
             Phase 3 depends on Phase 2.
             Phase 4 depends on Phase 2+3.
             Phase 5 depends on Phase 4.
             Phase 6 depends on Phase 1 (Core library). Can start in parallel with Phase 2-3.
             Phase 7 depends on Phase 4 (app shell exists).
             Phase 8 depends on Phase 4-7.
             Phase 9 depends on all above.
```
