/**
 * Tauri IPC bridge.
 * In dev (plain browser), all calls are no-ops that log to console.
 * In production (Tauri webview), calls go through to Rust via invoke().
 */

// __TAURI_INTERNALS__ is always injected by Tauri v2; __TAURI__ only exists
// when withGlobalTauri is enabled, so it must not be the only check.
const isTauri =
  typeof window !== 'undefined' &&
  ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);

async function invoke(cmd, args = {}) {
  if (isTauri) {
    const { invoke: tauriInvoke } = await import('@tauri-apps/api/core');
    return tauriInvoke(cmd, args);
  }
  console.log(`[bridge] ${cmd}`, args);
  return null;
}

// POST to the monitor's HTTP API (ESPHome or compatible).
// Rejects with an Error if ip is empty or the request fails.
export async function monitorPost(ip, path) {
  if (!ip) throw new Error('No IP address configured for this monitor');
  const res = await fetch(`http://${ip}${path}`, { method: 'POST' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

export const backend = {
  power:         (on)    => invoke('cmd_power',          { on }),
  selectSource:  (port)  => invoke('cmd_select_source',  { port }),
  openMenu:      ()      => invoke('cmd_open_menu'),
  navUp:         ()      => invoke('cmd_nav_up'),
  navDown:       ()      => invoke('cmd_nav_down'),
  enumerate:     ()      => invoke('cmd_enumerate'),
  setActiveIndex:(index) => invoke('cmd_set_active_index', { index }),
  loadConfig:    ()      => invoke('cmd_load_config'),
  saveConfig:    (config)=> invoke('cmd_save_config',    { config }),
  resizeWindow:  (width, height) => invoke('cmd_resize_window', { width, height }),
  haGetState:    (url, token, entityId) => invoke('cmd_ha_get_state',    { url, token, entityId }),
  haSetState:    (url, token, entityId, on) => invoke('cmd_ha_set_state', { url, token, entityId, on }),
  haListEntities:(url, token)            => invoke('cmd_ha_list_entities', { url, token }),
  setDockHidden:   (hide)                     => invoke('cmd_set_dock_hidden',   { hide }),
  espHomePress:    (ip, component)            => invoke('cmd_esphome_press',     { ip, component }),
};
