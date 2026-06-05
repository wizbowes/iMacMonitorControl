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
            position_near_tray(app, &window);
            let _ = window.show();
            let _ = window.set_focus();
        }
    }
}

fn position_near_tray<R: Runtime>(app: &AppHandle<R>, window: &tauri::WebviewWindow<R>) {
    let Some(tray) = app.tray_by_id("main") else { return };
    let Ok(Some(rect)) = tray.rect() else { return };

    // Scale factor for converting physical ↔ logical coordinates.
    let scale = window
        .current_monitor()
        .ok()
        .flatten()
        .map(|m| m.scale_factor())
        .unwrap_or(1.0);

    let screen_w = window
        .current_monitor()
        .ok()
        .flatten()
        .map(|m| m.size().to_logical::<f64>(scale).width)
        .unwrap_or(1920.0);

    // Convert tray rect to logical pixels.
    let tray_x    = rect.position.to_logical::<f64>(scale).x;
    let tray_y    = rect.position.to_logical::<f64>(scale).y;
    let tray_w    = rect.size.to_logical::<f64>(scale).width;
    let tray_h    = rect.size.to_logical::<f64>(scale).height;

    let popup_w = 380.0_f64;
    let popup_h = 100.0_f64;

    let cx = tray_x + tray_w / 2.0;
    let x  = cx.sub(popup_w / 2.0).max(8.0).min(screen_w - popup_w - 8.0);

    // macOS: popup hangs below the menubar icon.
    // Windows/Linux: popup floats above the taskbar icon.
    #[cfg(target_os = "macos")]
    let y = tray_y + tray_h + 6.0;

    #[cfg(not(target_os = "macos"))]
    let y = tray_y - popup_h - 8.0;

    let _ = window.set_position(tauri::LogicalPosition::new(x, y));
}

fn load_tray_icon<R: Runtime>(app: &AppHandle<R>) -> Image<'static> {
    app.default_window_icon()
        .map(|img| img.clone().to_owned())
        .unwrap_or_else(|| Image::new_owned(vec![], 0, 0))
}

// Helper trait to subtract without needing a temporary binding.
trait Sub: Sized {
    fn sub(self, rhs: Self) -> Self;
}
impl Sub for f64 {
    fn sub(self, rhs: f64) -> f64 { self - rhs }
}
