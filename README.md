# iMac Monitor Control

A compact menu bar (macOS) / system tray (Windows) popup for controlling an external monitor via an **ESPHome device**, with optional **Home Assistant** entity toggles alongside the monitor controls.

Built with [Tauri 2](https://v2.tauri.app) (Rust) and React 19.

---

## What it does

Click the tray icon to open a small control strip:

| Button | ESPHome action |
|--------|---------------|
| Source | `POST /switch/source/turn_on` |
| Up     | `POST /switch/up/turn_on` |
| Down   | `POST /switch/down/turn_on` |
| Menu   | `POST /switch/menu/turn_on` |
| Power  | `POST /switch/source_switch/toggle` |

Above the control strip, any Home Assistant entities you configure appear as one-tap toggles with their icons and live state.

Arrow keys work when the popup is open: `←` Source · `↑` Up · `↓` Down · `→` Menu.

---

## Install

- **Releases**: grab the `.dmg` (macOS universal) or `.exe`/`.msi` (Windows) from the [releases page](https://github.com/wizbowes/iMacMonitorControl/releases).
- **Development builds**: every push to `main` uploads installers as workflow artifacts on the [Actions page](https://github.com/wizbowes/iMacMonitorControl/actions).

**macOS note**: the app is unsigned — right-click → Open the first time to get past Gatekeeper.

---

## Configuration

Open the popup and click the **⚙ gear** icon to open Settings. There are two tabs: **Monitor** and **Application**.

### Monitor tab

| Field | What to enter |
|-------|--------------|
| Name | A display name for this monitor (shown in the popup header) |
| IP address | The local IP of your ESPHome device (e.g. `192.168.1.21`) |
| Inputs | Optional friendly names for each input port ("Mac", "Work Laptop", …) |

The IP is the only thing required to make the buttons work. It must be reachable from the machine running the app — no port or path needed, just the bare IP.

You can add multiple monitors with the **Add monitor** button; a tab strip appears to switch between them.

### Application tab — Home Assistant

To show HA entity toggles in the control strip:

1. **URL** — your HA instance URL, e.g. `http://homeassistant.local:8123`
2. **Token** — a [Long-Lived Access Token](https://my.home-assistant.io/redirect/profile/) from your HA profile page
3. Click **Load entities** to browse all available entities, then use the autocomplete fields to add them one by one.

Supported entity domains: `light`, `switch`, `input_boolean`, `group`, `scene`, `script`.

Entity icons are fetched automatically from HA and displayed in the popup — no manual configuration needed. State is polled every 2.5 seconds.

### Application tab — General

| Setting | Description |
|---------|-------------|
| Appearance | Light / Auto / Dark theme |
| Launch at login | *(display only — not yet wired)* |
| Show in menu bar | *(display only — not yet wired)* |
| Hide from Dock | Removes the app from the macOS Dock (takes effect immediately, persisted across restarts) |

### Config backup

Use **Save config…** / **Load config…** to export and restore your monitor names, IP addresses, and input labels as a JSON file.

---

## ESPHome setup

The app expects these switch component IDs in your ESPHome YAML:

```yaml
switch:
  - platform: template
    name: "Power"
    id: source_switch      # toggled on power button press
    ...
  - platform: template
    name: "Up"
    id: up
    ...
  - platform: template
    name: "Down"
    id: down
    ...
  - platform: template
    name: "Menu"
    id: menu
    ...
  - platform: template
    name: "Source"
    id: source
    ...
```

The `id` values must match exactly. If your firmware uses different names, the component IDs can be adjusted in `src/popup-shared.jsx` (the `httpPress` calls in the `press` object).

---

## Development

Prerequisites: Node 22+, Rust stable. On Linux also `libgtk-3-dev libwebkit2gtk-4.1-dev`.

```sh
npm install
npm run tauri dev    # hot-reload dev mode
npm run tauri build  # produce installers locally
```

**Rust-only check** (no Node needed):
```sh
cd src-tauri && cargo check
```

Project layout:

| Path | What |
|------|------|
| `src/` | React frontend — popup UI, state (`popup-shared.jsx`), IPC bridge (`bridge.js`) |
| `src/popup-variations.jsx` | All rendered components |
| `src-tauri/src/` | Tauri app — tray, window management, IPC commands |
| `src-tauri/src/backend/` | Per-OS DDC/CI fallback implementations |
| `.github/workflows/build.yml` | CI: Mac + Windows builds, artifacts, releases |
| `CLAUDE.md` | Platform gotchas and development notes |

### Creating a release

Push to `main` for a build with downloadable artifacts. For a full GitHub release:

1. Go to **Actions → Build & Release → Run workflow**
2. Enter the tag (e.g. `v1.2.0`) in the **tag** field
3. Click **Run workflow** — this builds both platforms and publishes a release
