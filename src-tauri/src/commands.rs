use serde::{Deserialize, Serialize};
use tauri::State;

use crate::{
    backend::{port_to_vcp_value, vcp, MonitorBackend},
    config::{self, AppConfig},
    AppState,
};

// ── IPC error type ────────────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct CmdError(String);

impl<E: std::fmt::Display> From<E> for CmdError {
    fn from(e: E) -> Self {
        CmdError(e.to_string())
    }
}

type CmdResult<T = ()> = Result<T, CmdError>;

// ── Helpers ───────────────────────────────────────────────────────────────────

fn backend_index(state: &AppState) -> usize {
    // The active monitor index in the UI maps directly to the OS display index.
    // When a user names/IPs a monitor we don't re-order OS displays, so index 0
    // is always the primary display. Multi-monitor support wires this properly.
    state.active_monitor_index.load(std::sync::atomic::Ordering::Relaxed)
}

// ── DDC/CI commands ───────────────────────────────────────────────────────────

/// Toggle monitor power.
/// `on = true`  → VCP 0xD6 = 0x01 (normal operation)
/// `on = false` → VCP 0xD6 = 0x05 (standby)
#[tauri::command]
pub fn cmd_power(on: bool, state: State<AppState>) -> CmdResult {
    let idx = backend_index(&state);
    let value: u16 = if on { 0x01 } else { 0x05 };
    state.backend.set_vcp(idx, vcp::POWER, value)?;
    Ok(())
}

/// Switch input source. `port` is one of the PORTS constants from the frontend.
#[tauri::command]
pub fn cmd_select_source(port: String, state: State<AppState>) -> CmdResult {
    let idx = backend_index(&state);
    let value = port_to_vcp_value(&port)
        .ok_or_else(|| CmdError(format!("Unknown port: {port}")))?;
    state.backend.set_vcp(idx, vcp::SOURCE, value)?;
    Ok(())
}

/// Open the monitor's OSD menu. VCP 0xCA = 0x01.
#[tauri::command]
pub fn cmd_open_menu(state: State<AppState>) -> CmdResult {
    let idx = backend_index(&state);
    state.backend.set_vcp(idx, vcp::OSD, 0x01)?;
    Ok(())
}

/// OSD navigate up. VCP 0xCB = 0x05 (MCCS "OSD / Key Code" up).
/// NOTE: Verify against your specific monitor model — codes vary.
#[tauri::command]
pub fn cmd_nav_up(state: State<AppState>) -> CmdResult {
    let idx = backend_index(&state);
    state.backend.set_vcp(idx, 0xCB, 0x05)?;
    Ok(())
}

/// OSD navigate down. VCP 0xCB = 0x06.
#[tauri::command]
pub fn cmd_nav_down(state: State<AppState>) -> CmdResult {
    let idx = backend_index(&state);
    state.backend.set_vcp(idx, 0xCB, 0x06)?;
    Ok(())
}

// ── Monitor enumeration ───────────────────────────────────────────────────────

#[derive(Serialize)]
pub struct MonitorEntry {
    pub name: String,
    pub ip:   Option<String>,
}

/// Return the OS-visible monitor list.
#[tauri::command]
pub fn cmd_enumerate(state: State<AppState>) -> CmdResult<Vec<MonitorEntry>> {
    let list = state.backend.enumerate()?;
    Ok(list
        .into_iter()
        .map(|m| MonitorEntry { name: m.name, ip: m.ip })
        .collect())
}

/// Set which monitor index (0-based OS display index) is the active target.
#[tauri::command]
pub fn cmd_set_active_index(index: usize, state: State<AppState>) {
    state
        .active_monitor_index
        .store(index, std::sync::atomic::Ordering::Relaxed);
}

// ── Config persistence ────────────────────────────────────────────────────────

#[tauri::command]
pub fn cmd_load_config() -> CmdResult<AppConfig> {
    Ok(config::load())
}

#[tauri::command]
pub fn cmd_save_config(config: AppConfig) -> CmdResult {
    config::save(&config).map_err(CmdError)
}

/// Resize the popup to fit its content (called by the frontend whenever the
/// rendered card changes height), then re-anchor it to the tray icon so it
/// grows downward from the menubar on macOS and upward from the taskbar on
/// Windows.
#[tauri::command]
pub fn cmd_resize_window(
    app: tauri::AppHandle,
    window: tauri::WebviewWindow,
    width: f64,
    height: f64,
) -> CmdResult {
    window.set_size(tauri::LogicalSize::new(width, height))?;
    crate::tray::position_near_tray(&app, &window, width, height);
    Ok(())
}
