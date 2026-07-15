import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import node from '@astrojs/node';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: node({
    mode: 'standalone',
  }),
  integrations: [react(), tailwind()],
  vite: {
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
