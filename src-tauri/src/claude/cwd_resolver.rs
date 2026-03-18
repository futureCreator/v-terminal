use crate::session::SessionType;
use crate::session::manager::SessionManager;

/// Result of CWD resolution.
#[derive(Debug, serde::Serialize)]
#[serde(tag = "type", content = "value", rename_all = "camelCase")]
pub enum CwdResult {
    Resolved(String),
    Pending,
}

/// Resolves the current working directory for a given session.
pub async fn resolve_cwd(
    manager: &SessionManager,
    session_id: &str,
) -> Result<CwdResult, String> {
    let (session_type, _connection_id) = manager.get_session_info(session_id).await?;

    match session_type {
        SessionType::Local => {
            // Try platform-specific CWD detection first, fall back to PTY injection
            match resolve_local_cwd(manager, session_id).await {
                Ok(result) => Ok(result),
                Err(_) => trigger_pty_cwd_injection(manager, session_id).await,
            }
        }
        SessionType::Wsl | SessionType::Ssh => {
            trigger_pty_cwd_injection(manager, session_id).await
        }
    }
}

/// Trigger PTY injection to get CWD from WSL or SSH session.
async fn trigger_pty_cwd_injection(
    manager: &SessionManager,
    session_id: &str,
) -> Result<CwdResult, String> {
    let cmd = b" echo -e \"\\x1b]7337;cwd;$(pwd)\\x07\"\r";
    manager.write(session_id, cmd).await?;
    Ok(CwdResult::Pending)
}

/// Resolve CWD for a local Windows session using the child process PID.
#[cfg(windows)]
async fn resolve_local_cwd(
    manager: &SessionManager,
    session_id: &str,
) -> Result<CwdResult, String> {
    let pid = manager
        .get_process_id(session_id)
        .await
        .ok_or("cannot get process id")?;

    let cwd = get_process_cwd_windows(pid)?;
    Ok(CwdResult::Resolved(cwd))
}

#[cfg(not(windows))]
async fn resolve_local_cwd(
    manager: &SessionManager,
    session_id: &str,
) -> Result<CwdResult, String> {
    // On macOS/Linux, use PTY injection
    trigger_pty_cwd_injection(manager, session_id).await
}

/// Query the current working directory of a Windows process by PID.
///
/// Uses `NtQueryInformationProcess` (loaded dynamically from ntdll.dll) to read
/// the process PEB, then reads `RTL_USER_PROCESS_PARAMETERS.CurrentDirectory`
/// via `ReadProcessMemory`. Struct offsets are for 64-bit Windows 10/11.
#[cfg(windows)]
fn get_process_cwd_windows(pid: u32) -> Result<String, String> {
    use std::mem;
    use std::ptr;

    use windows_sys::Win32::Foundation::HANDLE;
    use windows_sys::Win32::System::Diagnostics::Debug::ReadProcessMemory;
    use windows_sys::Win32::System::LibraryLoader::{GetModuleHandleA, GetProcAddress};
    use windows_sys::Win32::System::Threading::{
        OpenProcess, PROCESS_QUERY_INFORMATION, PROCESS_VM_READ,
    };

    // NtQueryInformationProcess signature (loaded dynamically from ntdll.dll)
    #[allow(non_snake_case)]
    type NtQueryInformationProcessFn = unsafe extern "system" fn(
        ProcessHandle: HANDLE,
        ProcessInformationClass: u32,
        ProcessInformation: *mut std::ffi::c_void,
        ProcessInformationLength: u32,
        ReturnLength: *mut u32,
    ) -> i32; // NTSTATUS

    const PROCESS_BASIC_INFORMATION_CLASS: u32 = 0;

    // PROCESS_BASIC_INFORMATION (64-bit layout)
    #[repr(C)]
    struct ProcessBasicInformation {
        reserved1: usize,
        peb_base_address: usize,
        reserved2: [usize; 2],
        unique_process_id: usize,
        reserved3: usize,
    }

    // PEB offset to ProcessParameters pointer (64-bit Windows 10/11)
    const PEB_PROCESS_PARAMETERS_OFFSET: usize = 0x20;

    // RTL_USER_PROCESS_PARAMETERS offset to CurrentDirectory.DosPath (64-bit)
    // CurrentDirectory is at 0x38; it begins with a UNICODE_STRING:
    //   { Length: u16, MaximumLength: u16, _pad: u32, Buffer: *const u16 }
    const PARAMS_CURRENT_DIR_OFFSET: usize = 0x38;

    // RAII guard: closes the HANDLE when dropped
    struct HandleGuard(HANDLE);
    impl Drop for HandleGuard {
        fn drop(&mut self) {
            unsafe {
                windows_sys::Win32::Foundation::CloseHandle(self.0);
            }
        }
    }

    unsafe {
        // Dynamically load NtQueryInformationProcess from ntdll.dll
        let ntdll = GetModuleHandleA(b"ntdll.dll\0".as_ptr());
        if ntdll.is_null() {
            return Err("failed to get handle to ntdll.dll".to_string());
        }

        let proc_addr = GetProcAddress(ntdll, b"NtQueryInformationProcess\0".as_ptr());
        let nt_query: NtQueryInformationProcessFn = match proc_addr {
            Some(addr) => mem::transmute(addr),
            None => return Err("NtQueryInformationProcess not found in ntdll.dll".to_string()),
        };

        // Open the target process with read permissions
        let handle = OpenProcess(PROCESS_QUERY_INFORMATION | PROCESS_VM_READ, 0, pid);
        if handle.is_null() {
            return Err(format!("OpenProcess failed for PID {pid}"));
        }
        let _guard = HandleGuard(handle); // ensures CloseHandle on scope exit

        // Query ProcessBasicInformation to obtain the PEB base address
        let mut pbi: ProcessBasicInformation = mem::zeroed();
        let mut return_length: u32 = 0;
        let status = nt_query(
            handle,
            PROCESS_BASIC_INFORMATION_CLASS,
            &mut pbi as *mut _ as *mut std::ffi::c_void,
            mem::size_of::<ProcessBasicInformation>() as u32,
            &mut return_length,
        );
        if status != 0 {
            return Err(format!("NtQueryInformationProcess failed: 0x{status:08x}"));
        }

        let peb_addr = pbi.peb_base_address;
        if peb_addr == 0 {
            return Err("PEB base address is null".to_string());
        }

        // Read ProcessParameters pointer from the PEB
        let mut params_ptr: usize = 0;
        let ok = ReadProcessMemory(
            handle,
            (peb_addr + PEB_PROCESS_PARAMETERS_OFFSET) as *const std::ffi::c_void,
            &mut params_ptr as *mut _ as *mut std::ffi::c_void,
            mem::size_of::<usize>(),
            ptr::null_mut(),
        );
        if ok == 0 || params_ptr == 0 {
            return Err("failed to read ProcessParameters pointer from PEB".to_string());
        }

        // Read the Length field of UNICODE_STRING (u16 at PARAMS_CURRENT_DIR_OFFSET)
        let mut length: u16 = 0;
        let ok = ReadProcessMemory(
            handle,
            (params_ptr + PARAMS_CURRENT_DIR_OFFSET) as *const std::ffi::c_void,
            &mut length as *mut _ as *mut std::ffi::c_void,
            mem::size_of::<u16>(),
            ptr::null_mut(),
        );
        if ok == 0 || length == 0 {
            return Err("failed to read CurrentDirectory UNICODE_STRING length".to_string());
        }

        // Read the Buffer pointer of UNICODE_STRING (usize at offset + 8)
        let mut buffer_ptr: usize = 0;
        let ok = ReadProcessMemory(
            handle,
            (params_ptr + PARAMS_CURRENT_DIR_OFFSET + 8) as *const std::ffi::c_void,
            &mut buffer_ptr as *mut _ as *mut std::ffi::c_void,
            mem::size_of::<usize>(),
            ptr::null_mut(),
        );
        if ok == 0 || buffer_ptr == 0 {
            return Err("failed to read CurrentDirectory buffer pointer".to_string());
        }

        // Read the UTF-16 path from the target process memory
        let char_count = (length as usize) / 2;
        let mut path_buf: Vec<u16> = vec![0u16; char_count];
        let ok = ReadProcessMemory(
            handle,
            buffer_ptr as *const std::ffi::c_void,
            path_buf.as_mut_ptr() as *mut std::ffi::c_void,
            length as usize,
            ptr::null_mut(),
        );
        if ok == 0 {
            return Err("failed to read CurrentDirectory path buffer".to_string());
        }

        // Convert UTF-16 to Rust String and strip any trailing backslash
        // (Windows appends a trailing backslash to the root drive, e.g. "C:\")
        let path = String::from_utf16_lossy(&path_buf);
        let path = path.trim_end_matches('\\').to_string();

        Ok(path)
    }
}
