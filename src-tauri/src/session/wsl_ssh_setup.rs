use std::path::PathBuf;

/// Cached connection info for a WSL distro with sshd running.
#[derive(Debug, Clone)]
pub struct WslSshInfo {
    pub port: u16,
    pub username: String,
    pub key_path: String,
    pub sshd_pid: Option<u32>,
}

const WSL_SSH_BASE_PORT: u16 = 2222;
const WSL_SSH_MAX_PORT: u16 = 2242;

/// Directory for v-terminal WSL SSH files (keys, known_hosts).
fn vterminal_dir() -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or("cannot determine home directory")?;
    let dir = home.join(".vterminal");
    if !dir.exists() {
        std::fs::create_dir_all(&dir)
            .map_err(|e| format!("failed to create .vterminal dir: {e}"))?;
    }
    Ok(dir)
}

/// Path to the v-terminal dedicated SSH private key.
fn wsl_key_path() -> Result<PathBuf, String> {
    Ok(vterminal_dir()?.join("wsl_id_ed25519"))
}

/// Path to the WSL-specific known_hosts file.
pub fn wsl_known_hosts_path() -> Result<PathBuf, String> {
    Ok(vterminal_dir()?.join("wsl_known_hosts"))
}

/// Run a command inside a WSL distro and return (stdout, stderr, exit_code).
#[cfg(windows)]
fn wsl_exec(distro: &str, command: &str) -> Result<(String, String, i32), String> {
    use std::os::windows::process::CommandExt;
    let output = std::process::Command::new("wsl")
        .args(["-d", distro, "--", "bash", "-c", command])
        .creation_flags(0x08000000) // CREATE_NO_WINDOW
        .output()
        .map_err(|e| format!("wsl exec failed: {e}"))?;
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    let code = output.status.code().unwrap_or(-1);
    Ok((stdout, stderr, code))
}

#[cfg(not(windows))]
fn wsl_exec(_distro: &str, _command: &str) -> Result<(String, String, i32), String> {
    Err("WSL is only available on Windows".to_string())
}

/// Run a command with sudo, optionally providing a password via stdin.
#[cfg(windows)]
fn wsl_sudo_exec(
    distro: &str,
    command: &str,
    password: Option<&str>,
) -> Result<(String, String, i32), String> {
    use std::os::windows::process::CommandExt;
    use std::io::Write;

    let sudo_cmd = if password.is_some() {
        format!("sudo -S {command}")
    } else {
        format!("sudo -n {command}")
    };

    let mut child = std::process::Command::new("wsl")
        .args(["-d", distro, "--", "bash", "-c", &sudo_cmd])
        .creation_flags(0x08000000)
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("wsl sudo exec failed: {e}"))?;

    if let Some(pw) = password {
        if let Some(mut stdin) = child.stdin.take() {
            let _ = writeln!(stdin, "{pw}");
        }
    }

    let output = child.wait_with_output()
        .map_err(|e| format!("wsl sudo wait failed: {e}"))?;
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    let code = output.status.code().unwrap_or(-1);
    Ok((stdout, stderr, code))
}

#[cfg(not(windows))]
fn wsl_sudo_exec(
    _distro: &str,
    _command: &str,
    _password: Option<&str>,
) -> Result<(String, String, i32), String> {
    Err("WSL is only available on Windows".to_string())
}

/// Ensure the v-terminal SSH key pair exists. Generate if missing.
fn ensure_key_pair() -> Result<String, String> {
    let key_path = wsl_key_path()?;
    if key_path.exists() {
        return Ok(key_path.to_string_lossy().into_owned());
    }

    // Generate ed25519 key pair using ssh-keygen (available on Windows 10+)
    let pub_path = key_path.with_extension("pub");
    let output = std::process::Command::new("ssh-keygen")
        .args([
            "-t", "ed25519",
            "-f", &key_path.to_string_lossy(),
            "-N", "", // empty passphrase
            "-C", "v-terminal-wsl",
        ])
        .output()
        .map_err(|e| format!("ssh-keygen failed: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("ssh-keygen failed: {stderr}"));
    }

    if !key_path.exists() || !pub_path.exists() {
        return Err("ssh-keygen did not produce expected key files".to_string());
    }

    Ok(key_path.to_string_lossy().into_owned())
}

/// Read the public key content for authorized_keys registration.
fn read_public_key() -> Result<String, String> {
    let pub_path = wsl_key_path()?.with_extension("pub");
    std::fs::read_to_string(&pub_path)
        .map(|s| s.trim().to_string())
        .map_err(|e| format!("failed to read public key: {e}"))
}

/// Find a free port for sshd in the WSL distro, or reuse an existing v-terminal sshd.
fn find_sshd_port(distro: &str) -> Result<u16, String> {
    for port in WSL_SSH_BASE_PORT..=WSL_SSH_MAX_PORT {
        let (stdout, _, _) = wsl_exec(
            distro,
            &format!("ss -tln 2>/dev/null | grep -q ':{port} ' && echo used || echo free"),
        )?;
        if stdout.contains("free") {
            return Ok(port);
        }
        // Port is in use — check if it's our sshd
        let (proc_out, _, _) = wsl_exec(
            distro,
            &format!("ss -tlnp 2>/dev/null | grep ':{port} ' | grep -o 'pid=[0-9]*' | head -1"),
        )?;
        if proc_out.is_empty() {
            continue;
        }
        let pid_str = proc_out.trim_start_matches("pid=");
        let (cmd_out, _, _) = wsl_exec(
            distro,
            &format!("cat /proc/{pid_str}/cmdline 2>/dev/null | tr '\\0' ' '"),
        )?;
        if cmd_out.contains("sshd") && cmd_out.contains("vterminal_sshd") {
            return Ok(port);
        }
    }
    Err(format!("no free port found in range {WSL_SSH_BASE_PORT}-{WSL_SSH_MAX_PORT}"))
}

/// Start sshd inside the WSL distro with a v-terminal config.
fn start_sshd(
    distro: &str,
    port: u16,
    sudo_password: Option<&str>,
) -> Result<Option<u32>, String> {
    let config_path = format!("/tmp/vterminal_sshd_{port}.conf");
    let config_content = format!(
        "ListenAddress 127.0.0.1\nPort {port}\nPubkeyAuthentication yes\nPasswordAuthentication no\nAuthorizedKeysFile .ssh/authorized_keys\nHostKey /etc/ssh/ssh_host_ed25519_key\nHostKey /etc/ssh/ssh_host_rsa_key"
    );

    // Write config file
    let write_cmd = format!("cat > {config_path} << 'VTEOF'\n{config_content}\nVTEOF");
    let (_, _, code) = wsl_exec(distro, &write_cmd)?;
    if code != 0 {
        return Err(format!("failed to write sshd config to {config_path}"));
    }

    // Generate host keys if missing
    let (_, _, _) = wsl_sudo_exec(distro, "ssh-keygen -A 2>/dev/null", sudo_password)?;

    // Start sshd
    let (_, stderr, code) = wsl_sudo_exec(
        distro,
        &format!("/usr/sbin/sshd -f {config_path}"),
        sudo_password,
    )?;

    if code != 0 {
        if stderr.contains("password is required") || stderr.contains("sudo:") {
            return Err(format!("{{\"code\":\"WSL_SUDO_REQUIRED\",\"distro\":\"{distro}\"}}"));
        }
        return Err(format!("failed to start sshd: {stderr}"));
    }

    // Get sshd PID
    let (pid_out, _, _) = wsl_exec(
        distro,
        &format!("ss -tlnp 2>/dev/null | grep ':{port} ' | grep -o 'pid=[0-9]*' | head -1"),
    )?;
    let pid = pid_out.trim_start_matches("pid=").parse::<u32>().ok();

    Ok(pid)
}

/// Ensure sshd is running in the given WSL distro and return connection info.
pub fn ensure_sshd(
    distro: &str,
    sudo_password: Option<&str>,
) -> Result<WslSshInfo, String> {
    // 1. Get username
    let (username, _, code) = wsl_exec(distro, "whoami")?;
    if code != 0 || username.is_empty() {
        return Err(format!("failed to get WSL username for {distro}"));
    }

    // 2. Check if sshd is installed
    let (_, _, sshd_code) = wsl_exec(distro, "which sshd")?;
    if sshd_code != 0 {
        let (_, _, apt_check) = wsl_exec(distro, "which apt-get")?;
        if apt_check != 0 {
            return Err(format!(
                "openssh-server is not installed in {distro}. \
                 Please install it manually (e.g., `sudo apt-get install openssh-server` \
                 or equivalent for your distro)."
            ));
        }
        let (_, stderr, code) = wsl_sudo_exec(
            distro,
            "apt-get update -qq && apt-get install -y -qq openssh-server",
            sudo_password,
        )?;
        if code != 0 {
            if stderr.contains("password is required") || stderr.contains("sudo:") {
                return Err(format!("{{\"code\":\"WSL_SUDO_REQUIRED\",\"distro\":\"{distro}\"}}"));
            }
            return Err(format!("failed to install openssh-server: {stderr}"));
        }
    }

    // 3. Ensure SSH key pair
    let key_path = ensure_key_pair()?;

    // 4. Register public key
    let pubkey = read_public_key()?;
    let (_, _, grep_code) = wsl_exec(
        distro,
        &format!("grep -qF '{pubkey}' ~/.ssh/authorized_keys 2>/dev/null"),
    )?;
    if grep_code != 0 {
        let register_cmd = format!(
            "mkdir -p ~/.ssh && chmod 700 ~/.ssh && echo '{}' >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys",
            pubkey
        );
        let (_, _, code) = wsl_exec(distro, &register_cmd)?;
        if code != 0 {
            return Err("failed to register public key in WSL authorized_keys".to_string());
        }
    }

    // 5. Find port and start sshd
    let port = find_sshd_port(distro)?;

    let (probe, _, _) = wsl_exec(
        distro,
        &format!("ss -tln 2>/dev/null | grep -q ':{port} ' && echo running || echo stopped"),
    )?;

    let sshd_pid = if probe.contains("running") {
        let (pid_out, _, _) = wsl_exec(
            distro,
            &format!("ss -tlnp 2>/dev/null | grep ':{port} ' | grep -o 'pid=[0-9]*' | head -1"),
        )?;
        pid_out.trim_start_matches("pid=").parse::<u32>().ok()
    } else {
        start_sshd(distro, port, sudo_password)?
    };

    Ok(WslSshInfo {
        port,
        username,
        key_path,
        sshd_pid,
    })
}

/// Kill the sshd process for a distro (used during app shutdown).
pub fn kill_sshd(distro: &str, pid: u32) {
    let _ = wsl_exec(distro, &format!("kill {pid} 2>/dev/null"));
}
