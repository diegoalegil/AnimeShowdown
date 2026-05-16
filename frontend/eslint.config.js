import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
  // Override SEPARADO al final para que sobrescriba severities aplicadas
  // por reactHooks.configs.flat.recommended. Sin esto, poner rules en el
  // mismo bloque que extends no funciona — flat config aplica extends
  // tras las rules del propio bloque.
  {
    files: ['**/*.{js,jsx}'],
    rules: {
      // React Compiler reporta error si una librería de terceros devuelve
      // funciones que no se pueden memoizar (p.ej. react-hook-form's
      // watch()). El código funciona perfectamente; solo significa que el
      // compiler optimizer no puede tocar ese componente. Lo bajamos a
      // warning para no bloquear CI sobre algo que es solo informativo.
      'react-hooks/incompatible-library': 'warn',
    },
  },
])
