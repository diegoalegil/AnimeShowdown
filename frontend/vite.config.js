import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, join, basename } from 'node:path'
import {
  existsSync,
  statSync,
  readdirSync,
  copyFileSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { extname } from 'node:path'
import { createReadStream } from 'node:fs'
import Beasties from 'beasties'

const __dirname = dirname(fileURLToPath(import.meta.url))
const IMG_SRC = resolve(__dirname, 'img')
const IMG_URL_PREFIX = '/img/'

// MIME types que sirve este middleware. Si en el futuro añades .png/.jpg en
// frontend/img/, basta con extender este mapa.
const MIME = {
  '.webp': 'image/webp',
  // AVIF añadido tras el script generate-image-variants.mjs (Plan v2 §3.3).
  '.avif': 'image/avif',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
}

/**
 * Plugin que expone frontend/img/ bajo la URL /img/ tanto en dev como en
 * build. El usuario quiere mantener las imágenes en frontend/img/<Anime>/
 * (no en frontend/public/img/) porque sigue añadiendo más material y el
 * directorio frontend/img/ es su carpeta de trabajo natural.
 *
 * - dev:  middleware que sirve los archivos directamente desde disco al
 *         pegar /img/* (sin restart al añadir uno nuevo).
 * - build: copia frontend/img/ → dist/img/ después de cerrar el bundle,
 *         para que producción tenga los assets sin depender de la fuente.
 */
function imgFolderPlugin() {
  return {
    name: 'animeshowdown:img-folder',

    configureServer(server) {
      server.middlewares.use(IMG_URL_PREFIX, (req, res, next) => {
        // req.url aquí ya viene relativo al prefix /img/
        const decoded = decodeURIComponent(req.url.split('?')[0])
        const filePath = join(IMG_SRC, decoded)

        // Bloqueo path traversal: el resultado debe seguir dentro de IMG_SRC.
        if (!filePath.startsWith(IMG_SRC)) {
          res.statusCode = 403
          return res.end('Forbidden')
        }

        if (!existsSync(filePath) || !statSync(filePath).isFile()) {
          return next()
        }

        const mime = MIME[extname(filePath).toLowerCase()] || 'application/octet-stream'
        res.setHeader('Content-Type', mime)
        // Cache 1 día en dev; en prod Cloudflare maneja su propia cache de assets.
        res.setHeader('Cache-Control', 'public, max-age=86400')
        createReadStream(filePath).pipe(res)
      })
    },

    closeBundle() {
      // En build copiamos recursivo frontend/img/ → dist/img/ ignorando
      // .DS_Store, archivos sueltos en la raíz (como logo.png que no es de
      // ningún anime) y cualquier cosa que no sea una imagen reconocida.
      const outDir = resolve(__dirname, 'dist', 'img')
      if (!existsSync(IMG_SRC)) return

      let copied = 0
      const walk = (srcDir, dstDir) => {
        if (!existsSync(dstDir)) mkdirSync(dstDir, { recursive: true })
        for (const entry of readdirSync(srcDir, { withFileTypes: true })) {
          if (entry.name === '.DS_Store') continue
          const srcPath = join(srcDir, entry.name)
          const dstPath = join(dstDir, entry.name)
          if (entry.isDirectory()) {
            walk(srcPath, dstPath)
          } else if (MIME[extname(entry.name).toLowerCase()]) {
            copyFileSync(srcPath, dstPath)
            copied++
          }
        }
      }
      walk(IMG_SRC, outDir)
      // Log visible en build para detectar regresiones rápido.
      console.log(`[img-folder] copiadas ${copied} imágenes a ${basename(outDir)}/`)
    },
  }
}

/**
 * Critical CSS inline (Plan v2 §3.5). Tras el build de Vite, procesamos
 * dist/index.html con beasties (fork mantenido del abandonado critters).
 * Beasties analiza qué selectores usa el HTML inicial y los inlina en un
 * <style> dentro del <head>; el resto del CSS sigue siendo async via
 * <link rel="preload" as="style" onload=...>.
 *
 * Resultado típico: -200ms LCP, FOUC eliminado en la primera pintura.
 *
 * Conservador a propósito:
 *   - pruneSource: false → no tocamos el CSS chunk original (algunas rutas
 *     no son la home y necesitan el CSS completo en el primer render).
 *   - preload: 'media' → estrategia robusta de carga async sin requerir JS.
 *   - inlineThreshold: 4kB → CSS chunks pequeños se inlinan completos.
 */
function criticalCssPlugin() {
  return {
    name: 'animeshowdown:critical-css',
    apply: 'build',
    enforce: 'post',
    async closeBundle() {
      const distHtml = resolve(__dirname, 'dist', 'index.html')
      if (!existsSync(distHtml)) return
      const beasties = new Beasties({
        path: resolve(__dirname, 'dist'),
        publicPath: '/',
        preload: 'media',
        pruneSource: false,
        inlineThreshold: 4096,
        logLevel: 'warn',
      })
      try {
        const html = readFileSync(distHtml, 'utf8')
        const processed = await beasties.process(html)
        writeFileSync(distHtml, processed)
        console.log('[critical-css] index.html procesado con beasties')
      } catch (err) {
        // No tumbamos el build si beasties falla — degradación: HTML sin
        // inline crítico pero funcional. Log warn para detectarlo.
        console.warn(`[critical-css] error: ${err.message} — saltando inline`)
      }
    },
  }
}

/**
 * Configuración PWA (Plan v2 §3.2). vite-plugin-pwa con autoUpdate:
 *
 *   - registerType:'autoUpdate' → el SW comprueba updates en cada nav y
 *     refresca silenciosamente. Sin prompt al usuario.
 *   - manifest con iconos 192/512 (estándar Android/Chrome) +
 *     apple-touch-icon (iOS). theme_color magenta para la status bar.
 *   - workbox runtime caching:
 *       · /img/* → NetworkFirst mientras el catálogo sigue en curación.
 *         Hay cartas que se reemplazan manteniendo el mismo slug/path; servir
 *         CacheFirst hacía que sesiones antiguas vieran imágenes viejas/rotas.
 *       · /api/personajes y /api/torneos → NetworkFirst con timeout 3s.
 *         Si la red falla o tarda, devolvemos lo cacheado para no romper
 *         la UI en redes flaky.
 *       · /api/og/* → CacheFirst 7d (las OG son cacheables long-term).
 *   - navigateFallback:'/index.html' → SPA routing offline.
 *   - skipWaiting + clientsClaim → cambios entran inmediato sin esperar
 *     a cerrar todas las pestañas.
 */
const pwaPlugin = VitePWA({
  registerType: 'autoUpdate',
  injectRegister: 'auto',
  includeAssets: ['favicon.svg', 'robots.txt', 'apple-touch-icon.png'],
  manifest: {
    name: 'AnimeShowdown',
    short_name: 'AnimeShowdown',
    description:
      'Torneos de personajes anime con sistema ELO en vivo, brackets visuales y votación social.',
    theme_color: '#0d0d12',
    background_color: '#0d0d12',
    display: 'standalone',
    orientation: 'portrait-primary',
    scope: '/',
    start_url: '/',
    lang: 'es',
    categories: ['entertainment', 'games', 'social'],
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  },
  workbox: {
    skipWaiting: true,
    clientsClaim: true,
    // Audit P1 (2026-05-20): el SW estaba precacheando index.html con
    // `globPatterns: '**/*.{...,html,...}'` y luego sirviendo esa version
    // cacheada via `navigateFallback`. Cada deploy de Cloudflare Pages cambia
    // los hashes de los chunks lazy (PersonajesPage-XXXX.js, etc.); cuando
    // un usuario tenia el index.html del deploy anterior cacheado por el SW,
    // navegar a /personajes intentaba cargar el chunk del deploy viejo, que
    // ya no existe en CF Pages → CF respondia con index.html (regla SPA
    // `/* /index.html 200`) → el browser intentaba parsear HTML como JS →
    // TypeError "'text/html' is not a valid JavaScript MIME type" → todo
    // el arbol caia al ErrorBoundary global.
    //
    // Fix: el HTML no se precachea. Las navegaciones SPA van directamente
    // a red. Si la red falla, el browser muestra su pantalla offline en vez
    // de servir un HTML stale que apunta a chunks fantasma. Es menos
    // amistoso offline pero garantiza que cada deploy se ve consistente.
    navigateFallback: null,
    navigateFallbackDenylist: [/^\/api\//],
    maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
    // Shell minimo sin HTML: CSS, fonts e icons que cambian poco entre deploys.
    // Cuando el HTML cambia, el browser hace fetch nuevo y el SW solo provee
    // assets estaticos compartidos.
    globPatterns: [
      '**/*.{css,woff2}',
      'icon-*.png',
      'apple-touch-icon.png',
      'logo.webp',
    ],
    globIgnores: ['img/**', 'assets/**.js', 'assets/**.svg', '**/*.html'],
    runtimeCaching: [
      {
        // Audit P1 (2026-05-20): los chunks JS pasan de StaleWhileRevalidate
        // a NetworkFirst con timeout 3s. SWR servia el chunk cacheado primero
        // mientras revalidaba; cuando el HTML era nuevo pero el chunk cached
        // era de otro deploy, el browser cargaba codigo incompatible y
        // disparaba runtime errors silenciosos. NetworkFirst pide siempre la
        // version actual; cache es solo fallback offline.
        //
        // Tambien `statuses: [200]` (sin 0): un chunk JS que viene como HTML
        // de la regla SPA fallback `/* /index.html 200` llega con status 200
        // pero Content-Type text/html. Workbox no valida content-type, asi
        // que si lo cacheamos quedamos atrapados en el bug. Con `[200]` aun
        // se cachea, pero el reactivo de chunkErrorRecovery limpia el SW
        // cuando detecta el TypeError de MIME.
        urlPattern: ({ url }) =>
          url.pathname.startsWith('/assets/') &&
          (url.pathname.endsWith('.js') || url.pathname.endsWith('.svg')),
        handler: 'NetworkFirst',
        options: {
          cacheName: 'chunks-js-v2',
          networkTimeoutSeconds: 3,
          expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 30 },
          cacheableResponse: { statuses: [200] },
        },
      },
      {
        urlPattern: ({ url }) => url.pathname.startsWith('/img/'),
        handler: 'NetworkFirst',
        options: {
          cacheName: 'imagenes-personajes-v2',
          networkTimeoutSeconds: 3,
          fetchOptions: { cache: 'reload' },
          expiration: {
            maxEntries: 300,
            maxAgeSeconds: 60 * 60 * 24 * 7,
            purgeOnQuotaError: true,
          },
          cacheableResponse: { statuses: [0, 200] },
        },
      },
      {
        urlPattern: ({ url }) => url.pathname.startsWith('/api/personajes'),
        handler: 'NetworkFirst',
        options: {
          cacheName: 'api-personajes',
          networkTimeoutSeconds: 3,
          expiration: { maxEntries: 50, maxAgeSeconds: 60 * 5 },
          cacheableResponse: { statuses: [0, 200] },
        },
      },
      {
        // Audit P1 (2026-05-17): excluye /api/torneos/mios del cache del SW.
        // Antes el catch-all '/api/torneos' (regla siguiente) guardaba
        // "mis torneos" de cualquier usuario en la PWA; otro usuario en la
        // misma instalación podía verlos offline o tras network timeout
        // (workbox sirve cache si el fetch tarda > networkTimeoutSeconds).
        // NetworkOnly nunca lee del cache para esta ruta. Las predicciones
        // privadas viven bajo /api/predicciones/mias/*, que no entra en
        // ninguna runtimeCaching y por tanto no se cachea por defecto.
        urlPattern: ({ url }) => url.pathname === '/api/torneos/mios',
        handler: 'NetworkOnly',
      },
      {
        urlPattern: ({ url }) => url.pathname.startsWith('/api/torneos'),
        handler: 'NetworkFirst',
        options: {
          cacheName: 'api-torneos',
          networkTimeoutSeconds: 3,
          expiration: { maxEntries: 50, maxAgeSeconds: 60 },
          cacheableResponse: { statuses: [0, 200] },
        },
      },
      {
        urlPattern: ({ url }) => url.pathname.startsWith('/api/og/'),
        handler: 'CacheFirst',
        options: {
          cacheName: 'og-images',
          expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 7 },
          cacheableResponse: { statuses: [0, 200] },
        },
      },
    ],
  },
})

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    imgFolderPlugin(),
    pwaPlugin,
    // criticalCssPlugin va al final con enforce:'post' para que Vite ya
    // haya emitido el HTML cuando lo procesamos.
    criticalCssPlugin(),
  ],
  build: {
    // Vendor chunks explícitos: sin esto Rolldown junta todo en index y
    // pasa de 150KB a 300KB+ gzip. Cada vendor se aísla en su propio
    // chunk para que se cachee long-term separado (cambios en código de
    // app no invalidan los vendor chunks). Plan v2 §3.10: budget 250KB.
    //   - lucide-react: ~150KB gzip si va en index, peso muerto en muchas
    //     páginas.
    //   - framer-motion: ~50KB gzip, lo usan rutas con animación.
    //   - i18n: ~30KB gzip (i18next + react-i18next + detector).
    //   - react vendor: react/react-dom/react-router-dom siempre cargado.
    rollupOptions: {
      output: {
        // Rolldown solo acepta manualChunks como función (no objeto, a
        // diferencia de Rollup clásico). Devolvemos el nombre del chunk
        // según el path del módulo en node_modules. id viene como path
        // absoluto: `.../node_modules/lucide-react/dist/...`.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (
            id.includes('@react-three/') ||
            id.includes('/three/') ||
            id.includes('\\three\\') ||
            id.includes('three-stdlib')
          ) {
            return 'personaje3d'
          }
          if (id.includes('lucide-react')) return 'lucide'
          if (id.includes('framer-motion')) return 'framer'
          if (
            id.includes('i18next') ||
            id.includes('react-i18next')
          ) {
            return 'i18n'
          }
          if (
            id.includes('/react-router-dom/') ||
            id.includes('/react-router/') ||
            id.includes('/react-dom/') ||
            id.match(/[/\\]node_modules[/\\]react[/\\]/)
          ) {
            return 'react-vendor'
          }
          return undefined
        },
      },
    },
  },
})
