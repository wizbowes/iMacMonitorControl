import { useState, useEffect } from 'react';
import { useMonitorState } from './popup-shared.jsx';
import { PopupStrip } from './popup-variations.jsx';

function detectPlatform() {
  if (typeof window !== 'undefined' && '__TAURI__' in window) {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('windows')) return 'windows';
    if (ua.includes('mac'))     return 'mac';
    return 'linux';
  }
  return 'mac';
}

function resolveTheme(choice) {
  if (choice === 'auto') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return choice;
}

export default function App() {
  const [themeChoice, setThemeChoice]   = useState('auto');
  const [theme,       setThemeResolved] = useState(() => resolveTheme('auto'));
  const state    = useMonitorState();
  const platform = detectPlatform();

  const setTheme = (choice) => {
    setThemeChoice(choice);
    setThemeResolved(resolveTheme(choice));
  };

  useEffect(() => {
    if (themeChoice !== 'auto') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => setThemeResolved(mq.matches ? 'dark' : 'light');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [themeChoice]);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center',
      paddingTop: 8,
      background: 'transparent',
      fontFamily: '"Inter", -apple-system, "Helvetica Neue", Arial, sans-serif',
    }}>
      <PopupStrip
        state={state}
        theme={theme}
        themeChoice={themeChoice}
        setTheme={setTheme}
        platform={platform}
      />
    </div>
  );
}
