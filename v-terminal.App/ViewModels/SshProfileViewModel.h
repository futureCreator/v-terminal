#pragma once

#include "Types.h"
#include "JsonStore.h"

#include <filesystem>
#include <vector>
#include <string>

namespace VTerminal {

/// ViewModel for managing SSH profiles.
/// Provides CRUD operations backed by JsonStore for ssh_profiles.json.
class SshProfileViewModel {
public:
    explicit SshProfileViewModel(const std::filesystem::path& dataDir);

    // CRUD operations
    void addProfile();
    void removeProfile(int index);
    void updateProfile(int index, const SshProfile& profile);

    // Access
    std::vector<SshProfile> getProfiles() const;
    SshProfile getProfile(int index) const;
    int profileCount() const;

    // Find by ID (for panel context menu)
    SshProfile* findById(const std::wstring& id);

    // Persistence
    void save();
    void reload();

private:
    static std::wstring generateId();
    static nlohmann::json profilesToJson(const std::vector<SshProfile>& profiles);
    static std::vector<SshProfile> profilesFromJson(const nlohmann::json& j);

    JsonStore m_store;
    std::vector<SshProfile> m_profiles;
};

} // namespace VTerminal
