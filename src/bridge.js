/**
 * Tauri IPC bridge.
 * In dev (plain browser), all calls are no-ops that log to console.
 * In production (Tauri webview), calls go through to Rust via invoke().
 */

const isTauri = typeof window !== 'undefined' && '__TAURI__' in window;

async function invoke(cmd, args = {}) {
  if (isTauri) {
    const { invoke: tauriInvoke } = await import('@tauri-apps/api/core');
    return tauriInvoke(cmd, args);
  }
  console.log(`[bridge] ${cmd}`, args);
  return null;
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
};
