import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
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

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    imgFolderPlugin(),
    // criticalCssPlugin va al final con enforce:'post' para que Vite ya
    // haya emitido el HTML cuando lo procesamos.
    criticalCssPlugin(),
  ],
})
