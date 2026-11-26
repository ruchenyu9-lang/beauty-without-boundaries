import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => ({
  // 生产构建使用 GitHub Pages 项目站点路径，本地开发仍保持 /
  base: mode === 'production' ? '/beauty-without-boundaries/' : '/',
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
}));
