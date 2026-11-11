import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Saat development, /api diteruskan ke server demo Python (python -m demo, port 8450).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://127.0.0.1:8450', ws: true, changeOrigin: true },
    },
  },
});
