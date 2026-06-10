use tauri::{
    image::Image,
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, Runtime,
};

pub fn setup_tray<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    let icon = load_tray_icon(app);

    TrayIconBuilder::with_id("main")
        .icon(icon)
        .tooltip("iMac Monitor Control")
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                toggle_popup(app);
            }
        })
        .build(app)?;

    Ok(())
}

fn toggle_popup<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window("main") {
        if window.is_visible().unwrap_or(false) {
            let _ = window.hide();
        } else {
            // The frontend keeps the window sized to its content via
            // cmd_resize_window; just anchor it to the tray and show.
            let (w, h) = logical_size(&window);
            position_near_tray(app, &window, w, h);
            let _ = window.show();
            let _ = window.set_focus();
        }
    }
}

fn scale_factor<R: Runtime>(window: &tauri::WebviewWindow<R>) -> f64 {
    window
        .current_monitor()
        .ok()
        .flatten()
        .map(|m| m.scale_factor())
        .unwrap_or(1.0)
}

fn logical_size<R: Runtime>(window: &tauri::WebviewWindow<R>) -> (f64, f64) {
    let scale = scale_factor(window);
    window
        .outer_size()
        .map(|s| {
            let s = s.to_logical::<f64>(scale);
            (s.width, s.height)
        })
        .unwrap_or((412.0, 150.0))
}

/// Anchor the popup to the tray icon: hanging below the menubar icon on
/// macOS, floating above the taskbar icon on Windows/Linux. `popup_w`/`popup_h`
/// are the window's logical dimensions (passed in because a just-requested
/// resize may not be reflected by `outer_size()` yet).
pub fn position_near_tray<R: Runtime>(
    app: &AppHandle<R>,
    window: &tauri::WebviewWindow<R>,
    popup_w: f64,
    popup_h: f64,
) {
    let Some(tray) = app.tray_by_id("main") else { return };
    let Ok(Some(rect)) = tray.rect() else { return };

    let scale = scale_factor(window);

    let screen_w = window
        .current_monitor()
        .ok()
        .flatten()
        .map(|m| m.size().to_logical::<f64>(scale).width)
        .unwrap_or(1920.0);

    let tray_pos  = rect.position.to_logical::<f64>(scale);
    let tray_size = rect.size.to_logical::<f64>(scale);

    let cx = tray_pos.x + tray_size.width / 2.0;
    let x  = (cx - popup_w / 2.0).max(8.0).min(screen_w - popup_w - 8.0);

    // The window already carries transparent padding around the card (for its
    // drop shadow), so no extra gap is needed here.
    let y = if cfg!(target_os = "macos") {
        tray_pos.y + tray_size.height
    } else {
        tray_pos.y - popup_h
    };

    let _ = window.set_position(tauri::LogicalPosition::new(x, y));
}

fn load_tray_icon<R: Runtime>(app: &AppHandle<R>) -> Image<'static> {
    app.default_window_icon()
        .map(|img| img.clone().to_owned())
        .unwrap_or_else(|| Image::new_owned(vec![], 0, 0))
}
