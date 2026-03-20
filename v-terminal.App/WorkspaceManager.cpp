#include "WorkspaceManager.h"

#include <fstream>

namespace VTerminal {

WorkspaceManager::WorkspaceManager(const std::filesystem::path& dataDir)
    : m_store(dataDir / "workspace.json")
{
}

void WorkspaceManager::save(const WorkspaceState& state)
{
    std::lock_guard lock(m_mutex);
    m_pendingState = state;
    m_lastSaveRequest = std::chrono::steady_clock::now();

    // TODO: In production, schedule a timer callback at m_lastSaveRequest + 300ms
    // that calls flush(). For now, this is a placeholder — the actual debounce
    // requires DispatcherQueue.CreateTimer() or a background thread timer.
    // Immediate callers should use saveImmediate() or flush() as appropriate.
}

void WorkspaceManager::saveImmediate(const WorkspaceState& state)
{
    std::lock_guard lock(m_mutex);
    m_pendingState.reset();
    m_store.save(toJson(state));
}

std::optional<WorkspaceState> WorkspaceManager::load()
{
    auto json = m_store.load();
    if (!json.has_value()) return std::nullopt;

    try {
        return fromJson(json.value());
    } catch (...) {
        return std::nullopt;
    }
}

void WorkspaceManager::saveWindowState(const WindowState& state)
{
    // Load current workspace, update window state, save
    auto json = m_store.load();
    nlohmann::json data;
    if (json.has_value()) {
        data = json.value();
    } else {
        data = nlohmann::json::object();
        data["version"] = 1;
        data["tabs"] = nlohmann::json::array();
    }
    data["windowState"] = windowStateToJson(state);
    m_store.save(data);
}

void WorkspaceManager::flush()
{
    std::lock_guard lock(m_mutex);
    if (m_pendingState.has_value()) {
        m_store.save(toJson(m_pendingState.value()));
        m_pendingState.reset();
    }
}

// ============ Serialization ============

nlohmann::json WorkspaceManager::toJson(const WorkspaceState& state)
{
    nlohmann::json j;
    j["version"] = state.version;
    j["windowState"] = windowStateToJson(state.windowState);

    auto tabs = nlohmann::json::array();
    for (const auto& tab : state.tabs) {
        tabs.push_back(tabStateToJson(tab));
    }
    j["tabs"] = tabs;

    return j;
}

WorkspaceState WorkspaceManager::fromJson(const nlohmann::json& j)
{
    WorkspaceState state;
    state.version = j.value("version", 1);

    if (j.contains("windowState")) {
        state.windowState = windowStateFromJson(j["windowState"]);
    }

    if (j.contains("tabs") && j["tabs"].is_array()) {
        for (const auto& tabJson : j["tabs"]) {
            state.tabs.push_back(tabStateFromJson(tabJson));
        }
    }

    return state;
}

nlohmann::json WorkspaceManager::windowStateToJson(const WindowState& ws)
{
    return {
        {"x", ws.x},
        {"y", ws.y},
        {"width", ws.width},
        {"height", ws.height},
        {"maximized", ws.maximized}
    };
}

WindowState WorkspaceManager::windowStateFromJson(const nlohmann::json& j)
{
    WindowState ws;
    ws.x = j.value("x", 100);
    ws.y = j.value("y", 100);
    ws.width = j.value("width", 1280);
    ws.height = j.value("height", 720);
    ws.maximized = j.value("maximized", false);
    return ws;
}

nlohmann::json WorkspaceManager::tabStateToJson(const TabState& ts)
{
    nlohmann::json j;
    // Convert wstring to UTF-8 string for JSON
    j["label"] = std::string(ts.label.begin(), ts.label.end());
    j["layout"] = ts.layout;
    j["cwd"] = std::string(ts.cwd.begin(), ts.cwd.end());

    auto panels = nlohmann::json::array();
    for (const auto& panel : ts.panels) {
        panels.push_back(panelConnectionToJson(panel));
    }
    j["panels"] = panels;

    return j;
}

TabState WorkspaceManager::tabStateFromJson(const nlohmann::json& j)
{
    TabState ts;
    std::string label = j.value("label", "Terminal");
    ts.label = std::wstring(label.begin(), label.end());
    ts.layout = j.value("layout", 1);
    std::string cwd = j.value("cwd", "");
    ts.cwd = std::wstring(cwd.begin(), cwd.end());

    if (j.contains("panels") && j["panels"].is_array()) {
        for (const auto& panelJson : j["panels"]) {
            ts.panels.push_back(panelConnectionFromJson(panelJson));
        }
    }

    return ts;
}

nlohmann::json WorkspaceManager::panelConnectionToJson(const PanelConnection& pc)
{
    nlohmann::json j;

    switch (pc.type) {
        case SessionType::Local: j["type"] = "local"; break;
        case SessionType::Ssh:   j["type"] = "ssh"; break;
        case SessionType::Wsl:   j["type"] = "wsl"; break;
        case SessionType::Note:  j["type"] = "note"; break;
    }

    if (pc.sshProfileId.has_value()) {
        std::string id(pc.sshProfileId.value().begin(), pc.sshProfileId.value().end());
        j["sshProfileId"] = id;
    }
    if (pc.cwd.has_value()) {
        std::string cwd(pc.cwd.value().begin(), pc.cwd.value().end());
        j["cwd"] = cwd;
    }
    if (pc.noteContent.has_value()) {
        std::string note(pc.noteContent.value().begin(), pc.noteContent.value().end());
        j["noteContent"] = note;
    }

    return j;
}

PanelConnection WorkspaceManager::panelConnectionFromJson(const nlohmann::json& j)
{
    PanelConnection pc;

    std::string typeStr = j.value("type", "local");
    if (typeStr == "local")     pc.type = SessionType::Local;
    else if (typeStr == "ssh")  pc.type = SessionType::Ssh;
    else if (typeStr == "wsl")  pc.type = SessionType::Wsl;
    else if (typeStr == "note") pc.type = SessionType::Note;

    if (j.contains("sshProfileId")) {
        std::string id = j["sshProfileId"];
        pc.sshProfileId = std::wstring(id.begin(), id.end());
    }
    if (j.contains("cwd")) {
        std::string cwd = j["cwd"];
        pc.cwd = std::wstring(cwd.begin(), cwd.end());
    }
    if (j.contains("noteContent")) {
        std::string note = j["noteContent"];
        pc.noteContent = std::wstring(note.begin(), note.end());
    }

    return pc;
}

} // namespace VTerminal
