#pragma once

#include "Types.h"
#include "JsonStore.h"

#include <filesystem>
#include <optional>
#include <chrono>
#include <mutex>

namespace VTerminal {

/// Manages workspace persistence (tabs, panels, window state).
/// Wraps JsonStore for workspace.json with typed serialization
/// and debounced save (300ms).
class WorkspaceManager {
public:
    explicit WorkspaceManager(const std::filesystem::path& dataDir);

    /// Save the full workspace state. Debounced: actual write deferred 300ms.
    void save(const WorkspaceState& state);

    /// Force an immediate save (call on app close).
    void saveImmediate(const WorkspaceState& state);

    /// Load workspace from disk. Returns nullopt if no file or parse error.
    std::optional<WorkspaceState> load();

    /// Save only window position/size (immediate, no debounce).
    void saveWindowState(const WindowState& state);

    /// Flush any pending debounced save. Call before shutdown.
    void flush();

private:
    // Serialization
    static nlohmann::json toJson(const WorkspaceState& state);
    static WorkspaceState fromJson(const nlohmann::json& j);
    static nlohmann::json windowStateToJson(const WindowState& ws);
    static WindowState windowStateFromJson(const nlohmann::json& j);
    static nlohmann::json tabStateToJson(const TabState& ts);
    static TabState tabStateFromJson(const nlohmann::json& j);
    static nlohmann::json panelConnectionToJson(const PanelConnection& pc);
    static PanelConnection panelConnectionFromJson(const nlohmann::json& j);

    JsonStore m_store;
    std::mutex m_mutex;

    // Debounce state
    std::optional<WorkspaceState> m_pendingState;
    std::chrono::steady_clock::time_point m_lastSaveRequest;
    static constexpr int DEBOUNCE_MS = 300;
};

} // namespace VTerminal
