import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 4011,
    proxy: {
      '/api': {
        target: 'http://localhost:4010',
        changeOrigin: true,
      },
    },
  },
});

