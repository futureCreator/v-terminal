#include "SshProfileViewModel.h"

#include <chrono>
#include <sstream>
#include <iomanip>

namespace VTerminal {

SshProfileViewModel::SshProfileViewModel(const std::filesystem::path& dataDir)
    : m_store(dataDir / "ssh_profiles.json")
{
    reload();
}

void SshProfileViewModel::addProfile()
{
    SshProfile profile;
    profile.id = generateId();
    profile.name = L"New Profile";
    profile.host = L"";
    profile.port = 22;
    profile.username = L"";
    m_profiles.push_back(std::move(profile));
}

void SshProfileViewModel::removeProfile(int index)
{
    if (index < 0 || index >= static_cast<int>(m_profiles.size())) return;
    m_profiles.erase(m_profiles.begin() + index);
}

void SshProfileViewModel::updateProfile(int index, const SshProfile& profile)
{
    if (index < 0 || index >= static_cast<int>(m_profiles.size())) return;

    // Preserve the original ID
    auto id = m_profiles[index].id;
    m_profiles[index] = profile;
    m_profiles[index].id = id;
}

std::vector<SshProfile> SshProfileViewModel::getProfiles() const
{
    return m_profiles;
}

SshProfile SshProfileViewModel::getProfile(int index) const
{
    if (index < 0 || index >= static_cast<int>(m_profiles.size())) {
        return {};
    }
    return m_profiles[index];
}

int SshProfileViewModel::profileCount() const
{
    return static_cast<int>(m_profiles.size());
}

SshProfile* SshProfileViewModel::findById(const std::wstring& id)
{
    for (auto& profile : m_profiles) {
        if (profile.id == id) {
            return &profile;
        }
    }
    return nullptr;
}

void SshProfileViewModel::save()
{
    m_store.save(profilesToJson(m_profiles));
}

void SshProfileViewModel::reload()
{
    auto json = m_store.load();
    if (json.has_value()) {
        try {
            m_profiles = profilesFromJson(json.value());
        } catch (...) {
            m_profiles.clear();
        }
    }
}

std::wstring SshProfileViewModel::generateId()
{
    auto now = std::chrono::system_clock::now();
    auto epoch = now.time_since_epoch();
    auto ms = std::chrono::duration_cast<std::chrono::milliseconds>(epoch).count();

    std::wstringstream ss;
    ss << L"ssh-" << ms;
    return ss.str();
}

nlohmann::json SshProfileViewModel::profilesToJson(const std::vector<SshProfile>& profiles)
{
    auto arr = nlohmann::json::array();
    for (const auto& p : profiles) {
        nlohmann::json j;
        j["id"] = std::string(p.id.begin(), p.id.end());
        j["name"] = std::string(p.name.begin(), p.name.end());
        j["host"] = std::string(p.host.begin(), p.host.end());
        j["port"] = p.port;
        j["username"] = std::string(p.username.begin(), p.username.end());
        if (p.identityFile.has_value()) {
            j["identityFile"] = std::string(p.identityFile.value().begin(), p.identityFile.value().end());
        }
        arr.push_back(j);
    }
    return arr;
}

std::vector<SshProfile> SshProfileViewModel::profilesFromJson(const nlohmann::json& j)
{
    std::vector<SshProfile> profiles;
    if (!j.is_array()) return profiles;

    for (const auto& item : j) {
        SshProfile p;
        std::string id = item.value("id", "");
        p.id = std::wstring(id.begin(), id.end());
        std::string name = item.value("name", "");
        p.name = std::wstring(name.begin(), name.end());
        std::string host = item.value("host", "");
        p.host = std::wstring(host.begin(), host.end());
        p.port = item.value("port", 22);
        std::string username = item.value("username", "");
        p.username = std::wstring(username.begin(), username.end());
        if (item.contains("identityFile")) {
            std::string idFile = item["identityFile"];
            p.identityFile = std::wstring(idFile.begin(), idFile.end());
        }
        profiles.push_back(std::move(p));
    }
    return profiles;
}

} // namespace VTerminal
