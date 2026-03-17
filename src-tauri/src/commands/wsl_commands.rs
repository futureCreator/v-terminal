use crate::pty::manager::PtyManager;

#[tauri::command]
pub fn get_wsl_distros(state: tauri::State<'_, PtyManager>) -> Result<Vec<String>, String> {
    #[cfg(windows)]
    {
        let cached = state.wsl_distros_cache.get_or_init(|| {
            let mut cmd = std::process::Command::new("wsl");
            cmd.args(["--list", "--quiet"]);
            {
                use std::os::windows::process::CommandExt;
                cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
            }
            let Ok(output) = cmd.output() else {
                return vec![];
            };

            let bytes = output.stdout;
            let text = if bytes.len() >= 2 && bytes[1] == 0 {
                let u16_chars: Vec<u16> = bytes
                    .chunks_exact(2)
                    .map(|c| u16::from_le_bytes([c[0], c[1]]))
                    .collect();
                String::from_utf16_lossy(&u16_chars).to_string()
            } else {
                String::from_utf8_lossy(&bytes).to_string()
            };

            text.lines()
                .map(|l| l.trim().trim_start_matches('\u{feff}').to_string())
                .filter(|l| !l.is_empty())
                .collect()
        });

        Ok(cached.clone())
    }
    #[cfg(not(windows))]
    {
        let _ = state;
        Ok(vec![])
    }
}
