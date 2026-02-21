import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/auth': 'http://api:3000',
      '/certificates': 'http://api:3000',
      '/sales': 'http://api:3000',
    },
  },
});
