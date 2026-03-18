import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.BASE_URL': JSON.stringify(env.BASE_URL),
      'process.env.API_KEY': JSON.stringify(env.API_KEY),
      'process.env.MODEL': JSON.stringify(env.MODEL),
      'process.env.GITHUB_TOKEN': JSON.stringify(env.GITHUB_TOKEN),
      'process.env.MAX_DRILL_DOWN_DEPTH': JSON.stringify(env.MAX_DRILL_DOWN_DEPTH || '2'),
      'process.env.KEY_SUB_FUNCTION_LIMIT': JSON.stringify(env.KEY_SUB_FUNCTION_LIMIT || '10'),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
