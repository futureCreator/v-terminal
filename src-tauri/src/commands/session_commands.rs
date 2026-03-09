use crate::state::persistence::{self, SessionData};

#[tauri::command]
pub fn save_session(data: SessionData) -> Result<(), String> {
    persistence::save(&data)
}

#[tauri::command]
pub fn load_session() -> Result<Option<SessionData>, String> {
    persistence::load()
}
