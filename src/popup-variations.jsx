import { useState, useRef, useEffect, useMemo } from 'react';
import * as mdiIcons from '@mdi/js';
import { Icons, MonitorTabs, Toast, PORTS } from './popup-shared.jsx';
import { backend } from './bridge.js';

// Window geometry: the card is CARD_W wide; the native window adds transparent
// padding around it so the drop shadow and the toast (which hangs below the
// card) aren't clipped. Keep in sync with the initial size in tauri.conf.json.
const CARD_W     = 380;
const PAD_X      = 16;
const PAD_TOP    = 8;
const PAD_BOTTOM = 44;

// ─── State pill ───────────────────────────────────────────────────────────────
function StatePill({ on, dark }) {
  const onColor = '#3ddc8e';
  const bg     = on ? 'rgba(61,220,142,0.14)' : (dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)');
  const border = on ? 'rgba(61,220,142,0.30)' : (dark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)');
  const text   = on ? onColor : (dark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.5)');
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 8px 3px 7px',
      background: bg, border: `1px solid ${border}`, borderRadius: 999,
      fontFamily: '"JetBrains Mono", ui-monospace, monospace',
      fontSize: 10, fontWeight: 700, letterSpacing: '0.10em', color: text,
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: '50%',
        background: on ? onColor : (dark ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.22)'),
        boxShadow: on ? `0 0 6px ${onColor}aa` : 'none',
        transition: 'all 160ms ease',
      }} />
      {on ? 'ON' : 'STANDBY'}
    </span>
  );
}

// ─── Source picker ────────────────────────────────────────────────────────────
function SourceMenu({ state, theme }) {
  if (!state.sourceMenu) return null;
  const dark   = theme === 'dark';
  const last   = state.mon.lastSourceSent;
  const border = dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)';
  const hover  = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)';
  const ink    = dark ? '#f4f4f6' : '#1a1a1f';
  const muted  = dark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)';
  return (
    <div style={{ padding: '6px 6px', borderTop: `1px solid ${border}` }}>
      <div style={{
        fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.14em',
        fontWeight: 600, opacity: 0.5, padding: '4px 8px 6px',
      }}>Switch input</div>
      {state.sources.map((s, i) => {
        const justSent = last === i;
        return (
          <button key={i} onClick={() => state.press.selectSource(i)} style={{
            display: 'flex', alignItems: 'center', gap: 8, width: '100%',
            padding: '7px 8px', border: 'none', borderRadius: 6, background: 'transparent',
            color: ink, cursor: 'pointer', textAlign: 'left',
            fontFamily: 'inherit', fontSize: 12, transition: 'background 80ms ease',
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = hover}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
            <span style={{ flex: 1, display: 'flex', flexDirection: 'column', lineHeight: 1.2, gap: 1 }}>
              <span style={{ fontWeight: 700, letterSpacing: '-0.005em' }}>{s.port}</span>
              <span style={{
                fontSize: 10.5, color: muted,
                fontFamily: '"JetBrains Mono", ui-monospace, monospace',
                fontStyle: s.device ? 'normal' : 'italic',
              }}>{s.device || 'Unassigned'}</span>
            </span>
            {justSent && (
              <span style={{ fontSize: 9, color: muted, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600 }}>sent</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Shared building blocks ───────────────────────────────────────────────────
// These live at module scope — NOT inside render functions. Defining them
// inline would create a new component type on every render, making React
// remount their DOM nodes: inputs would lose focus after each keystroke and
// buttons would swallow rapid clicks (the pressed node is replaced before
// mouse-up, so no click event fires).

function palette(dark) {
  return {
    dark,
    ink:         dark ? '#f4f4f6' : '#1a1a1f',
    muted:       dark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)',
    fieldBg:     dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
    fieldBorder: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
    rowBorder:   dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
  };
}

const SectionHead = ({ c, children, hint }) => (
  <div style={{ padding: '14px 14px 6px', display: 'flex', alignItems: 'baseline', gap: 8 }}>
    <span style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.14em', fontWeight: 700, color: c.muted }}>{children}</span>
    {hint && <span style={{ fontSize: 10, color: c.muted, fontStyle: 'italic' }}>{hint}</span>}
  </div>
);

const Field = ({ c, label, mono, children, last }) => (
  <div style={{
    padding: '9px 14px', borderBottom: last ? 'none' : `1px solid ${c.rowBorder}`,
    display: 'flex', alignItems: 'center', gap: 10,
  }}>
    {label && (
      <span style={{
        fontSize: 11.5, minWidth: 110, color: c.ink,
        fontFamily: mono ? '"JetBrains Mono", ui-monospace, monospace' : 'inherit',
      }}>{label}</span>
    )}
    <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 6, minWidth: 0 }}>
      {children}
    </div>
  </div>
);

const Input = ({ c, value, onChange, placeholder, mono }) => (
  <input
    value={value || ''} onChange={(e) => onChange(e.target.value)}
    placeholder={placeholder} spellCheck={false}
    autoCorrect="off" autoCapitalize="off" autoComplete="off"
    style={{
      flex: 1, minWidth: 0, padding: '5px 9px', borderRadius: 6,
      background: c.fieldBg, border: `1px solid ${c.fieldBorder}`,
      color: c.ink,
      fontFamily: mono ? '"JetBrains Mono", ui-monospace, monospace' : 'inherit',
      fontSize: 11.5, outline: 'none', textAlign: 'left',
    }}
    onFocus={(e) => e.currentTarget.style.borderColor = '#0a84ff'}
    onBlur={(e) => e.currentTarget.style.borderColor = c.fieldBorder}
  />
);

const Kbd = ({ c, children }) => (
  <kbd style={{
    padding: '2px 6px', borderRadius: 5,
    background: c.fieldBg, border: `1px solid ${c.fieldBorder}`,
    color: c.ink, fontFamily: '"JetBrains Mono", ui-monospace, monospace',
    fontSize: 10.5, fontWeight: 600,
  }}>{children}</kbd>
);

const Toggle = ({ c, on, onToggle }) => (
  <button onClick={() => onToggle(!on)} style={{
    width: 32, height: 19, borderRadius: 999, border: 'none',
    background: on ? '#3ddc8e' : (c.dark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.18)'),
    position: 'relative', cursor: 'pointer', transition: 'background 150ms ease',
  }}>
    <span style={{
      position: 'absolute', top: 2, left: on ? 15 : 2,
      width: 15, height: 15, borderRadius: '50%', background: '#fff',
      boxShadow: '0 1px 2px rgba(0,0,0,0.25)', transition: 'left 150ms ease',
    }} />
  </button>
);

const ScopeSwitch = ({ c, scope, setScope }) => (
  <div style={{
    display: 'flex', gap: 2, padding: 2, margin: '10px 12px 0',
    background: c.dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', borderRadius: 8,
  }}>
    {[{ value: 'monitor', label: 'Monitor' }, { value: 'app', label: 'Application' }].map((opt) => {
      const on = scope === opt.value;
      return (
        <button key={opt.value} onClick={() => setScope(opt.value)} style={{
          flex: 1, padding: '5px 10px', border: 'none', cursor: 'pointer', borderRadius: 6,
          background: on ? (c.dark ? 'rgba(255,255,255,0.14)' : '#fff') : 'transparent',
          color: on ? (c.dark ? '#fff' : '#1a1a1f') : (c.dark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.5)'),
          boxShadow: on ? '0 1px 2px rgba(0,0,0,0.08)' : 'none', transition: 'all 120ms ease',
          fontFamily: 'inherit', fontSize: 11, fontWeight: 600, letterSpacing: '0.005em',
        }}>{opt.label}</button>
      );
    })}
  </div>
);

// Control cell: fires on pointer-down so rapid presses register individually
// and feel like a hardware button. Keyboard activation still arrives as a
// click event with detail === 0.
function Cell({ dark, ink, pressed, danger, label, onPress, children }) {
  return (
    <button
      onPointerDown={onPress}
      onClick={(e) => { if (e.detail === 0) onPress(); }}
      style={{
        flex: 1, height: 52, border: 'none', cursor: 'pointer',
        background: pressed
          ? (danger ? 'rgba(255,69,58,0.18)' : (dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)'))
          : 'transparent',
        color: danger ? '#ff5b54' : ink,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
        fontFamily: 'inherit', fontSize: 9.5, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase',
        borderRight: `1px solid ${dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
        transition: 'background 120ms ease',
      }}>
      {children}
      <span>{label}</span>
    </button>
  );
}

// ─── HA: Entity row cell ─────────────────────────────────────────────────────

// Render an MDI icon by its "mdi:xxx" name using the bundled @mdi/js paths.
function MdiIcon({ icon, size = 16 }) {
  const key = 'mdi' + icon.replace(/^mdi:/, '').replace(/-([a-z])/g, (_, c) => c.toUpperCase()).replace(/^([a-z])/, (_, c) => c.toUpperCase());
  const path = mdiIcons[key];
  if (!path) return null;
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
      <path d={path} />
    </svg>
  );
}

// Filled house SVG fallback (the HA brand icon shape), inherits currentColor.
function HaIcon({ size = 16 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
      <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
    </svg>
  );
}

function HaEntityCell({ dark, ink, entityId, haState, onToggle, isLast }) {
  const amber = '#ffb340';
  const on    = haState?.state === 'on';
  const unavailable = !haState || haState.state === 'unavailable';
  const label = haState?.friendlyName || entityId.split('.').slice(1).join('.') || entityId;
  return (
    <button
      onPointerDown={unavailable ? undefined : onToggle}
      onClick={(e) => { if (!unavailable && e.detail === 0) onToggle(); }}
      title={`${label} · ${haState?.state || 'loading…'}`}
      style={{
        flex: 1, height: 52, border: 'none', cursor: unavailable ? 'default' : 'pointer',
        background: on ? (dark ? 'rgba(255,179,64,0.14)' : 'rgba(255,179,64,0.10)') : 'transparent',
        color: unavailable
          ? (dark ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.26)')
          : (on ? amber : ink),
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
        fontFamily: 'inherit', fontSize: 9.5, fontWeight: 600,
        letterSpacing: '0.01em',
        borderRight: isLast ? 'none' : `1px solid ${dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
        transition: 'background 120ms ease, color 120ms ease',
        maxWidth: '100%', overflow: 'hidden',
      }}>
      {haState?.icon ? <MdiIcon icon={haState.icon} size={16} /> : <HaIcon size={16} />}
      <span style={{
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        maxWidth: 'calc(100% - 8px)', display: 'block',
      }}>{label}</span>
    </button>
  );
}

// ─── HA: Token input with show/hide ──────────────────────────────────────────
function HaTokenInput({ c, value, onChange }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ flex: 1, display: 'flex', gap: 4, minWidth: 0 }}>
      <input
        type={show ? 'text' : 'password'}
        value={value || ''} onChange={(e) => onChange(e.target.value)}
        placeholder="Long-lived access token"
        spellCheck={false} autoCorrect="off" autoCapitalize="off" autoComplete="off"
        style={{
          flex: 1, minWidth: 0, padding: '5px 9px', borderRadius: 6,
          background: c.fieldBg, border: `1px solid ${c.fieldBorder}`,
          color: c.ink, fontFamily: '"JetBrains Mono", ui-monospace, monospace',
          fontSize: 10, outline: 'none', textAlign: 'left',
        }}
        onFocus={(e) => e.currentTarget.style.borderColor = '#0a84ff'}
        onBlur={(e) => e.currentTarget.style.borderColor = c.fieldBorder}
      />
      <button
        onClick={() => setShow((s) => !s)}
        title={show ? 'Hide token' : 'Show token'}
        style={{
          padding: '5px 8px', borderRadius: 6, flexShrink: 0, lineHeight: 0,
          background: c.fieldBg, border: `1px solid ${c.fieldBorder}`,
          color: c.muted, cursor: 'pointer',
        }}>
        {show ? <Icons.EyeOff size={13} /> : <Icons.Eye size={13} />}
      </button>
    </div>
  );
}

// ─── HA: Entity autocomplete (no embedded load button) ───────────────────────
function EntityAutocomplete({ c, entityId, onChange, entities }) {
  const [open,  setOpen]  = useState(false);
  const [query, setQuery] = useState(entityId || '');

  useEffect(() => { setQuery(entityId || ''); }, [entityId]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    if (!q) return entities.slice(0, 10);
    return entities
      .filter((e) => e.entity_id.toLowerCase().includes(q) || e.friendly_name.toLowerCase().includes(q))
      .slice(0, 10);
  }, [query, entities]);

  const select = (e) => { onChange(e.entity_id); setQuery(e.entity_id); setOpen(false); };

  return (
    <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
      <input
        value={query}
        onChange={(e) => { setQuery(e.target.value); onChange(e.target.value); setOpen(true); }}
        onFocus={(e) => { e.currentTarget.style.borderColor = '#0a84ff'; setOpen(true); }}
        onBlur={(e) => { e.currentTarget.style.borderColor = c.fieldBorder; setTimeout(() => setOpen(false), 130); }}
        placeholder="light.desk_lamp"
        spellCheck={false} autoCorrect="off" autoCapitalize="off" autoComplete="off"
        style={{
          width: '100%', minWidth: 0, padding: '5px 9px', borderRadius: 6,
          background: c.fieldBg, border: `1px solid ${c.fieldBorder}`,
          color: c.ink, fontFamily: '"JetBrains Mono", ui-monospace, monospace',
          fontSize: 11, outline: 'none', textAlign: 'left', boxSizing: 'border-box',
        }}
      />
      {open && filtered.length > 0 && (
        <div style={{
          marginTop: 4, borderRadius: 8, overflow: 'hidden',
          background: c.dark ? 'rgba(26,26,32,0.99)' : 'rgba(251,251,253,0.99)',
          border: `1px solid ${c.fieldBorder}`,
          boxShadow: '0 4px 16px rgba(0,0,0,0.14)',
        }}>
          {filtered.map((e) => (
            <button key={e.entity_id} onMouseDown={() => select(e)} style={{
              display: 'block', width: '100%', padding: '7px 10px',
              border: 'none', background: 'transparent', textAlign: 'left',
              cursor: 'pointer', fontFamily: 'inherit',
              borderBottom: `1px solid ${c.fieldBorder}`,
            }}
            onMouseEnter={(ev) => ev.currentTarget.style.background = c.dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)'}
            onMouseLeave={(ev) => ev.currentTarget.style.background = 'transparent'}>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: c.ink }}>{e.friendly_name}</div>
              <div style={{ fontSize: 10, color: c.muted, fontFamily: '"JetBrains Mono", monospace' }}>{e.entity_id}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Settings view ────────────────────────────────────────────────────────────
function SettingsView({ state, theme, themeChoice, setTheme, scope, setScope, platform = 'mac' }) {
  const c = palette(theme === 'dark');
  const { dark, ink, muted, fieldBg, fieldBorder, rowBorder } = c;

  const [launchAtLogin, setLaunchAtLogin] = useState(true);
  const [showInTray,    setShowInTray]    = useState(true);
  const [loadFeedback,  setLoadFeedback]  = useState(null);
  const fileInputRef = useRef(null);

  const saveConfig = () => {
    const config = {
      version: 1,
      savedAt: new Date().toISOString(),
      theme:   themeChoice,
      monitors: state.monitors.map((m) => ({ name: m.name, ip: m.ip, labels: m.labels })),
      hideDockIcon: state.hideDockIcon,
      ...(state.haConfig.url && { ha: state.haConfig }),
    };
    // Persist via Tauri backend (writes to app config dir).
    backend.saveConfig(config)
      .then(() => {
        setLoadFeedback({ ok: true, text: 'Saved' });
        setTimeout(() => setLoadFeedback(null), 1600);
      })
      .catch((e) => {
        setLoadFeedback({ ok: false, text: `Save failed: ${e}` });
        setTimeout(() => setLoadFeedback(null), 2400);
      });
  };

  const loadConfigClick = () => fileInputRef.current && fileInputRef.current.click();
  const onFilePicked = (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const cfg = JSON.parse(reader.result);
        if (!cfg.monitors || !Array.isArray(cfg.monitors) || !cfg.monitors.length)
          throw new Error('No monitors in config');
        const ok = state.replaceMonitors(cfg.monitors);
        if (!ok) throw new Error('Could not apply config');
        if (cfg.theme && ['light', 'dark', 'auto'].includes(cfg.theme)) setTheme(cfg.theme);
        setLoadFeedback({ ok: true, text: `Loaded ${cfg.monitors.length} monitor${cfg.monitors.length === 1 ? '' : 's'}` });
      } catch (err) {
        setLoadFeedback({ ok: false, text: 'Invalid config file' });
      }
      setTimeout(() => setLoadFeedback(null), 2400);
    };
    reader.readAsText(file);
  };

  const showInLabel = ({ mac: 'Show in menu bar', windows: 'Show in taskbar', linux: 'Show in system tray' })[platform] || 'Show in menu bar';

  const { mon, monitors, activeId } = state;
  const canRemove = monitors.length > 1;

  return (
    <div style={{ color: ink, animation: 'mc-view-in 160ms ease-out' }}>
      <ScopeSwitch c={c} scope={scope} setScope={setScope} />
      <div className="mc-settings-scroll" style={{ overflowY: 'visible' }}>
        {scope === 'monitor' && monitors.length > 1 && (
          <div style={{ padding: '10px 12px 0' }}>
            <MonitorTabs monitors={monitors} activeId={activeId} onChange={state.setActiveId} theme={theme} />
          </div>
        )}
        {scope === 'monitor' ? (
          <>
            <SectionHead c={c} hint={mon.name}>Display</SectionHead>
            <div style={{ padding: '0 4px' }}>
              <Field c={c} label="Name">
                <Input c={c} value={mon.name} onChange={(v) => state.updateMonitor(mon.id, { name: v })} placeholder="Display name" />
              </Field>
              <Field c={c} label="IP address" last>
                <Input c={c} value={mon.ip} onChange={(v) => state.updateMonitor(mon.id, { ip: v })} placeholder="192.168.1.21" mono />
              </Field>
            </div>

            <SectionHead c={c} hint={mon.name}>Inputs</SectionHead>
            <div style={{ padding: '0 4px' }}>
              {state.sources.map((s, i) => (
                <Field c={c} key={s.port} label={s.port} mono last={i === state.sources.length - 1}>
                  <Input c={c} value={mon.labels[s.port]} onChange={(v) => state.setLabel(s.port, v)} placeholder="Device name" />
                </Field>
              ))}
            </div>

            <div style={{ padding: '14px 14px 6px', display: 'flex', gap: 8 }}>
              <button onClick={state.addMonitor} style={{
                flex: 1, padding: '8px 10px',
                border: `1px dashed ${dark ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.22)'}`,
                background: 'transparent', color: ink, borderRadius: 7, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                fontFamily: 'inherit', fontSize: 11.5, fontWeight: 600, transition: 'all 120ms ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'; e.currentTarget.style.borderStyle = 'solid'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderStyle = 'dashed'; }}>
                <Icons.Plus size={14} /> Add monitor
              </button>
              <button
                onClick={() => canRemove && state.removeMonitor(activeId)}
                disabled={!canRemove}
                title={canRemove ? `Remove "${mon.name}"` : 'At least one monitor is required'}
                style={{
                  flex: 1, padding: '8px 10px',
                  border: `1px dashed ${canRemove ? 'rgba(255,80,72,0.45)' : (dark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)')}`,
                  background: 'transparent',
                  color: canRemove ? '#ff5b54' : (dark ? 'rgba(255,255,255,0.30)' : 'rgba(0,0,0,0.28)'),
                  borderRadius: 7, cursor: canRemove ? 'pointer' : 'not-allowed',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  fontFamily: 'inherit', fontSize: 11.5, fontWeight: 600, transition: 'all 120ms ease',
                }}
                onMouseEnter={(e) => { if (canRemove) { e.currentTarget.style.background = 'rgba(255,80,72,0.10)'; e.currentTarget.style.borderStyle = 'solid'; } }}
                onMouseLeave={(e) => { if (canRemove) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderStyle = 'dashed'; } }}>
                <Icons.Trash size={14} /> Remove monitor
              </button>
            </div>
          </>
        ) : (
          <>
            <SectionHead c={c}>Appearance</SectionHead>
            <div style={{ padding: '8px 14px 4px' }}>
              <div style={{
                display: 'flex', gap: 2, padding: 2,
                background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', borderRadius: 8,
              }}>
                {[{ value: 'light', label: 'Light' }, { value: 'auto', label: 'Auto' }, { value: 'dark', label: 'Dark' }].map((opt) => {
                  const on = themeChoice === opt.value;
                  return (
                    <button key={opt.value} onClick={() => setTheme(opt.value)} style={{
                      flex: 1, padding: '5px 10px', border: 'none', cursor: 'pointer', borderRadius: 6,
                      background: on ? (dark ? 'rgba(255,255,255,0.14)' : '#fff') : 'transparent',
                      color: on ? (dark ? '#fff' : '#1a1a1f') : (dark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.5)'),
                      boxShadow: on ? '0 1px 2px rgba(0,0,0,0.08)' : 'none', transition: 'all 120ms ease',
                      fontFamily: 'inherit', fontSize: 11, fontWeight: 600,
                    }}>{opt.label}</button>
                  );
                })}
              </div>
            </div>

            <SectionHead c={c}>Hotkeys</SectionHead>
            <div style={{ padding: '0 4px' }}>
              <Field c={c} label="Open popup"><span style={{ display: 'flex', gap: 3 }}><Kbd c={c}>⌥</Kbd><Kbd c={c}>⌘</Kbd><Kbd c={c}>M</Kbd></span></Field>
              <Field c={c} label="Cycle input"><span style={{ display: 'flex', gap: 3 }}><Kbd c={c}>⌥</Kbd><Kbd c={c}>⌘</Kbd><Kbd c={c}>S</Kbd></span></Field>
              <Field c={c} label="Toggle power" last><span style={{ opacity: 0.5, fontStyle: 'italic', fontSize: 11 }}>not set</span></Field>
            </div>

            <SectionHead c={c}>General</SectionHead>
            <div style={{ padding: '0 4px' }}>
              <Field c={c} label="Launch at login"><Toggle c={c} on={launchAtLogin} onToggle={setLaunchAtLogin} /></Field>
              <Field c={c} label={showInLabel}><Toggle c={c} on={showInTray} onToggle={setShowInTray} /></Field>
              <Field c={c} label="Hide from Dock" last><Toggle c={c} on={state.hideDockIcon} onToggle={state.setHideDockIcon} /></Field>
            </div>

            <SectionHead c={c}>Home Assistant</SectionHead>
            <div style={{ padding: '0 4px' }}>
              <Field c={c} label="URL">
                <Input c={c} value={state.haConfig.url} onChange={(v) => state.setHaConfig({ url: v })} placeholder="http://homeassistant.local:8123" />
              </Field>
              <Field c={c} label="Token" last>
                <HaTokenInput c={c} value={state.haConfig.token} onChange={(v) => state.setHaConfig({ token: v })} />
              </Field>
            </div>
            <div style={{ padding: '6px 14px 12px', borderBottom: `1px solid ${c.rowBorder}` }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: c.muted }}>Entities</span>
                <button
                  onClick={state.loadHaEntities} disabled={state.haLoading || !state.haConfig.url || !state.haConfig.token}
                  title={state.haEntities.length ? `${state.haEntities.length} loaded — refresh` : 'Load entity list from HA'}
                  style={{
                    padding: '3px 8px', borderRadius: 6, fontSize: 10.5, fontWeight: 600,
                    border: `1px solid ${state.haEntities.length ? 'rgba(61,220,142,0.30)' : c.fieldBorder}`,
                    background: state.haEntities.length ? 'rgba(61,220,142,0.09)' : c.fieldBg,
                    color: state.haEntities.length ? '#3ddc8e' : c.muted,
                    cursor: (state.haLoading || !state.haConfig.url || !state.haConfig.token) ? 'default' : 'pointer',
                    fontFamily: 'inherit',
                  }}>
                  {state.haLoading ? '…' : state.haEntities.length ? `${state.haEntities.length} loaded` : 'Load entities'}
                </button>
              </div>
              {(state.haConfig.entities || []).map((entityId, i) => {
                const s = state.haEntityStates[entityId];
                return (
                  <div key={i} style={{ display: 'flex', gap: 4, alignItems: 'flex-start', marginBottom: i < (state.haConfig.entities.length - 1) ? 6 : 0 }}>
                    <EntityAutocomplete
                      c={c}
                      entityId={entityId}
                      onChange={(v) => state.updateHaEntity(i, v)}
                      entities={state.haEntities}
                    />
                    {s && (
                      <span style={{
                        fontSize: 10, lineHeight: '28px', flexShrink: 0, whiteSpace: 'nowrap',
                        color: s.state === 'unavailable' ? '#ff5b54' : s.state === 'on' ? '#ffb340' : c.muted,
                      }}>
                        {s.state === 'unavailable' ? '✕' : s.state === 'on' ? 'on' : 'off'}
                      </span>
                    )}
                    <button onClick={() => state.removeHaEntity(i)} title="Remove" style={{
                      padding: '5px 7px', borderRadius: 6, flexShrink: 0, lineHeight: 0,
                      background: 'transparent', border: `1px solid ${c.fieldBorder}`,
                      color: '#ff5b54', cursor: 'pointer', fontSize: 12,
                    }}>×</button>
                  </div>
                );
              })}
              <button onClick={state.addHaEntity} style={{
                marginTop: (state.haConfig.entities || []).length ? 8 : 0,
                width: '100%', padding: '7px', border: `1px dashed ${dark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.18)'}`,
                background: 'transparent', color: c.muted, borderRadius: 7, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                fontFamily: 'inherit', fontSize: 11.5, fontWeight: 600, transition: 'all 120ms ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'; e.currentTarget.style.borderStyle = 'solid'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderStyle = 'dashed'; }}>
                <Icons.Plus size={13} /> Add entity
              </button>
            </div>

            <SectionHead c={c}>Backup</SectionHead>
            <input ref={fileInputRef} type="file" accept=".json,application/json" onChange={onFilePicked} style={{ display: 'none' }} />
            <div style={{ padding: '8px 14px 4px', display: 'flex', gap: 8 }}>
              <button onClick={saveConfig} style={{
                flex: 1, padding: '8px 10px', border: `1px solid ${fieldBorder}`,
                background: fieldBg, color: ink, borderRadius: 7, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                fontFamily: 'inherit', fontSize: 11.5, fontWeight: 600, transition: 'all 120ms ease',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}
              onMouseLeave={(e) => e.currentTarget.style.background = fieldBg}>
                <Icons.Download size={14} /> Save config…
              </button>
              <button onClick={loadConfigClick} style={{
                flex: 1, padding: '8px 10px', border: `1px solid ${fieldBorder}`,
                background: fieldBg, color: ink, borderRadius: 7, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                fontFamily: 'inherit', fontSize: 11.5, fontWeight: 600, transition: 'all 120ms ease',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}
              onMouseLeave={(e) => e.currentTarget.style.background = fieldBg}>
                <Icons.Upload size={14} /> Load config…
              </button>
            </div>
            {loadFeedback && (
              <div style={{
                margin: '6px 14px 0', padding: '6px 10px', borderRadius: 6, fontSize: 11, fontWeight: 500,
                background: loadFeedback.ok ? 'rgba(61,220,142,0.14)' : 'rgba(255,80,72,0.14)',
                color: loadFeedback.ok ? '#3ddc8e' : '#ff5b54',
                border: `1px solid ${loadFeedback.ok ? 'rgba(61,220,142,0.30)' : 'rgba(255,80,72,0.30)'}`,
                textAlign: 'center',
              }}>{loadFeedback.text}</div>
            )}
            <div style={{ padding: '6px 14px 4px', fontSize: 10.5, color: muted, lineHeight: 1.4 }}>
              Exports all monitor names, IPs, and input device labels as a JSON file. Loading replaces the current set.
            </div>
          </>
        )}

        <div style={{
          padding: '14px 14px 16px',
          display: 'flex', alignItems: 'center', gap: 10,
          borderTop: `1px solid ${rowBorder}`, marginTop: 6,
        }}>
          <span style={{
            width: 28, height: 28, borderRadius: 7,
            background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icons.MonitorBadge size={16} weight={1.8} />
          </span>
          <div style={{ flex: 1, lineHeight: 1.3 }}>
            <div style={{ fontSize: 11.5, fontWeight: 600 }}>iMac Monitor Control</div>
            <div style={{ fontSize: 10.5, color: muted, fontFamily: '"JetBrains Mono", monospace' }}>v1.2.0 · ESPHome + HA</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STRIP — Touch Bar-inspired thin row with labels
// ═══════════════════════════════════════════════════════════════════════════════
export function PopupStrip({ state, theme, themeChoice, setTheme, platform = 'mac' }) {
  const dark = theme === 'dark';
  const { press, mon, flash, sourceMenu, monitors, activeId, setActiveId, toast } = state;
  const [view,  setView]  = useState('controls');
  const [scope, setScope] = useState('monitor');
  const cardRef = useRef(null);
  const pressRef = useRef(press);
  useEffect(() => { pressRef.current = press; });

  // Keep the native window sized to the rendered card. ResizeObserver fires on
  // mount and whenever the card's height changes (settings open/close, source
  // menu, monitor list growth, …).
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    let lastH = 0;
    const ro = new ResizeObserver(() => {
      const h = Math.ceil(el.getBoundingClientRect().height);
      if (h > 0 && h !== lastH) {
        lastH = h;
        backend.resizeWindow(CARD_W + PAD_X * 2, h + PAD_TOP + PAD_BOTTOM);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Arrow-key bindings when the controls view is open and focused.
  // ArrowUp/Down → OSD navigate; ArrowRight → open OSD menu.
  // Only active in controls view to avoid hijacking settings inputs.
  useEffect(() => {
    if (view !== 'controls') return;
    const onKey = (e) => {
      if (e.key === 'ArrowUp')    { e.preventDefault(); pressRef.current.up();     }
      if (e.key === 'ArrowDown')  { e.preventDefault(); pressRef.current.down();   }
      if (e.key === 'ArrowRight') { e.preventDefault(); pressRef.current.menu();   }
      if (e.key === 'ArrowLeft')  { e.preventDefault(); pressRef.current.source(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [view]);

  const ink          = dark ? '#f4f4f6' : '#1a1a1f';
  const muted        = dark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)';
  const surface      = dark ? 'rgba(28,28,32,0.94)' : 'rgba(255,255,255,0.96)';
  const headerBorder = dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';

  return (
    <div style={{ padding: `${PAD_TOP}px ${PAD_X}px ${PAD_BOTTOM}px` }}>
    <div ref={cardRef} style={{
      width: CARD_W, color: ink, background: surface,
      borderRadius: 13, overflow: 'hidden',
      backdropFilter: 'blur(30px) saturate(180%)', WebkitBackdropFilter: 'blur(30px) saturate(180%)',
      boxShadow: '0 14px 38px rgba(0,0,0,0.28), 0 0 0 0.5px rgba(0,0,0,0.06)',
      border: `1px solid ${dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.04)'}`,
      position: 'relative',
    }}>
      <style>{`
        .mc-tabs::-webkit-scrollbar { display: none; }
        @keyframes mc-toast-in { from { opacity: 0; transform: translateX(-50%) translateY(4px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
        @keyframes mc-view-in  { from { opacity: 0; } to { opacity: 1; } }
      `}</style>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px 8px 12px',
        borderBottom: `1px solid ${headerBorder}`, minHeight: 36,
      }}>
        {view === 'controls' ? (
          <>
            {monitors.length === 1 ? (
              <span style={{ fontSize: 12.5, fontWeight: 700, flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {mon.name}
              </span>
            ) : (
              <MonitorTabs monitors={monitors} activeId={activeId} onChange={setActiveId} theme={theme} />
            )}
            <StatePill on={mon.power} dark={dark} />
          </>
        ) : (
          <span style={{ fontSize: 12.5, fontWeight: 700, flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            Settings
          </span>
        )}
        <button
          onClick={() => {
            setView(view === 'controls' ? 'settings' : 'controls');
            state.setSourceMenu(false);
          }}
          title={view === 'controls' ? 'Settings' : 'Done'}
          style={{
            width: 26, height: 26, flexShrink: 0, padding: 0, borderRadius: 6, border: 'none',
            background: view === 'settings' ? (dark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.07)') : 'transparent',
            color: view === 'settings' ? ink : muted, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 100ms ease',
          }}
          onMouseEnter={(e) => { if (view !== 'settings') { e.currentTarget.style.background = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'; e.currentTarget.style.color = ink; } }}
          onMouseLeave={(e) => { if (view !== 'settings') { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = muted; } }}
        >
          {view === 'controls' ? <Icons.Gear size={15} /> : <Icons.Close size={14} />}
        </button>
      </div>

      {/* Body */}
      {view === 'controls' ? (
        <>
          {state.haConfigured && (state.haConfig.entities || []).length > 0 && (
            <div style={{
              display: 'flex',
              borderBottom: `1px solid ${dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
            }}>
              {(state.haConfig.entities || []).map((entityId, i) => (
                <HaEntityCell
                  key={entityId || i}
                  dark={dark}
                  ink={ink}
                  entityId={entityId}
                  haState={state.haEntityStates[entityId]}
                  onToggle={() => state.toggleHa(entityId)}
                  isLast={i === state.haConfig.entities.length - 1}
                />
              ))}
            </div>
          )}
          <div style={{ display: 'flex' }}>
            <Cell dark={dark} ink={ink} pressed={flash === 'source' || sourceMenu} label="Source" onPress={press.source}><Icons.Source size={17} /></Cell>
            <Cell dark={dark} ink={ink} pressed={flash === 'up'}   label="Up"   onPress={press.up}><Icons.Up size={17} /></Cell>
            <Cell dark={dark} ink={ink} pressed={flash === 'down'} label="Down" onPress={press.down}><Icons.Down size={17} /></Cell>
            <Cell dark={dark} ink={ink} pressed={flash === 'menu'} label="Menu" onPress={press.menu}><Icons.Menu size={17} /></Cell>
            <div style={{ flex: 1 }}>
              <button
                onPointerDown={press.power}
                onClick={(e) => { if (e.detail === 0) press.power(); }}
                style={{
                  width: '100%', height: 52, border: 'none', cursor: 'pointer',
                  background: flash === 'power' ? '#ff453a' : (dark ? 'rgba(255,69,58,0.10)' : 'rgba(255,69,58,0.08)'),
                  color: flash === 'power' ? '#fff' : '#ff5b54',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
                  fontFamily: 'inherit', fontSize: 9.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                  transition: 'background 120ms ease',
                }}>
                <Icons.Power size={17} />
                <span>Power</span>
              </button>
            </div>
          </div>
          <SourceMenu state={state} theme={theme} />
        </>
      ) : (
        <SettingsView
          state={state} theme={theme} themeChoice={themeChoice}
          setTheme={setTheme} scope={scope} setScope={setScope} platform={platform}
        />
      )}
      <Toast toast={toast} theme={theme} />
    </div>
    </div>
  );
}
