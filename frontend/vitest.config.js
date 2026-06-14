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
  // Runtime JSX automático en los tests, igual que el build de la app
  // (@vitejs/plugin-react). Sin esto, esbuild transforma el JSX con el runtime
  // clásico y los tests de componente (.test.tsx) fallan con "React is not
  // defined" al renderizar componentes que no importan React explícitamente.
  esbuild: { jsx: 'automatic' },
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
      // Thresholds calibrados contra la cobertura real medida tras los tests
      // de api.ts:
      // Global real: lines 85.76% / statements 85.76% / branches 88.25% / functions 49.71%.
      // api.ts: lines 78.59% / branches 84.74% / functions 30.83% (many small endpoint-factory
      // functions that need a full React context tree to exercise).
      // Thresholds = real minus 5-point defensive margin.
      thresholds: {
        lines: 80,
        statements: 80,
        branches: 83,
        functions: 44,
      },
    },
  },
})
