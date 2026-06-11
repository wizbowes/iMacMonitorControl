# CLAUDE.md

Project context for Claude Code sessions. Read this before changing UI or
window behavior — several past bugs took multiple build cycles to diagnose.

## What this app is

A cross-platform (macOS menubar / Windows tray) popup for controlling an
external monitor over DDC/CI: power, input source switching, OSD navigation.
Single always-on-top borderless transparent window anchored to the tray icon.

- Frontend: React 19 + Vite (`src/`), all styling inline in JSX.
- Backend: Tauri 2 / Rust (`src-tauri/`), per-OS DDC backends in
  `src-tauri/src/backend/` (macos via subprocess, windows via Win32 API,
  stub elsewhere).
- State lives in `src/popup-shared.jsx` (`useMonitorState`); IPC bridge in
  `src/bridge.js`; main UI in `src/popup-variations.jsx` (`PopupStrip`).

## Current status (June 2026)

UI/windowing is working and verified by the user on macOS 26 (Tahoe).
**Next planned work: actual button functionality** (what each press does to
real hardware) — the user is writing a spec for this. The DDC command
plumbing exists (`commands.rs` → `backend/`) but is largely unverified
against real monitors.

## Hard-won gotchas — do not regress these

1. **Tauri detection**: `window.__TAURI__` does NOT exist (withGlobalTauri is
   off). `bridge.js` must detect via `__TAURI_INTERNALS__`. When detection is
   wrong, every IPC call silently no-ops and the app looks "almost working".

2. **macOS window transparency** requires BOTH the `macos-private-api` cargo
   feature (Cargo.toml) and `"macOSPrivateApi": true` (tauri.conf.json).
   WKWebView-level ObjC hacks cannot fix an opaque NSWindow (tried, failed).

3. **macOS 26 "Liquid Glass" slab**: Tahoe draws a rounded glass frame/rim
   around the whole borderless window. Three stacked counter-measures, all
   needed until proven otherwise:
   - `src-tauri/Info.plist` → `UIDesignRequiresCompatibility = true`
   - CI selects a pre-26 Xcode when available (build.yml "Use pre-26 Xcode")
   - `"shadow": false` in tauri.conf.json AND runtime `set_shadow(false)`
     in `lib.rs` setup.

4. **WKWebView input focus**: body-wide `user-select: none` breaks
   caret/keyboard focus in inputs (typing dies after ~1 char). `index.css`
   re-enables `user-select: text` on `input, textarea`. Keep it.

5. **React inline components**: never define components inside a render
   function (the old code did). It remounts DOM on every keystroke/click —
   inputs lose focus, rapid button clicks get swallowed. All helpers
   (`Input`, `Field`, `Cell`, `Toggle`, …) live at module scope in
   `popup-variations.jsx` and take a `c` palette prop.

6. **Instant buttons**: control cells + power fire on `onPointerDown`
   (hardware-button feel; three fast presses = three commands). Keyboard
   activation arrives as `click` with `e.detail === 0` — that branch must
   stay.

## Window sizing & positioning model

- The card is `CARD_W` (380) wide; the native window adds transparent
  padding (`PAD_X/TOP/BOTTOM` in popup-variations.jsx) so the CSS drop
  shadow and toast (hangs 34px below the card) aren't clipped.
  `tauri.conf.json` initial size (412×150) must stay in sync.
- A ResizeObserver on the card calls `backend.resizeWindow(w, h)` →
  `cmd_resize_window` (commands.rs) → `set_size` + re-anchor to tray
  (`tray::position_near_tray`): popup grows downward from the menubar on
  macOS, upward from the taskbar on Windows.
- Settings content scrolls only beyond `maxHeight: 520` (inner
  `.mc-settings-scroll` container).
- The window hides on focus loss (`lib.rs` on_window_event) — that's the
  "click outside closes popup" behavior, not a bug.

## Build & CI

- Local: `npm run build` (frontend), `cargo check` in `src-tauri/` (on
  Linux requires `libgtk-3-dev libwebkit2gtk-4.1-dev`).
- `.github/workflows/build.yml` builds on push to `main` and `claude/**`
  branches plus `v*` tags. Branch builds upload installers as artifacts
  (`installers-macos-latest` = universal .dmg, `installers-windows-latest`
  = .exe/.msi); tag pushes create GitHub releases.
- The user tests by downloading artifacts from the Actions page. Bump the
  footer version string in `popup-variations.jsx` ("v1.1.0 · DDC/CI") when
  shipping a build the user needs to distinguish from the previous one.

## Known cruft / pre-existing issues

- ~9 pre-existing ESLint errors (unused imports, react-refresh warnings) in
  `popup-shared.jsx` / `popup-variations.jsx` — not introduced by recent
  work, safe to clean up someday.
- `cmd_nav_up/down` VCP codes (0xCB) are guesses; verify per monitor model.
- Settings toggles (launch at login, show in tray) and hotkeys are
  display-only — not wired to anything yet.
- Monitor "IP address" field is persisted but unused by the backends.
