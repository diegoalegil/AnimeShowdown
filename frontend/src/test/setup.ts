// Vitest setup file — corre antes de cada test suite.
//
// Mantener esto MÍNIMO. Cualquier mock global rompe encapsulación de
// tests. Los mocks específicos van en cada *.test.ts con `vi.mock()`.

import '@testing-library/jest-dom/vitest'
