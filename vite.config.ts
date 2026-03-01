// File: /the-omni-core/vite.config.ts
// [SENTINEL] Axis-XYZ Ignition & GitHub Pages Routing

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/-THE_OMNI_CORE-V9.3-/', // [CRITICAL] Ép tọa độ Sub-directory cho GitHub Pages
  server: {
    // Ép Vite chạy tại cổng 8080 theo yêu cầu chiến thuật
    host: '0.0.0.0', // Lắng nghe trên mọi interface
    port: 8080,
  },
})
