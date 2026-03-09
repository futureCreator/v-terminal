use portable_pty::MasterPty;
use std::io::Write;
use tokio::task::JoinHandle;

pub struct PtySession {
    pub master: Box<dyn MasterPty + Send>,
    pub writer: Box<dyn Write + Send>,
    pub _reader_task: JoinHandle<()>,
}

unsafe impl Send for PtySession {}
