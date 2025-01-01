import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import pagefind from 'astro-pagefind';

export default defineConfig({
  site: 'https://witty-web.vercel.app',
  integrations: [
    react(),
    tailwind({ applyBaseStyles: false }),
    pagefind(),
  ],
  build: { format: 'directory' },
});
