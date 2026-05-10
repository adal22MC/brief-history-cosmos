# Una breve historia del cosmos

He desarrollado este sitio como proyecto estático: capítulos editoriales sobre la evolución del universo, interfaz bilingüe (ES/EN), escena 3D con **Three.js**, animaciones con **GSAP** y scroll suave con **Lenis**, sobre **Astro**.

## Requisitos

- [Node.js](https://nodejs.org/) (LTS recomendado)
- [pnpm](https://pnpm.io/) 10.x (`package.json` fija `packageManager`)

## Desarrollo

```bash
pnpm install
pnpm dev
```

En la consola aparece la URL local (por defecto `http://localhost:4321`).

## Scripts

| Comando | Descripción |
|--------|-------------|
| `pnpm dev` | Servidor de desarrollo |
| `pnpm build` | Genera el sitio en `dist/` |
| `pnpm preview` | Previsualiza `dist/` en local |
| `pnpm check` | Comprobación de tipos y plantillas Astro |
| `pnpm lint` | ESLint |
| `pnpm lint:fix` | ESLint con corrección automática |

## Estructura (resumen)

- `src/pages/` — rutas y página principal
- `src/layouts/` — plantilla base
- `src/components/` — bloques de UI por sección
- `src/content/` — datos del relato (capítulos)
- `src/scripts/` — Three.js, animaciones y scripts de cliente
