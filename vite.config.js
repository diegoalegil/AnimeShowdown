import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// BASE_PATH lo fija el despliegue: "/" con dominio propio, "/<repo>/" en GitHub Pages.
const base = process.env.BASE_PATH || '/'

export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
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
