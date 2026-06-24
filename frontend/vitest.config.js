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
      // all:true + include de TODO src — el gate mide la superficie real del
      // producto, no un puñado de ficheros. Antes (all:false + include de ~7
      // rutas) el porcentaje era honesto solo para esos 7 archivos y daba una
      // falsa sensación de cobertura global. Ahora cuenta cada .js/jsx/ts/tsx
      // de src (menos tests, specs, helpers de test y tipos puros).
      all: true,
      include: ['src/**/*.{js,jsx,ts,tsx}'],
      exclude: [
        'src/**/*.test.{js,jsx,ts,tsx}',
        'src/**/*.spec.{js,jsx,ts,tsx}',
        'src/test/**',
        'src/lib/types.ts',
      ],
      // Thresholds calibrados contra la cobertura real de TODO src (no de 7
      // ficheros): medición real lines 37.93% / statements 36.83% /
      // branches 33.96% / functions 34.43%, menos ~4-5 puntos de margen
      // defensivo (variación CI/local + cambios que no tocan unidades
      // instrumentadas). Honesto y protege regresiones sobre la superficie real.
      thresholds: {
        lines: 33,
        statements: 32,
        branches: 29,
        functions: 30,
      },
    },
  },
})
