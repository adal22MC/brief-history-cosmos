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
    // En dev, three se importa por rutas profundas (three/src/...) desde una escena que carga diferida.
    // Si Vite lo preempaqueta, descubre esos módulos tarde, reoptimiza y responde 504 "Outdated Optimize Dep":
    // la escena 3D no carga. three/src ya es ESM, así que se sirve tal cual.
    optimizeDeps: {
      exclude: ['three'],
      include: [
        'gsap',
        'gsap/ScrollTrigger',
        'lenis',
        'astro/virtual-modules/transitions-router.js',
        'astro/virtual-modules/transitions-types.js',
        'astro/virtual-modules/transitions-events.js',
        'astro/virtual-modules/transitions-swap-functions.js',
      ],
    },
  },
});
