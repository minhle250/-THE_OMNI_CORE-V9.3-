import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // Ép Vite chạy tại cổng 8080 theo yêu cầu chiến thuật
    host: '0.0.0.0', // Lắng nghe trên mọi interface
    port: 8080,
  },
})