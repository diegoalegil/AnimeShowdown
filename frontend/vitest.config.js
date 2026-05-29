import { defineConfig } from 'vitest/config'

// Configuración Vitest del Sprint Auto 06 (Test coverage 70%).
//
// Reglas que persisten más allá del sprint:
// - happy-dom es el environment por defecto (más rápido que jsdom y
//   suficiente para los tests de lib/* + componentes simples).
// - Globals: false. Importamos `describe/it/expect/vi` explícitamente
//   desde 'vitest'. Mantiene el codebase consistente con el resto del
//   stack TS estricto y no requiere tocar tsconfig.types.
// - Coverage v8 (no istanbul): aprovecha la instrumentación nativa de
//   V8, requiere cero plugins de babel.
// - Thresholds escalonados por fase del Sprint 06. Empiezan bajos
//   porque el PR 06.1 solo introduce la infra + smoke test.
//   Cada PR de Fase 2 (06.2-06.5) sube el threshold antes de mergear.
// - Include solo `src/lib/**/*.test.{ts,tsx}` por ahora. Los tests de
//   componentes React (Fase 5) ampliarán el patrón.

export default defineConfig({
  // Runtime JSX automático en los tests, igual que el build de la app
  // (@vitejs/plugin-react). Sin esto, esbuild transforma el JSX con el runtime
  // clásico y los tests de componente (.test.tsx) fallan con "React is not
  // defined" al renderizar componentes que no importan React explícitamente.
  esbuild: { jsx: 'automatic' },
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
      include: ['src/lib/**/*.{ts,tsx}'],
      exclude: [
        'src/lib/**/*.test.{ts,tsx}',
        'src/lib/types.ts',
      ],
      // Thresholds escalonados por PR del Sprint Auto 06:
      //   PR 06.1 (infra + smoke):           0% baseline
      //   PR 06.2 (share/queryClient):       lines 5%, branches 85%
      //   PR 06.3 (localVoteRanking/games):  lines 25, branches 20  ← aquí
      //   PR 06.4 (personajes-core/torneos): lines 45, branches 35
      //   PR 06.5 (api.ts):                  lines 70, branches 60  ← meta
      // Cada PR sube estos valores ANTES de mergear. Si CI falla por
      // threshold, el PR no llegó a la meta de su fase.
      // PR 06.5 thresholds (calibrated to real measured coverage after api.ts tests):
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