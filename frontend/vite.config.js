import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, join, basename } from 'node:path'
import {
  existsSync,
  statSync,
  readdirSync,
  copyFileSync,
  mkdirSync,
  rmSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { extname } from 'node:path'
import { createReadStream } from 'node:fs'
import process from 'node:process'
import Beasties from 'beasties'

const __dirname = dirname(fileURLToPath(import.meta.url))
const IMG_SRC = resolve(__dirname, 'img')
const IMG_URL_PREFIX = '/img/'
const IMG_CDN_BASE_URL = normalizeImageCdnBaseUrl(
  process.env.ANIMESHOWDOWN_IMG_CDN_BASE_URL ||
    process.env.ANIMESHOWDOWN_IMAGE_CDN_BASE_URL,
)
const SKIP_IMG_COPY =
  process.env.ANIMESHOWDOWN_SKIP_IMG_COPY === 'true' ||
  Boolean(IMG_CDN_BASE_URL)

// MIME types que sirve este middleware. Si en el futuro añades .png/.jpg en
// frontend/img/, basta con extender este mapa.
const MIME = {
  '.webp': 'image/webp',
  // AVIF añadido tras el script generate-image-variants.mjs.
  '.avif': 'image/avif',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
}

// En producción copiamos solo formatos que el runtime referencia bajo /img/.
// Las variantes AVIF siguen pudiendo existir en la carpeta fuente para pruebas
// locales, pero PersonajeImg/PersonajeCutImg solo publican srcset WebP. Evitar
// subirlas recorta cientos de MB del deploy de Cloudflare sin tocar el catálogo.
const BUILD_IMAGE_MIME = Object.fromEntries(
  Object.entries(MIME).filter(([ext]) => ext !== '.avif'),
)

function normalizeImageCdnBaseUrl(value) {
  const trimmed = value?.trim()
  if (!trimmed) return null
  let url
  try {
    url = new URL(trimmed)
  } catch {
    throw new Error(
      `ANIMESHOWDOWN_IMG_CDN_BASE_URL debe ser una URL absoluta https/http valida: ${trimmed}`,
    )
  }
  if (!['https:', 'http:'].includes(url.protocol)) {
    throw new Error(
      `ANIMESHOWDOWN_IMG_CDN_BASE_URL debe usar https/http, no ${url.protocol}`,
    )
  }
  if (url.protocol !== 'https:' && process.env.NODE_ENV === 'production') {
    throw new Error('ANIMESHOWDOWN_IMG_CDN_BASE_URL debe usar https en produccion')
  }
  return url.toString().replace(/\/+$/, '')
}

function requireImageCdnBaseUrl() {
  if (IMG_CDN_BASE_URL) return IMG_CDN_BASE_URL
  // Sin CDN URL: bloqueamos SOLO en el deploy real de Cloudflare Pages
  // (que setea CF_PAGES=1). Vite `build` setea NODE_ENV=production siempre,
  // incluso en local/CI, así que no podemos usar eso como discriminador.
  // En local/CI/preview/sandbox: warn + skip redirect. El bundle sigue
  // siendo válido y los tests E2E no necesitan asset CDN para correr.
  if (process.env.CF_PAGES === '1') {
    throw new Error(
      'ANIMESHOWDOWN_SKIP_IMG_COPY=true requiere ANIMESHOWDOWN_IMG_CDN_BASE_URL en CF Pages deploy, por ejemplo https://assets.animeshowdown.dev/img',
    )
  }
  return null
}

function ensureImgCdnRedirect(cdnBaseUrl) {
  const redirectsPath = resolve(__dirname, 'dist', '_redirects')
  const generatedBlockStart =
    '# Imagenes del catalogo: servidas desde CDN externo para mantener Cloudflare Pages liviano.'
  const generatedBlock = `${generatedBlockStart}\n/img/* ${cdnBaseUrl}/:splat 302\n\n`
  const existing = existsSync(redirectsPath)
    ? readFileSync(redirectsPath, 'utf8')
    : ''
  const withoutGeneratedBlock = existing
    .replace(
      new RegExp(`${escapeRegExp(generatedBlockStart)}\\n/img/\\*\\s+\\S+\\s+30[1278]\\n\\n?`, 'g'),
      '',
    )
    .replace(/^\/img\/\*\s+\S+\s+30[1278]\s*\n+/gm, '')
  writeFileSync(redirectsPath, `${generatedBlock}${withoutGeneratedBlock}`)
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
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

        // Bloqueo de path traversal: el resultado debe seguir dentro de IMG_SRC.
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
      const outDir = resolve(__dirname, 'dist', 'img')
      if (SKIP_IMG_COPY) {
        const cdnBaseUrl = requireImageCdnBaseUrl()
        rmSync(outDir, { recursive: true, force: true })
        if (cdnBaseUrl) {
          ensureImgCdnRedirect(cdnBaseUrl)
          console.log(`[img-folder] /img/* servido desde CDN externo: ${cdnBaseUrl}/:splat`)
        } else {
          console.log('[img-folder] CDN URL no configurada; redirect /img/* no generado (OK para local/CI)')
        }
        console.log('[img-folder] frontend/img/ no se copia al artefacto de build')
        return
      }

      // En build copiamos recursivo frontend/img/ → dist/img/ ignorando
      // .DS_Store, archivos sueltos en la raíz (logo vive en public/) y
      // cualquier cosa que no sea una imagen usada en producción.
      if (!existsSync(IMG_SRC)) return

      let copied = 0
      const walk = (srcDir, dstDir, isRoot = false) => {
        if (!existsSync(dstDir)) mkdirSync(dstDir, { recursive: true })
        for (const entry of readdirSync(srcDir, { withFileTypes: true })) {
          if (entry.name === '.DS_Store') continue
          const srcPath = join(srcDir, entry.name)
          const dstPath = join(dstDir, entry.name)
          if (entry.isDirectory()) {
            walk(srcPath, dstPath)
          } else if (!isRoot && BUILD_IMAGE_MIME[extname(entry.name).toLowerCase()]) {
            copyFileSync(srcPath, dstPath)
            copied++
          }
        }
      }
      walk(IMG_SRC, outDir, true)
      // Log visible en build para detectar regresiones rápido.
      console.log(`[img-folder] copiadas ${copied} imágenes a ${basename(outDir)}/`)
    },
  }
}

/**
 * Critical CSS inline. Tras el build de Vite, procesamos
 * dist/index.html con beasties (fork mantenido del abandonado critters).
 * Beasties analiza qué selectores usa el HTML inicial y los inlina en un
 * <style> dentro del <head>; el CSS completo sigue cargando como stylesheet
 * normal. Evitamos estrategias async con `media=print/onload`: si Safari o
 * una pestaña con SW stale falla durante el bootstrap JS, la app no debe
 * quedar con el HTML montado pero sin estilos globales.
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
      const distDir = resolve(__dirname, 'dist')
      const distHtml = resolve(distDir, 'index.html')
      const distHeaders = resolve(distDir, '_headers')
      if (!existsSync(distHtml)) return
      const beasties = new Beasties({
        path: distDir,
        publicPath: '/',
        preload: false,
        pruneSource: false,
        inlineThreshold: 4096,
        logLevel: 'warn',
      })
      try {
        const html = readFileSync(distHtml, 'utf8')
        const processed = await beasties.process(html)
        writeFileSync(distHtml, processed)
        updateCriticalStyleHashes(distHeaders, processed)
        console.log('[critical-css] index.html procesado con beasties')
      } catch (err) {
        // No tumbamos el build si beasties falla — degradación: HTML sin
        // inline crítico pero funcional. Log warn para detectarlo.
        console.warn(`[critical-css] error: ${err.message} — saltando inline`)
      }
    },
  }
}

// Hashes de <style> inyectados en RUNTIME por librerías de terceros. No están
// en dist/index.html, así que inlineStyleHashes() no puede detectarlos: hay que
// listarlos a mano para que la CSP (style-src-elem) los permita.
//   - Sonner monta su propio <style> para los toasts. Sin este hash, la CSP lo
//     bloquea ("Refused to apply stylesheet") en TODAS las rutas y los toasts
//     pueden perder estilos.
//   - Algunas librerías montan un <style> vacío antes de inyectar reglas por
//     CSSOM. La CSP reporta ese caso con el hash del string vacío.
// OJO: atado a la versión de Sonner. Si se actualiza y cambia su CSS, el hash
// cambia y hay que regenerarlo (el navegador lo reporta en la violación CSP).
const RUNTIME_STYLE_HASHES = [
  "'sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU='",
  "'sha256-CIxDM5jnsGiKqXs2v7NKCY5MzdR9gu6TtiMJrDw29AY='",
]

function updateCriticalStyleHashes(headersPath, html) {
  if (!existsSync(headersPath)) return
  // Hashes del CSS crítico inline (beasties) + los de estilos de runtime que el
  // HTML no contiene (Sonner). Set para deduplicar si beasties repite alguno.
  const hashes = [...new Set([...inlineStyleHashes(html), ...RUNTIME_STYLE_HASHES])]
  if (hashes.length === 0) return

  const headers = readFileSync(headersPath, 'utf8')
  const updated = headers.replace(
    /(Content-Security-Policy:\s*)([^\n]+)/,
    (_, prefix, csp) => `${prefix}${appendStyleHashesToCsp(csp, hashes)}`,
  )
  if (updated !== headers) {
    writeFileSync(headersPath, updated)
    console.log(`[critical-css] CSP actualizada con ${hashes.length} hash(es) de style inline`)
  }
}

function inlineStyleHashes(html) {
  const hashes = new Set()
  for (const match of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
    const content = match[1]
    if (content.trim()) {
      hashes.add(`'sha256-${createHash('sha256').update(content).digest('base64')}'`)
    }
  }
  return [...hashes]
}

function appendStyleHashesToCsp(csp, hashes) {
  return csp
    .split(';')
    .map((directive) => {
      const trimmed = directive.trim()
      if (!trimmed) return trimmed
      const [name, ...tokens] = trimmed.split(/\s+/)
      if (name !== 'style-src' && name !== 'style-src-elem') return trimmed

      const tokenSet = new Set(tokens)
      for (const hash of hashes) {
        tokenSet.add(hash)
      }
      return [name, ...tokenSet].join(' ')
    })
    .join('; ')
}

/**
 * Configuración PWA con vite-plugin-pwa y autoUpdate:
 *
 *   - registerType:'autoUpdate' → el SW comprueba updates en cada nav y
 *     refresca silenciosamente, sin pedir acción al usuario.
 *   - manifest con iconos 192/512 (estándar Android/Chrome) +
 *     apple-touch-icon (iOS). theme_color #080b12 (fondo real del body) para la status bar.
 *   - workbox runtime caching:
 *       · /img/* → NetworkFirst mientras el catálogo sigue en curación.
 *         Hay cartas que se reemplazan manteniendo el mismo slug/path; servir
 *         CacheFirst hacía que sesiones antiguas vieran imágenes viejas/rotas.
 *       · /api/personajes y /api/torneos → NetworkFirst con timeout 3s.
 *         Si la red falla o tarda, devolvemos lo cacheado para no romper
 *         la UI en redes flaky.
 *       · /api/og/* → CacheFirst 7d (las OG son cacheables long-term).
 *   - navigateFallback:null → las navegaciones van a red para evitar HTML
 *     stale apuntando a chunks antiguos tras deploy.
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
    theme_color: '#080b12',
    background_color: '#080b12',
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
    // El SW no precachea index.html: debe ir siempre a red para evitar
    // HTML antiguo apuntando a chunks que ya no existen tras un deploy.
    //
    // Antes se precacheaba index.html con
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
    importScripts: ['push-sw.js'],
    // Shell minimo sin HTML: fonts e icons que cambian poco entre deploys.
    // El CSS NO se precachea (eran ~764 KB / ~63 entradas de CSS de ruta en
    // CADA install del SW, A10); se cachea en runtime por StaleWhileRevalidate
    // conforme se visita cada ruta (ver runtimeCaching). Cuando el HTML cambia,
    // el browser hace fetch nuevo y el SW solo provee assets estaticos.
    globPatterns: [
      '**/*.woff2',
      'icon-*.png',
      'apple-touch-icon.png',
      'logo.webp',
    ],
    globIgnores: ['img/**', 'assets/**.js', 'assets/**.svg', 'assets/**.css', '**/*.html'],
    runtimeCaching: [
      {
        // Los chunks JS usan NetworkFirst con timeout 3s. SWR
        // servia el chunk cacheado primero mientras revalidaba; cuando el HTML
        // era nuevo pero el chunk cached era de otro deploy, el browser cargaba
        // codigo incompatible y disparaba runtime errors silenciosos.
        // NetworkFirst pide siempre la version actual; cache es solo fallback
        // offline.
        //
        // PROACTIVO contra cache poison de content-type: el plugin
        // requireContentType inspecciona el Content-Type de cada respuesta
        // ANTES de pasarla al Cache Storage. Si Cloudflare devolvio el SPA
        // fallback (index.html) por una URL .js no encontrada, llega 200 OK
        // pero con Content-Type text/html — caso real visto en prod cuando
        // el deploy aun no tiene un asset y la regla SPA `/* /index.html 200`
        // captura el path. Antes Workbox cachaba ese HTML como si fuera JS
        // y el browser fallaba con "'text/html' is not a valid JavaScript
        // MIME type". El plugin rechaza esos casos devolviendo null, asi
        // que la Cache Storage queda intacta y la siguiente request va a red.
        urlPattern: ({ url }) =>
          url.pathname.startsWith('/assets/') &&
          (url.pathname.endsWith('.js') || url.pathname.endsWith('.svg')),
        handler: 'NetworkFirst',
        options: {
          cacheName: 'chunks-js-v3',
          networkTimeoutSeconds: 3,
          expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 30 },
          cacheableResponse: { statuses: [200] },
          plugins: [
            {
              cacheWillUpdate: async ({ response }) => {
                if (!response || response.status !== 200) return null
                const ct = (response.headers.get('content-type') || '').toLowerCase()
                // Aceptar JS y SVG con cualquier subtype. text/html rechazado.
                const ok = /^(application|text)\/(javascript|ecmascript)/.test(ct)
                  || /^image\/svg\+xml/.test(ct)
                return ok ? response : null
              },
            },
          ],
        },
      },
      {
        // CSS de ruta: NO se precachea (A10) y se cachea en runtime conforme se
        // visita cada vista. SWR sirve el CSS cacheado al instante y revalida en
        // segundo plano; como el HTML va siempre a red (navigateFallback:null)
        // referencia el hash de CSS vigente, no hay riesgo de CSS fantasma. El
        // guard de content-type evita guardar el fallback SPA (text/html 200 que
        // Cloudflare sirve para un .css aun no desplegado) como si fuera CSS.
        urlPattern: ({ url }) =>
          url.pathname.startsWith('/assets/') && url.pathname.endsWith('.css'),
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'estilos-css-v1',
          expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 },
          cacheableResponse: { statuses: [200] },
          plugins: [
            {
              cacheWillUpdate: async ({ response }) => {
                if (!response || response.status !== 200) return null
                const ct = (response.headers.get('content-type') || '').toLowerCase()
                return /^text\/css/.test(ct) ? response : null
              },
            },
          ],
        },
      },
      {
        // OJO: /img/* NO se intercepta aqui. En produccion /img/* hace un
        // redirect 302 cross-origin al CDN de imagenes (assets.animeshowdown.dev).
        // Workbox no puede cachear una respuesta redirigida (cache.put lanza
        // sobre response.redirected) → la estrategia NetworkFirst rechazaba, no
        // habia cache de fallback y TODAS las imagenes de personaje caian a
        // net::ERR_FAILED → PersonajePlaceholder ("Sombra en camino") para
        // cualquier visitante con el SW instalado. Dejamos que el navegador
        // cargue /img/ nativamente: sigue el 302 sin problema (img-src permite
        // el CDN) y el caching lo dan el CDN + la HTTP cache del navegador.
        //
        // Solo cacheamos /assets/* (mismo origen, sin redirect): banners de
        // anime, brand, covers de juegos/torneos/eventos, empty-states. El
        // plugin requireContentType (image/*) protege contra el cache poison de
        // Cloudflare (HTML 200 servido para un .webp que aun no estaba en el
        // deploy), que si no perpetuaria el SW aun tras purgar la edge.
        urlPattern: ({ url }) => url.pathname.startsWith('/assets/'),
        handler: 'NetworkFirst',
        // Sin fetchOptions {cache:'reload'}: ese flag saltaba la HTTP cache
        // del navegador y re-descargaba banners/covers completos en cada
        // vista. La protección contra cache poison la da el plugin
        // requireContentType (image/*) de abajo, no el reload.
        options: {
          cacheName: 'imagenes-personajes-v3',
          networkTimeoutSeconds: 3,
          expiration: {
            maxEntries: 300,
            maxAgeSeconds: 60 * 60 * 24 * 7,
            purgeOnQuotaError: true,
          },
          cacheableResponse: { statuses: [200] },
          plugins: [
            {
              cacheWillUpdate: async ({ response }) => {
                if (!response || response.status !== 200) return null
                const ct = (response.headers.get('content-type') || '').toLowerCase()
                // Solo image/* — webp, avif, png, jpeg, svg.
                return /^image\//.test(ct) ? response : null
              },
            },
          ],
        },
      },
      {
        // Solo cacheamos lectura pública, estable y sin Authorization del catálogo/personaje.
        // Endpoints user-specific bajo /api/personajes/*/favorito quedan
        // fuera para no guardar estado personal en CacheStorage. Además,
        // si el usuario está logueado, api.js añade Authorization por defecto:
        // no cacheamos esas variantes porque el backend puede devolver flags
        // dependientes de sesión en rutas públicas actuales o futuras.
        urlPattern: ({ url, request }) =>
          request.method === 'GET' &&
          !request.headers.has('Authorization') &&
          /^\/api\/personajes(?:\/(?:catalogo|buscar|[^/]+))?$/.test(url.pathname),
        handler: 'NetworkFirst',
        options: {
          cacheName: 'api-personajes',
          networkTimeoutSeconds: 3,
          expiration: { maxEntries: 50, maxAgeSeconds: 60 * 5 },
          cacheableResponse: { statuses: [200] },
          plugins: [
            {
              cacheWillUpdate: async ({ response }) => {
                if (!response || response.status !== 200) return null
                const ct = (response.headers.get('content-type') || '').toLowerCase()
                return /^application\/json/.test(ct) ? response : null
              },
            },
          ],
        },
      },
      {
        // Excluye /api/torneos/mios del cache del SW. El catch-all
        // '/api/torneos' (regla siguiente) guardaría
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
        urlPattern: ({ url, request }) =>
          request.method === 'GET' &&
          !request.headers.has('Authorization') &&
          url.pathname.startsWith('/api/torneos'),
        handler: 'NetworkFirst',
        options: {
          cacheName: 'api-torneos',
          networkTimeoutSeconds: 3,
          expiration: { maxEntries: 50, maxAgeSeconds: 60 },
          cacheableResponse: { statuses: [200] },
          plugins: [
            {
              cacheWillUpdate: async ({ response }) => {
                if (!response || response.status !== 200) return null
                const ct = (response.headers.get('content-type') || '').toLowerCase()
                return /^application\/json/.test(ct) ? response : null
              },
            },
          ],
        },
      },
      {
        urlPattern: ({ url }) => url.pathname.startsWith('/api/og/'),
        handler: 'CacheFirst',
        options: {
          cacheName: 'og-images',
          expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 7 },
          cacheableResponse: { statuses: [200] },
          plugins: [
            {
              cacheWillUpdate: async ({ response }) => {
                if (!response || response.status !== 200) return null
                const ct = (response.headers.get('content-type') || '').toLowerCase()
                return /^image\//.test(ct) ? response : null
              },
            },
          ],
        },
      },
    ],
  },
})

export default defineConfig({
  // Alias drop-in: 'sonner' resuelve al toaster temático "Partes de combate"
  // (DispatchToast). Mantiene los ~241 call-sites y el <Toaster> de App.jsx
  // sin tocar (DispatchToast exporta `toast` + `Toaster`). El paquete sonner
  // sigue en package.json pero queda inerte. vitest.config.js replica el alias.
  resolve: {
    alias: {
      sonner: resolve(__dirname, 'src/components/DispatchToast.jsx'),
    },
  },
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
    // 'hidden' emite los .map SIN referenciarlos desde el bundle: los stack
    // traces de Sentry se desminifican (subir los .map al release y NO
    // desplegarlos), pero no se expone el código fuente en producción.
    sourcemap: 'hidden',
    // Personaje3D queda aislado como chunk lazy y lo vigila npm run test:bundle.
    // Baja de 1000 → 500KB: el global warning ahora cubre framer/i18n/lucide
    // que antes se colaban, y el budget script (test:bundle) hace ceiling
    // por chunk-type concreto. Persona3d es lazy y no afecta LCP.
    chunkSizeWarningLimit: 500,
    modulePreload: {
      resolveDependencies(_filename, deps, { hostType }) {
        if (hostType !== 'html') return deps
        return deps.filter((dep) =>
          !/assets\/personaje3d-[^/]+\.js$/.test(dep) &&
          !/assets\/realtime-[^/]+\.js$/.test(dep) &&
          !/assets\/framer-[^/]+\.js$/.test(dep) &&
          !/assets\/sentry-[^/]+\.js$/.test(dep)
        )
      },
    },
    // Vendor chunks explícitos: sin esto Rolldown junta todo en index y
    // pasa de 150KB a 300KB+ gzip. Cada vendor se aísla en su propio
    // chunk para que se cachee long-term separado (cambios en código de
    // app no invalidan los vendor chunks). Budget objetivo: 250KB gzip.
    //   - lucide-react: ~150KB gzip si va en index, peso muerto en muchas
    //     páginas.
    //   - framer-motion: ~50KB gzip, lo usan rutas con animación.
    //   - i18n: ~30KB gzip (i18next + react-i18next + detector).
    //   - react vendor: react/react-dom/react-router-dom siempre cargado.
    rolldownOptions: {
      output: {
        // Code splitting explícito con umbral mínimo: conserva los vendors
        // grandes en chunks cacheables, pero evita que módulos pequeños de
        // app compartidos entre rutas (por ejemplo src/lib/api.js) salgan
        // como assets independientes en Cloudflare Pages.
        codeSplitting: {
          minSize: 20000,
          groups: [
            {
              name: 'app-runtime',
              minSize: 0,
              test: (id) =>
                id.endsWith('/src/lib/api.js') ||
                id.endsWith('\\src\\lib\\api.js') ||
                id.endsWith('/src/contexts/AuthContext.jsx') ||
                id.endsWith('\\src\\contexts\\AuthContext.jsx') ||
                id.endsWith('/src/hooks/useCatalogoPersonajes.js') ||
                id.endsWith('\\src\\hooks\\useCatalogoPersonajes.js') ||
                // La fachada de Sentry (lib/sentry + lib/consent) es un import
                // ESTÁTICO del entry (main.jsx); como chunk propio se llamaba
                // sentry-*.js y el filtro de modulePreload — pensado para el SDK
                // async — lo excluía del preload, añadiendo +1 RTT en serie en
                // cada carga. Metida en app-runtime (que sí se precarga); el SDK
                // real sigue siendo un import() dinámico aparte.
                id.endsWith('/src/lib/sentry.js') ||
                id.endsWith('\\src\\lib\\sentry.js') ||
                id.endsWith('/src/lib/consent.js') ||
                id.endsWith('\\src\\lib\\consent.js'),
            },
            {
              // Solo el vendor: src/lib/stomp.js queda FUERA del grupo para
              // que su import estático desde los hooks no arrastre el vendor
              // al arranque — stomp.js carga @stomp/stompjs con import()
              // dinámico en el primer subscribe, así que este chunk es async.
              name: 'realtime',
              minSize: 0,
              test: (id) => id.includes('@stomp/stompjs'),
            },
            {
              name: 'react-vendor',
              test: (id) =>
                id.includes('/react-router-dom/') ||
                id.includes('/react-router/') ||
                id.includes('/react-dom/') ||
                id.includes('/scheduler/') ||
                id.includes('\\scheduler\\') ||
                id.includes('/use-sync-external-store/') ||
                id.includes('\\use-sync-external-store\\') ||
                Boolean(id.match(/[/\\]node_modules[/\\]react[/\\]/)),
            },
            {
              name: 'personaje3d',
              test: (id) =>
                id.includes('@react-three/') ||
                id.includes('/three/') ||
                id.includes('\\three\\') ||
                id.includes('three-stdlib'),
            },
            {
              name: 'lucide',
              test: (id) => id.includes('lucide-react'),
            },
            {
              name: 'framer',
              test: (id) => id.includes('framer-motion'),
            },
            {
              name: 'i18n',
              test: (id) =>
                id.includes('i18next') ||
                id.includes('react-i18next'),
            },
            {
              // Sentry (~80-100KB gzip): solo se alcanza vía import() dinámico
              // (lib/sentry.js → initSentry en idle), así que este chunk es
              // async y NO entra en el bundle de entrada. Excluido también del
              // modulePreload arriba para no preloadear en el path crítico.
              name: 'sentry',
              test: (id) => id.includes('@sentry'),
            },
          ],
        },
      },
    },
  },
})
