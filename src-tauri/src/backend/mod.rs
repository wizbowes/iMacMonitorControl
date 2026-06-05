use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum BackendError {
    #[error("DDC/CI command failed: {0}")]
    Ddc(String),
    #[error("Monitor not found")]
    NotFound,
    #[error("Platform error: {0}")]
    Platform(String),
}

pub type Result<T> = std::result::Result<T, BackendError>;

/// VCP codes used across the app.
pub mod vcp {
    pub const POWER:  u8 = 0xD6;
    pub const SOURCE: u8 = 0x60;
    pub const OSD:    u8 = 0xCA;
}

/// Standard MCCS input-source values for VCP 0x60.
pub mod source {
    pub const USB:          u16 = 0x1B;
    pub const DISPLAY_PORT_1: u16 = 0x0F;
    pub const DISPLAY_PORT_2: u16 = 0x10;
    pub const HDMI_1:       u16 = 0x11;
    pub const HDMI_2:       u16 = 0x12;
}

pub fn port_to_vcp_value(port: &str) -> Option<u16> {
    match port {
        "USB"            => Some(source::USB),
        "Display Port 1" => Some(source::DISPLAY_PORT_1),
        "Display Port 2" => Some(source::DISPLAY_PORT_2),
        "HDMI 1"         => Some(source::HDMI_1),
        "HDMI 2"         => Some(source::HDMI_2),
        _                => None,
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MonitorInfo {
    pub name: String,
    pub ip:   Option<String>,
}

/// Platform-agnostic DDC/CI backend. Each platform provides an impl.
pub trait MonitorBackend: Send + Sync {
    /// Write a raw VCP value to the monitor. `monitor_index` is the OS-level
    /// display index (0-based). Returns Ok(()) on success.
    fn set_vcp(&self, monitor_index: usize, code: u8, value: u16) -> Result<()>;

    /// Return a list of connected monitors the OS can see.
    fn enumerate(&self) -> Result<Vec<MonitorInfo>>;
}

// ── Platform selection ────────────────────────────────────────────────────────

#[cfg(target_os = "macos")]
mod macos;
#[cfg(target_os = "macos")]
pub use macos::MacBackend as PlatformBackend;

#[cfg(target_os = "windows")]
mod windows;
#[cfg(target_os = "windows")]
pub use windows::WinBackend as PlatformBackend;

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
mod stub;
#[cfg(not(any(target_os = "macos", target_os = "windows")))]
pub use stub::StubBackend as PlatformBackend;
