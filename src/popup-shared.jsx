import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { backend, monitorPost } from './bridge.js';

// ───────────────────────── Icons (1.6px strokes, original) ─────────────────────────
const Stroke = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={props.weight || 1.6} strokeLinecap="round" strokeLinejoin="round"
    width={props.size || 18} height={props.size || 18} aria-hidden="true">{props.children}</svg>
);

const GEAR_PATH = (() => {
  const teeth = 8, Rtip = 10.4, Rbase = 7.6;
  const cx = 12, cy = 12;
  const step = (2 * Math.PI) / teeth;
  const half = step * 0.22;
  const r = (n) => n.toFixed(2);
  const at = (rad, ang) => [cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad];
  let d = '';
  for (let i = 0; i < teeth; i++) {
    const a = i * step - Math.PI / 2;
    const a1 = a - half, a2 = a + half;
    const an = (i + 1) * step - Math.PI / 2;
    const a3 = an - half;
    const [x1, y1] = at(Rbase, a1);
    const [x2, y2] = at(Rtip,  a1);
    const [x3, y3] = at(Rtip,  a2);
    const [x4, y4] = at(Rbase, a2);
    const [x5, y5] = at(Rbase, a3);
    if (i === 0) d += `M${r(x1)} ${r(y1)} `;
    d += `L${r(x2)} ${r(y2)} L${r(x3)} ${r(y3)} L${r(x4)} ${r(y4)} A${Rbase} ${Rbase} 0 0 1 ${r(x5)} ${r(y5)} `;
  }
  return d + 'Z';
})();

export const Icons = {
  Power: (p) => <Stroke {...p}><path d="M12 4 V12" /><path d="M7.5 7.2 A6 6 0 1 0 16.5 7.2" /></Stroke>,
  Source: (p) => (
    <Stroke {...p}>
      <rect x="2.5" y="4.5" width="19" height="12" rx="1.6" />
      <path d="M9 19.5 H15" /><path d="M12 16.5 V19.5" />
      <path d="M6 10.5 H13" /><path d="M11 8.5 L13 10.5 L11 12.5" />
    </Stroke>
  ),
  Up:   (p) => <Stroke {...p}><path d="M6 14 L12 8 L18 14" /></Stroke>,
  Down: (p) => <Stroke {...p}><path d="M6 10 L12 16 L18 10" /></Stroke>,
  Menu: (p) => <Stroke {...p}><path d="M5 7 H19" /><path d="M5 12 H19" /><path d="M5 17 H13" /></Stroke>,
  Gear: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={p.weight || 1.5} strokeLinejoin="round" strokeLinecap="round"
      width={p.size || 18} height={p.size || 18} aria-hidden="true">
      <path d={GEAR_PATH} /><circle cx="12" cy="12" r="3.1" />
    </svg>
  ),
  Back:         (p) => <Stroke {...p}><path d="M14 6 L8 12 L14 18" /></Stroke>,
  Close:        (p) => <Stroke {...p}><path d="M6 6 L18 18 M18 6 L6 18" /></Stroke>,
  Plus:         (p) => <Stroke {...p}><path d="M12 5 V19 M5 12 H19" /></Stroke>,
  Trash:        (p) => <Stroke {...p}><path d="M4 7 H20" /><path d="M9 7 V5.5 A1.5 1.5 0 0 1 10.5 4 H13.5 A1.5 1.5 0 0 1 15 5.5 V7" /><path d="M6 7 L7 19 A1.5 1.5 0 0 0 8.5 20.4 H15.5 A1.5 1.5 0 0 0 17 19 L18 7" /></Stroke>,
  Download:     (p) => <Stroke {...p}><path d="M12 4 V15" /><path d="M7 10 L12 15 L17 10" /><path d="M5 19 H19" /></Stroke>,
  Upload:       (p) => <Stroke {...p}><path d="M12 4 L12 15" /><path d="M7 9 L12 4 L17 9" /><path d="M5 19 H19" /></Stroke>,
  MonitorBadge: (p) => <Stroke {...p}><rect x="3" y="5" width="18" height="12" rx="1.6" /><path d="M9 20 H15" /><path d="M12 17 V20" /></Stroke>,
  Apple: (p) => (
    <svg viewBox="0 0 16 18" width={p.size || 13} height={(p.size || 13) * 18 / 16} fill="currentColor" aria-hidden="true">
      <path d="M11.4 9.4c0-1.9 1.5-2.8 1.6-2.9-.9-1.3-2.2-1.5-2.7-1.5-1.1-.1-2.2.7-2.8.7-.6 0-1.5-.7-2.5-.6-1.3 0-2.5.7-3.1 1.9-1.3 2.3-.3 5.7 1 7.6.6.9 1.4 2 2.4 1.9.9 0 1.3-.6 2.5-.6 1.1 0 1.5.6 2.5.6 1 0 1.7-.9 2.3-1.9.7-1.1 1-2.1 1-2.2-.1 0-2.1-.8-2.1-3zM9.7 3.6c.5-.6.8-1.5.7-2.4-.7 0-1.6.5-2.1 1.1-.4.5-.8 1.4-.7 2.3.8.1 1.6-.4 2.1-1z" />
    </svg>
  ),
  WiFi:    (p) => <Stroke {...p}><path d="M3 9 A14 14 0 0 1 21 9" /><path d="M6 12 A9 9 0 0 1 18 12" /><path d="M9 15 A4 4 0 0 1 15 15" /><circle cx="12" cy="18" r="0.8" fill="currentColor" /></Stroke>,
  Battery: (p) => <Stroke {...p}><rect x="2.5" y="8" width="16" height="8" rx="1.4" /><path d="M19.5 11 V13" /><rect x="4.5" y="10" width="9" height="4" fill="currentColor" stroke="none" /></Stroke>,
  Search:  (p) => <Stroke {...p}><circle cx="10.5" cy="10.5" r="5.5" /><path d="M14.5 14.5 L19 19" /></Stroke>,
  Cube:    (p) => <Stroke {...p}><path d="M12 3 L20 7 V17 L12 21 L4 17 V7 Z" /><path d="M4 7 L12 11 L20 7" /><path d="M12 11 V21" /></Stroke>,
  Bulb:    (p) => <Stroke {...p}><path d="M9 18h6M9.5 21h5" /><path d="M9.7 14A5.5 5.5 0 1 1 14.3 14L14 17H10L9.7 14z" /></Stroke>,
  Eye:     (p) => <Stroke {...p}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></Stroke>,
  EyeOff:  (p) => <Stroke {...p}><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><path d="M1 1l22 22" /></Stroke>,
};

// ───────────────────────── State ─────────────────────────
export const PORTS = ['USB', 'Display Port 1', 'Display Port 2', 'HDMI 1', 'HDMI 2'];

export function sourceLabel(s) { return s.device ? `${s.device} · ${s.port}` : s.port; }

let monitorSeq = 0;
function makeMonitor({ name, ip = '', labels = {}, power = true } = {}) {
  monitorSeq += 1;
  return {
    id: `m-${monitorSeq}-${Math.random().toString(36).slice(2, 6)}`,
    name: name || `Monitor ${monitorSeq}`,
    ip,
    power,
    labels,
    lastSourceSent: null,
    lastCmd:        null,
    lastCmdAt:      0,
  };
}

function seedMonitors() {
  return [makeMonitor({
    name:   'iMac',
    ip:     '192.168.1.21',
    labels: { USB: 'Mac', 'Display Port 1': 'Windows', 'HDMI 1': 'Work Laptop' },
  })];
}

export function useMonitorState() {
  const [monitors,  setMonitors]  = useState(seedMonitors);
  const [activeId,  setActiveId]  = useState(() => monitors[0].id);
  const [sourceMenu,setSourceMenu]= useState(false);
  const [flash,     setFlash]     = useState(null);
  const [toast,     setToast]     = useState(null);

  const [haConfig,      setHaConfig_]     = useState({ url: '', token: '', entities: [] });
  const [haEntityStates,setHaEntityStates]= useState({});
  const [haEntities,    setHaEntities]    = useState([]);
  const [haLoading,     setHaLoading]     = useState(false);
  const [hideDockIcon,  setHideDockIcon_] = useState(false);

  const pendingToggleRef = useRef(new Set());

  const mon = monitors.find((m) => m.id === activeId) || monitors[0];
  const sources = PORTS.map((p) => ({ port: p, device: (mon.labels || {})[p] || null }));

  // Sync active monitor's position to the backend so it targets the right display.
  useEffect(() => {
    const idx = monitors.findIndex((m) => m.id === activeId);
    backend.setActiveIndex(idx >= 0 ? idx : 0);
  }, [activeId, monitors]);

  // Load persisted config on first mount.
  useEffect(() => {
    backend.loadConfig().then((cfg) => {
      if (cfg && Array.isArray(cfg.monitors) && cfg.monitors.length) {
        const fresh = cfg.monitors.map((m) => makeMonitor({
          name:   m.name  || 'Monitor',
          ip:     m.ip    || '',
          labels: m.labels|| {},
        }));
        setMonitors(fresh);
        setActiveId(fresh[0].id);
      }
      if (cfg && cfg.ha) {
        setHaConfig_({ url: cfg.ha.url || '', token: cfg.ha.token || '', entities: cfg.ha.entities || [] });
      }
      if (cfg && typeof cfg.hideDockIcon === 'boolean') {
        setHideDockIcon_(cfg.hideDockIcon);
      }
    }).catch(() => {/* no saved config yet — use seed */});
  }, []);

  // Poll all configured HA entity states every 2.5s.
  const haConfigured = !!(haConfig.url && haConfig.token && haConfig.entities?.length);
  useEffect(() => {
    const { url, token, entities = [] } = haConfig;
    if (!url || !token || !entities.length) { setHaEntityStates({}); return; }
    let cancelled = false;
    async function poll() {
      const results = await Promise.allSettled(
        entities.map((id) => backend.haGetState(url, token, id))
      );
      if (cancelled) return;
      setHaEntityStates((prev) => {
        const next = { ...prev };
        entities.forEach((id, i) => {
          if (pendingToggleRef.current.has(id)) return;
          const r = results[i];
          if (r.status === 'fulfilled') {
            next[id] = { state: r.value.state, friendlyName: r.value.friendly_name || id };
          } else {
            next[id] = { ...(prev[id] || {}), state: 'unavailable' };
          }
        });
        return next;
      });
    }
    poll();
    const timer = setInterval(poll, 2500);
    return () => { cancelled = true; clearInterval(timer); };
  }, [haConfig.url, haConfig.token, haConfig.entities]);

  const updateMonitor = (id, patch) =>
    setMonitors((ms) => ms.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  const patchActive = (patch) => updateMonitor(mon.id, patch);
  const setLabel    = (port, value) =>
    patchActive({ labels: { ...(mon.labels || {}), [port]: value } });

  const addMonitor = () => {
    setMonitors((ms) => {
      const next = makeMonitor({ name: `Monitor ${ms.length + 1}` });
      setActiveId(next.id);
      return [...ms, next];
    });
    setSourceMenu(false);
  };
  const removeMonitor = (id) => {
    setMonitors((ms) => {
      if (ms.length <= 1) return ms;
      const next = ms.filter((m) => m.id !== id);
      if (id === activeId) setActiveId(next[0].id);
      return next;
    });
    setSourceMenu(false);
  };
  const replaceMonitors = (configMonitors) => {
    if (!Array.isArray(configMonitors) || !configMonitors.length) return false;
    const fresh = configMonitors.map((m) => makeMonitor({
      name:   m.name   || 'Monitor',
      ip:     m.ip     || '',
      labels: m.labels || {},
    }));
    setMonitors(fresh);
    setActiveId(fresh[0].id);
    setSourceMenu(false);
    return true;
  };

  const flashBtn = useCallback((id) => {
    setFlash(id);
    setTimeout(() => setFlash((f) => (f === id ? null : f)), 240);
  }, []);
  const showToast = useCallback((text) => {
    setToast({ text, at: Date.now() });
    setTimeout(() => setToast((t) => (t && t.text === text ? null : t)), 3000);
  }, []);
  const markCmd = (cmd) => patchActive({ lastCmd: cmd, lastCmdAt: Date.now() });

  const httpPress = (path) =>
    monitorPost(mon.ip, path).catch((e) => showToast(`Error: ${e.message}`));

  const press = {
    power: () => {
      flashBtn('power');
      const nextOn = !mon.power;
      patchActive({ power: nextOn, lastCmd: nextOn ? 'POWER ON' : 'STANDBY', lastCmdAt: Date.now() });
      showToast(nextOn ? 'Powering on' : 'Standby');
      setSourceMenu(false);
      httpPress('/switch/source_switch/toggle');
    },
    source: () => {
      if (!mon.power) return;
      flashBtn('source');
      setSourceMenu((o) => !o);
    },
    selectSource: (i) => {
      const s = sources[i];
      patchActive({ lastSourceSent: i, lastCmd: `SRC → ${s.port.toUpperCase()}`, lastCmdAt: Date.now() });
      showToast(`Switching to ${sourceLabel(s)}`);
      setSourceMenu(false);
    },
    menu: () => {
      if (!mon.power) return;
      flashBtn('menu');
      markCmd('MENU');
      showToast('Menu → monitor');
      setSourceMenu(false);
      httpPress('/switch/menu/turn_on');
    },
    up: () => {
      if (!mon.power) return;
      flashBtn('up');
      markCmd('UP');
      showToast('Up → monitor');
      httpPress('/switch/up/turn_on');
    },
    down: () => {
      if (!mon.power) return;
      flashBtn('down');
      markCmd('DOWN');
      showToast('Down → monitor');
      httpPress('/switch/down/turn_on');
    },
  };

  const setHaConfig = useCallback((patch) => {
    setHaConfig_((prev) => ({ ...prev, ...patch }));
  }, []);

  const addHaEntity    = useCallback(() => setHaConfig_((p) => ({ ...p, entities: [...(p.entities || []), ''] })), []);
  const removeHaEntity = useCallback((i) => setHaConfig_((p) => ({ ...p, entities: (p.entities || []).filter((_, j) => j !== i) })), []);
  const updateHaEntity = useCallback((i, val) => setHaConfig_((p) => {
    const next = [...(p.entities || [])];
    next[i] = val;
    return { ...p, entities: next };
  }), []);

  const toggleHa = useCallback((entityId) => {
    const cur = haEntityStates[entityId];
    const nextOn = !cur || cur.state !== 'on';
    pendingToggleRef.current.add(entityId);
    setHaEntityStates((prev) => ({ ...prev, [entityId]: { ...(prev[entityId] || {}), state: nextOn ? 'on' : 'off' } }));
    backend.haSetState(haConfig.url, haConfig.token, entityId, nextOn)
      .then(() => {
        setTimeout(() => pendingToggleRef.current.delete(entityId), 3000);
      })
      .catch((e) => {
        pendingToggleRef.current.delete(entityId);
        setHaEntityStates((prev) => ({ ...prev, [entityId]: { ...(prev[entityId] || {}), state: cur?.state || 'off' } }));
        showToast(`HA: ${String(e).replace(/^Error:\s*/i, '').slice(0, 55)}`);
      });
  }, [haEntityStates, haConfig.url, haConfig.token, showToast]);

  const loadHaEntities = useCallback(async () => {
    if (!haConfig.url || !haConfig.token) return;
    setHaLoading(true);
    try {
      const list = await backend.haListEntities(haConfig.url, haConfig.token);
      setHaEntities(list || []);
    } catch (e) {
      showToast(`HA list: ${String(e).replace(/^Error:\s*/i, '').slice(0, 50)}`);
    }
    setHaLoading(false);
  }, [haConfig.url, haConfig.token, showToast]);

  const setHideDockIcon = useCallback((hide) => {
    setHideDockIcon_(hide);
    backend.setDockHidden(hide).catch(() => {});
  }, []);

  return {
    monitors, activeId, setActiveId, mon,
    addMonitor, removeMonitor, updateMonitor, replaceMonitors,
    sources, setLabel,
    sourceMenu, setSourceMenu,
    flash, toast,
    press,
    haConfig, setHaConfig, haConfigured,
    addHaEntity, removeHaEntity, updateHaEntity,
    haEntityStates,
    haEntities, haLoading, loadHaEntities,
    toggleHa,
    hideDockIcon, setHideDockIcon,
  };
}

// ───────────────────────── Tabs ─────────────────────────
export function MonitorTabs({ monitors, activeId, onChange, theme = 'light' }) {
  if (!monitors || monitors.length < 2) return null;
  const dark = theme === 'dark';
  return (
    <div className="mc-tabs" style={{
      display: 'flex', gap: 2, padding: 2,
      background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
      borderRadius: 8, fontSize: 11, fontWeight: 600, letterSpacing: '0.005em',
      flex: 1, minWidth: 0, overflowX: 'auto', scrollbarWidth: 'none',
    }}>
      {monitors.map((m) => {
        const on = activeId === m.id;
        return (
          <button key={m.id} onClick={() => onChange(m.id)} title={m.name || 'Monitor'} style={{
            flex: '1 1 auto', minWidth: 0, padding: '5px 10px', border: 'none', cursor: 'pointer',
            borderRadius: 6,
            background: on ? (dark ? 'rgba(255,255,255,0.14)' : '#fff') : 'transparent',
            color: on ? (dark ? '#fff' : '#1a1a1f') : (dark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.5)'),
            boxShadow: on ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
            transition: 'all 120ms ease', font: 'inherit', fontWeight: 600,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{m.name || 'Monitor'}</button>
        );
      })}
    </div>
  );
}

export function Toast({ toast, theme = 'light' }) {
  if (!toast) return null;
  const dark = theme === 'dark';
  return (
    <div style={{
      position: 'absolute', left: '50%', bottom: -34, transform: 'translateX(-50%)',
      padding: '5px 11px', borderRadius: 999,
      background: dark ? 'rgba(20,22,30,0.92)' : 'rgba(20,22,30,0.88)',
      color: '#fff', fontSize: 11, fontWeight: 500, letterSpacing: '0.01em',
      whiteSpace: 'nowrap', pointerEvents: 'none',
      boxShadow: '0 6px 18px rgba(0,0,0,0.24)',
      fontVariantNumeric: 'tabular-nums',
      animation: 'mc-toast-in 180ms ease-out',
    }}>{toast.text}</div>
  );
}
