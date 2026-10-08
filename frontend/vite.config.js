import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // The backend only accepts requests from this exact address (FRONTEND_ORIGIN),
    // so fail loudly if the port is taken instead of quietly moving to another one.
    port: 5173,
    strictPort: true,
  },
});
