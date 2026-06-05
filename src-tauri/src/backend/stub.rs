/// Stub backend for Linux / CI builds.
/// Logs commands to stdout so the UI is fully exercisable without real hardware.
use super::{BackendError, MonitorBackend, MonitorInfo, Result};

pub struct StubBackend;

impl StubBackend {
    pub fn new() -> Self {
        StubBackend
    }
}

impl MonitorBackend for StubBackend {
    fn set_vcp(&self, monitor_index: usize, code: u8, value: u16) -> Result<()> {
        log::info!("[stub] set_vcp display={monitor_index} code=0x{code:02X} value={value}");
        Ok(())
    }

    fn enumerate(&self) -> Result<Vec<MonitorInfo>> {
        Ok(vec![MonitorInfo {
            name: "Stub Display".to_string(),
            ip:   None,
        }])
    }
}
