import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],

  // Tauri dev server — must use a fixed port so tauri.conf.json devUrl matches.
  server: {
    port:        5173,
    strictPort:  true,
    // Allow the Tauri webview to reach the dev server.
    host:        '0.0.0.0',
  },

  // Tauri CLI passes TAURI_ENV_* vars; expose them to the frontend.
  envPrefix: ['VITE_', 'TAURI_ENV_'],

  build: {
    // Produce a single-page app suitable for Tauri's webview.
    target:   'esnext',
    minify:   true,
    // Keep source maps in dev, strip in release.
    sourcemap: process.env.NODE_ENV !== 'production',
  },
});
