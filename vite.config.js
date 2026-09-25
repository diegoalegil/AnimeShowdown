import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { urlPublica } from './src/lib/images.js'
import { LOGO, pieza, TAMANO_SALA } from './src/lib/marca.js'

// BASE_PATH lo fija el despliegue: "/" con dominio propio, "/<repo>/" en GitHub Pages.
const base = process.env.BASE_PATH || '/'

// Fuentes de toda la interfaz: se piden desde el HTML, antes que cualquier
// otra, para que el texto no espere detrás de los glifos japoneses.
const FUENTES_CRITICAS = /^assets\/(ibm-plex-sans-latin-400-normal|zen-old-mincho-latin-700-normal)-[\w-]+\.woff2$/

/** Añade <link rel="preload"> para las fuentes críticas ya con su nombre final. */
function precargarFuentes() {
  return {
    name: 'precargar-fuentes',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(_html, { bundle }) {
        const archivos = Object.keys(bundle ?? {}).filter((f) => FUENTES_CRITICAS.test(f))
        if (archivos.length !== 2) throw new Error(`precargar-fuentes: se esperaban 2 fuentes críticas, hay ${archivos.length}`)
        return archivos.map((f) => ({
          tag: 'link',
          attrs: { rel: 'preload', href: base + f, as: 'font', type: 'font/woff2', crossorigin: '' },
          injectTo: 'head',
        }))
      },
    },
  }
}

/** Icono de la pestaña y de la pantalla de inicio: el logo de src/lib/marca.js. */
function iconos() {
  return {
    name: 'iconos',
    transformIndexHtml: () => [
      { tag: 'link', attrs: { rel: 'icon', href: urlPublica(LOGO.favicon, base), type: 'image/png' }, injectTo: 'head' },
      { tag: 'link', attrs: { rel: 'apple-touch-icon', href: urlPublica(LOGO.tactil, base) }, injectTo: 'head' },
    ],
  }
}

// La sala de cartas de la portada (la galería sin filtros) es lo primero que
// se ve: el HTML la pide a la vez que el JavaScript, con el mismo srcset y
// sizes que su <img> (ver components/Portada), así que el navegador elige el
// mismo archivo. Solo va en la portada: scripts/prerender.mjs la quita de las
// demás rutas.
function precargarPortada() {
  const sala = pieza('personajes-archive', base)
  return {
    name: 'precargar-portada',
    apply: 'build',
    transformIndexHtml: () => [
      {
        tag: 'link',
        attrs: {
          rel: 'preload',
          as: 'image',
          type: 'image/webp',
          imagesrcset: sala.srcSet,
          imagesizes: TAMANO_SALA,
          fetchpriority: 'high',
          'data-portada': '',
        },
        injectTo: 'head',
      },
    ],
  }
}

export default defineConfig({
  base,
  plugins: [react(), tailwindcss(), iconos(), precargarFuentes(), precargarPortada()],
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            // El catálogo cambia con cada carta nueva; React casi nunca.
            // Separarlos permite que la caché del navegador conserve uno al cambiar el otro.
            { name: 'catalogo', test: /[\\/]src[\\/]data[\\/]/ },
            { name: 'react', test: /[\\/]node_modules[\\/](react|react-dom|scheduler|react-router)[\\/]/ },
          ],
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{js,jsx}', 'scripts/**/*.test.mjs'],
  },
})
