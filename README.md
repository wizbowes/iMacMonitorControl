# iMac Monitor Control

A tiny menu bar (macOS) / system tray (Windows) app for controlling an
external monitor over DDC/CI — power, input source switching, and OSD
navigation — without reaching for the buttons behind the screen.

Built with [Tauri 2](https://v2.tauri.app) (Rust) and React.

## Features

- Click the tray icon for a compact control strip: Source, Up, Down, Menu,
  Power.
- Source picker with per-input device labels ("Mac", "Work Laptop", …).
- Settings panel: monitor name/IP, input labels, multiple monitors,
  light/dark/auto theme, JSON config backup & restore.
- Popup sizes itself to its content and anchors to the tray icon — below
  the menu bar on macOS, above the taskbar on Windows.

## Install

Grab the latest installer:

- **Releases** (tagged versions): the `.dmg` (macOS, universal) or
  `.exe`/`.msi` (Windows) from the
  [releases page](https://github.com/wizbowes/iMacMonitorControl/releases).
- **Development builds**: every push to `main` or a `claude/**` branch
  uploads installers as workflow artifacts on the
  [Actions page](https://github.com/wizbowes/iMacMonitorControl/actions).

The macOS app is unsigned: right-click → Open the first time to get past
Gatekeeper.

## Development

Prerequisites: Node 22+, Rust stable. On Linux additionally
`libgtk-3-dev libwebkit2gtk-4.1-dev`.

```sh
npm install
npm run tauri dev    # run the app with hot reload
npm run build        # frontend production build
npm run tauri build  # produce installers locally
```

Project layout:

| Path | What |
| --- | --- |
| `src/` | React frontend (popup UI, state, IPC bridge) |
| `src-tauri/src/` | Tauri app: tray, window management, IPC commands |
| `src-tauri/src/backend/` | Per-OS DDC/CI implementations |
| `.github/workflows/build.yml` | CI: Mac + Windows builds, artifacts, releases |
| `CLAUDE.md` | Working notes & platform gotchas (worth reading!) |

## Status

The UI and windowing are stable. DDC command behavior against real
hardware is the current work-in-progress — VCP codes for OSD navigation
in particular vary between monitor models.
