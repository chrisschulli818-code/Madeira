/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { aiPlugin } from './server/aiPlugin';

export default defineConfig({
  // aiPlugin: endpoint /api/montar do assistente de IA com Gemini (chave em GEMINI_API_KEY, só no servidor).
  plugins: [react(), tailwindcss(), aiPlugin()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  preview: {
    // Permite servir o build em produção no Render (Web Service): yarn build && yarn serve
    allowedHosts: ['.onrender.com'],
  },
  build: {
    // Three.js fica em um chunk separado, carregado sob demanda (viewport 3D).
    chunkSizeWarningLimit: 1000,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
