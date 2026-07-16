import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import node from '@astrojs/node';
import basicSsl from '@vitejs/plugin-basic-ssl';

// HTTPS en LAN: el micrófono del celular exige contexto seguro (https:// o localhost)
const useHttps = process.env.DEV_HTTPS === 'true';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: node({
    mode: 'standalone',
  }),
  integrations: [react(), tailwind()],
  server: {
    host: true,
    port: 4321,
  },
  vite: {
    plugins: useHttps ? [basicSsl()] : [],
    server: {
      https: useHttps,
    },
    build: {
      rollupOptions: {
        external: ['@prisma/client', '.prisma/client/default', '.prisma/client/edge'],
      },
    },
    ssr: {
      external: ['@prisma/client', '.prisma', '.prisma/client', '.prisma/client/default'],
    },
  },
});
