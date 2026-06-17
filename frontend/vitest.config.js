import { defineConfig } from 'vitest/config'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Configuración Vitest para tests unitarios y cobertura.
//
// Reglas que persisten más allá del sprint:
// - happy-dom es el environment por defecto (más rápido que jsdom y
//   suficiente para los tests de lib/* + componentes simples).
// - Globals: false. Importamos `describe/it/expect/vi` explícitamente
//   desde 'vitest'. Mantiene el codebase consistente con el resto del
//   stack TS estricto y no requiere tocar tsconfig.types.
// - Coverage v8 (no istanbul): aprovecha la instrumentación nativa de
//   V8, requiere cero plugins de babel.
// - Thresholds conservadores: protegen la cobertura actual sin bloquear
//   cambios que no tocan las unidades instrumentadas.
// - Coverage incluye las unidades productivas con cobertura unitaria actual:
//   lib, data, hooks, componentes y features. Tests, setup y tipos puros
//   quedan fuera de la métrica.

export default defineConfig({
  // vitest 4 transforma el JSX con oxc (runtime automático por defecto), así que
  // ya NO hace falta el antiguo `esbuild: { jsx: 'automatic' }` — v4 lo ignoraba
  // con warning ("Both esbuild and oxc options were set"). Los tests de
  // componente (.test.tsx) siguen renderizando sin importar React explícito.
  // Espejo del alias de vite.config.js: 'sonner' resuelve a DispatchToast.
  // Los tests con vi.mock('sonner') siguen interceptando por especificador.
  resolve: {
    alias: {
      sonner: resolve(__dirname, 'src/components/DispatchToast.jsx'),
    },
  },
  test: {
    environment: 'happy-dom',
    setupFiles: ['./src/test/setup.ts'],
    globals: false,
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: [
      'node_modules/**',
      'dist/**',
      'e2e/**',
      '**/*.spec.{js,ts}',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      all: false,
      include: [
        'src/lib/**/*.{ts,tsx}',
        'src/lib/username-suggestions.js',
        'src/data/voto-intenciones.js',
        'src/hooks/useRanking.js',
        'src/components/ProfileBanner.jsx',
        'src/components/RequireCatalog.jsx',
        'src/features/votar/components/IntencionSelector.jsx',
      ],
      exclude: [
        'src/**/*.test.{js,jsx,ts,tsx}',
        'src/**/*.spec.{js,jsx,ts,tsx}',
        'src/test/**',
        'src/lib/types.ts',
      ],
      // Thresholds calibrados contra la cobertura real medida — misma
      // metodología de siempre (real menos ~5 puntos de margen defensivo),
      // RECALIBRADA para vitest 4: v4 mide con oxc una superficie más amplia que
      // v3 (cuenta más ficheros de coverage.include aunque no estén importados),
      // así que las cifras globales bajan respecto a v3. Medición real v4:
      // lines 77.74% / statements 76.96% / branches 69.07% / functions 59.38%.
      // El gate sigue protegiendo regresiones, ahora sobre la superficie real.
      thresholds: {
        lines: 72,
        statements: 72,
        branches: 64,
        functions: 54,
      },
    },
  },
})
