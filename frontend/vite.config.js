import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, join, basename } from 'node:path'
import { existsSync, statSync, readdirSync, copyFileSync, mkdirSync } from 'node:fs'
import { extname } from 'node:path'
import { createReadStream } from 'node:fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const IMG_SRC = resolve(__dirname, 'img')
const IMG_URL_PREFIX = '/img/'

// MIME types que sirve este middleware. Si en el futuro añades .png/.jpg en
// frontend/img/, basta con extender este mapa.
const MIME = {
  '.webp': 'image/webp',
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
      // eslint-disable-next-line no-console
      console.log(`[img-folder] copiadas ${copied} imágenes a ${basename(outDir)}/`)
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), imgFolderPlugin()],
})
