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

// ── Home Assistant integration ────────────────────────────────────────────────

#[derive(Deserialize)]
struct HaApiAttributes {
    friendly_name: Option<String>,
    icon:          Option<String>,
}

#[derive(Deserialize)]
struct HaApiState {
    entity_id: String,
    state:     String,
    attributes: HaApiAttributes,
}

#[derive(Serialize)]
pub struct HaEntityState {
    pub state:         String,
    pub friendly_name: String,
    pub icon:          Option<String>,
}

#[derive(Serialize)]
pub struct HaEntity {
    pub entity_id:     String,
    pub friendly_name: String,
}

#[tauri::command]
pub async fn cmd_ha_get_state(url: String, token: String, entity_id: String) -> CmdResult<HaEntityState> {
    let url   = url.trim().trim_end_matches('/').to_string();
    let token = token.trim().to_string();
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()?;
    let resp = client
        .get(format!("{}/api/states/{}", url, entity_id))
        .header("Authorization", format!("Bearer {}", token))
        .header("Content-Type", "application/json")
        .send()
        .await?;
    if !resp.status().is_success() {
        return Err(CmdError(format!("HA {} on get_state", resp.status())));
    }
    let body: HaApiState = resp.json().await?;
    Ok(HaEntityState {
        friendly_name: body.attributes.friendly_name.unwrap_or_else(|| entity_id.clone()),
        state: body.state,
        icon:  body.attributes.icon,
    })
}

#[tauri::command]
pub async fn cmd_ha_set_state(url: String, token: String, entity_id: String, on: bool) -> CmdResult {
    let url   = url.trim().trim_end_matches('/').to_string();
    let token = token.trim().to_string();
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()?;
    // Use the entity's own domain service; scenes/scripts are always turn_on only.
    let domain  = entity_id.split('.').next().unwrap_or("homeassistant");
    let service = match domain {
        "scene" | "script" => format!("{}/turn_on", domain),
        _                  => format!("{}/{}", domain, if on { "turn_on" } else { "turn_off" }),
    };
    let resp = client
        .post(format!("{}/api/services/{}", url, service))
        .header("Authorization", format!("Bearer {}", token))
        .header("Content-Type", "application/json")
        .json(&serde_json::json!({ "entity_id": entity_id }))
        .send()
        .await?;
    if !resp.status().is_success() {
        return Err(CmdError(format!("HA {} calling {}", resp.status(), service)));
    }
    Ok(())
}

#[tauri::command]
pub async fn cmd_ha_list_entities(url: String, token: String) -> CmdResult<Vec<HaEntity>> {
    let url   = url.trim().trim_end_matches('/').to_string();
    let token = token.trim().to_string();
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()?;
    let resp = client
        .get(format!("{}/api/states", url))
        .header("Authorization", format!("Bearer {}", token))
        .header("Content-Type", "application/json")
        .send()
        .await?;
    if !resp.status().is_success() {
        return Err(CmdError(format!("HA {} on list_entities", resp.status())));
    }
    let states: Vec<HaApiState> = resp.json().await?;
    let mut result: Vec<HaEntity> = states
        .into_iter()
        .filter(|s| {
            let domain = s.entity_id.split('.').next().unwrap_or("");
            matches!(domain, "light" | "switch" | "scene" | "script" | "group" | "input_boolean")
        })
        .map(|s| HaEntity {
            friendly_name: s.attributes.friendly_name.unwrap_or_else(|| s.entity_id.clone()),
            entity_id: s.entity_id,
        })
        .collect();
    result.sort_by(|a, b| a.friendly_name.cmp(&b.friendly_name));
    Ok(result)
}

/// Press a button component on an ESPHome device via its native HTTP API.
/// Component names (e.g. "power", "up", "down", "menu") must match the `id`
/// in the ESPHome YAML.  No auth is required unless the device is configured
/// with api_encryption / api_password.
#[tauri::command]
pub async fn cmd_esphome_press(ip: String, component: String) -> CmdResult {
    let ip = ip.trim().to_string();
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()?;
    let url = format!("http://{}/button/{}/press", ip, component);
    let resp = client.post(&url).send().await?;
    if !resp.status().is_success() {
        return Err(CmdError(format!("ESPHome {} ({})", resp.status(), url)));
    }
    Ok(())
}

/// Hide or show the app in the macOS Dock (no-op on other platforms).
#[tauri::command]
pub fn cmd_set_dock_hidden(app: tauri::AppHandle, hide: bool) -> CmdResult {
    #[cfg(target_os = "macos")]
    {
        let policy = if hide {
            tauri::ActivationPolicy::Accessory
        } else {
            tauri::ActivationPolicy::Regular
        };
        app.set_activation_policy(policy).map_err(|e| CmdError(e.to_string()))?;
    }
    Ok(())
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
