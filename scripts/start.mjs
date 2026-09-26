/**
 * `yarn start` / `npm start`
 *
 * - Em produção (Render define RENDER=true; ou NODE_ENV=production): serve o build já
 *   compilado em `dist/` com `vite preview`, leve (~140 MB), na porta $PORT e em 0.0.0.0.
 * - No computador: abre o servidor de desenvolvimento do Vite (http://localhost:5173).
 */
import { existsSync } from 'node:fs';
import { createServer, preview } from 'vite';

const production = process.env.RENDER === 'true' || process.env.NODE_ENV === 'production';

if (production) {
  if (!existsSync('dist/index.html')) {
    console.error('Build não encontrado em dist/. Rode "yarn build" (ou "npm run build") antes de iniciar.');
    process.exit(1);
  }
  const server = await preview({
    preview: { host: '0.0.0.0', port: Number(process.env.PORT) || 4173, strictPort: true },
  });
  server.printUrls();
} else {
  const server = await createServer();
  await server.listen();
  server.printUrls();
}
