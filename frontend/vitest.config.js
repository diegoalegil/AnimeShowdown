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
      // PR 06.4 thresholds (calibrados a cobertura real medida):
      //   personajes-core.ts: 100% lines / 95.7% branches / 100% funcs
      //   torneosQueries.ts:  42.4% lines / 100% branches / 25% funcs (parcial — solo badges)
      //   games + localVoteRanking + share + queryClient: cubiertos en PRs previos
      //   api.ts: 25.5% lines / 1.78% funcs (sin testear aún — es el PR 06.5)
      // Global real: stmts 60.7% / branch 88.7% / funcs 31.1% / lines 60.7%.
      // functions queda bajo porque api.ts (769 LOC, muchas funcs) entra en 06.5.
      // Thresholds con margen defensivo sobre la realidad para no romper por
      // fluctuaciones del cálculo de v8. PR 06.5 los sube hacia 70/60.
      thresholds: {
        lines: 55,
        statements: 55,
        branches: 80,
        functions: 25,
      },
    },
  },
})