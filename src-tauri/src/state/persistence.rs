use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SessionData {
    pub tabs: Vec<TabData>,
    #[serde(rename = "activeTabId")]
    pub active_tab_id: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct TabData {
    pub id: String,
    pub label: String,
    pub cwd: String,
    pub layout: u8,
    #[serde(rename = "broadcastEnabled")]
    pub broadcast_enabled: bool,
}

pub fn session_file_path() -> PathBuf {
    let base = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."));
    base.join("v-terminal").join("session.json")
}

pub fn save(data: &SessionData) -> Result<(), String> {
    let path = session_file_path();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let json = serde_json::to_string_pretty(data).map_err(|e| e.to_string())?;
    std::fs::write(&path, json).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn load() -> Result<Option<SessionData>, String> {
    let path = session_file_path();
    if !path.exists() {
        return Ok(None);
    }
    let content = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let data: SessionData = serde_json::from_str(&content).map_err(|e| e.to_string())?;
    Ok(Some(data))
}
