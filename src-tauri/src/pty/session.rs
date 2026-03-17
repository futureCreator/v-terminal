use portable_pty::{Child, MasterPty};
use std::io::Write;
use tokio::task::JoinHandle;

pub struct PtySession {
    pub writer: Box<dyn Write + Send>,
    pub master: Box<dyn MasterPty + Send>,
    pub child: Box<dyn Child + Send + Sync>,
    pub _reader_task: JoinHandle<()>,
}

// Safety: all field access is serialized through PtyManager's std::sync::Mutex.
// portable-pty types are not Send on all platforms, but exclusive Mutex access
// guarantees no concurrent use.
unsafe impl Send for PtySession {}
