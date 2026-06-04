/// macOS DDC/CI backend via m1ddc CLI subprocess.
///
/// m1ddc is a small open-source tool that wraps IOKit's IOAVService layer.
/// Install: brew install m1ddc
/// Fallback: ddcctl (Intel Macs)
///
/// Command format:
///   m1ddc set input <value>       (VCP 0x60)
///   m1ddc set luminance <value>   (VCP 0x10)
///   m1ddc set contrast <value>    (VCP 0x12)
///   m1ddc set <hex code> <value>  (generic)
///
/// For multi-monitor: m1ddc -d <N> set ...
///
/// STUB NOTE: The actual subprocess call is wired up; the real binary just
/// needs to be present on the system. Commands are fire-and-forget per spec.
use std::process::Command;

use super::{BackendError, MonitorBackend, MonitorInfo, Result};

pub struct MacBackend;

impl MacBackend {
    pub fn new() -> Self {
        MacBackend
    }

    fn m1ddc(&self, monitor_index: usize, args: &[&str]) -> Result<()> {
        let index_str = monitor_index.to_string();
        let mut cmd_args: Vec<&str> = vec!["-d", &index_str];
        cmd_args.extend_from_slice(args);

        let status = Command::new("m1ddc")
            .args(&cmd_args)
            .status()
            .map_err(|e| BackendError::Platform(format!("m1ddc not found: {e}")))?;

        if status.success() {
            Ok(())
        } else {
            Err(BackendError::Ddc(format!(
                "m1ddc exited with {:?}",
                status.code()
            )))
        }
    }
}

impl MonitorBackend for MacBackend {
    fn set_vcp(&self, monitor_index: usize, code: u8, value: u16) -> Result<()> {
        // m1ddc uses named subcommands for common codes; fall back to raw hex.
        let code_str = format!("0x{code:02X}");
        let value_str = value.to_string();
        self.m1ddc(monitor_index, &["set", &code_str, &value_str])
    }

    fn enumerate(&self) -> Result<Vec<MonitorInfo>> {
        // m1ddc display-count returns a number; build a list from that.
        let output = Command::new("m1ddc")
            .arg("display-count")
            .output()
            .map_err(|e| BackendError::Platform(format!("m1ddc not found: {e}")))?;

        let count_str = String::from_utf8_lossy(&output.stdout);
        let count: usize = count_str.trim().parse().unwrap_or(1);

        Ok((0..count)
            .map(|i| MonitorInfo {
                name: format!("Display {}", i + 1),
                ip:   None,
            })
            .collect())
    }
}
