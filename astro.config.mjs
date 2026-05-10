import { defineConfig } from 'astro/config';

// URL público del sitio (build). Necesario para og:url, canonical e imágenes absolutas en redes sociales.
// Ejemplo: PUBLIC_SITE_URL=https://tudominio.com pnpm build
export default defineConfig({
  site: process.env.PUBLIC_SITE_URL,
  devToolbar: {
    enabled: false,
  },
  vite: {
    ssr: {
      noExternal: ['three'],
    },
  },
});
