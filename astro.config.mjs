import { defineConfig } from 'astro/config';

export default defineConfig({
  devToolbar: {
    enabled: false,
  },
  vite: {
    ssr: {
      noExternal: ['three'],
    },
  },
});
