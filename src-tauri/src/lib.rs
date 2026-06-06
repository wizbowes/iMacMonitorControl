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

/// Set the WKWebView to fully transparent.
/// Must be called after the webview is initialised (i.e. after first show).
#[cfg(target_os = "macos")]
pub fn make_webview_transparent(window: &tauri::WebviewWindow<impl tauri::Runtime>) {
    window.with_webview(|wv| {
        unsafe {
            use objc::{msg_send, sel, sel_impl};
            use objc::runtime::{Class, Object};
            use std::os::raw::c_char;

            let view = wv.inner() as *mut Object;

            // 1. Standard NSView opacity
            let () = msg_send![view, setOpaque: false];

            // 2. NSView background colour → clear
            let ns_color = Class::get("NSColor").unwrap();
            let clear: *mut Object = msg_send![ns_color, clearColor];
            let () = msg_send![view, setBackgroundColor: clear];

            // 3. WKWebView-specific: disable its own background drawing
            //    (needed on macOS Sequoia+)
            let ns_number = Class::get("NSNumber").unwrap();
            let no: *mut Object = msg_send![ns_number, numberWithBool: false];
            let ns_string = Class::get("NSString").unwrap();
            let key: *mut Object = msg_send![
                ns_string,
                stringWithUTF8String: b"drawsBackground\0".as_ptr() as *const c_char
            ];
            let () = msg_send![view, setValue: no forKey: key];
        }
    }).ok();
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
        ])
        .setup(|app| {
            tray::setup_tray(&app.handle())?;
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
