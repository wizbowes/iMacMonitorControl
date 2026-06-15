mod backend;
mod commands;
mod config;
mod tray;

use std::sync::{atomic::AtomicUsize, Arc};

use backend::PlatformBackend;
use tauri::{Manager, WindowEvent};

pub struct AppState {
    pub backend:              Arc<dyn backend::MonitorBackend>,
    pub active_monitor_index: Arc<AtomicUsize>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .manage(AppState {
            backend:              Arc::new(PlatformBackend::new()),
            active_monitor_index: Arc::new(AtomicUsize::new(0)),
        })
        .invoke_handler(tauri::generate_handler![
            commands::cmd_power,
            commands::cmd_select_source,
            commands::cmd_open_menu,
            commands::cmd_nav_up,
            commands::cmd_nav_down,
            commands::cmd_enumerate,
            commands::cmd_set_active_index,
            commands::cmd_load_config,
            commands::cmd_save_config,
            commands::cmd_resize_window,
            commands::cmd_ha_get_state,
            commands::cmd_ha_set_state,
            commands::cmd_ha_list_entities,
            commands::cmd_set_dock_hidden,
            commands::cmd_esphome_press,
        ])
        .setup(|app| {
            // Apply persisted dock-visibility preference before the window shows.
            let cfg = config::load();
            if cfg.hide_dock_icon {
                #[cfg(target_os = "macos")]
                let _ = app.handle().set_activation_policy(tauri::ActivationPolicy::Accessory);
            }
            tray::setup_tray(&app.handle())?;
            // Re-assert no native shadow: the config flag alone has been seen
            // to leave the macOS 26 glass rim around the borderless window.
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_shadow(false);
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            // Hide popup when it loses focus (click outside).
            if let WindowEvent::Focused(false) = event {
                if window.label() == "main" {
                    let _ = window.hide();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error running iMac Monitor Control");
}
