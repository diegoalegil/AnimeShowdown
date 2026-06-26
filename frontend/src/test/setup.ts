// Vitest setup file — corre antes de cada test suite.
//
// Mantener esto MÍNIMO. Cualquier mock global rompe encapsulación de
// tests. Los mocks específicos van en cada *.test.ts con `vi.mock()`.

import '@testing-library/jest-dom/vitest'
import { MotionGlobalConfig } from 'framer-motion'

// Desactiva el frameloop de animación de framer-motion en tests: las
// animaciones renderizan su estado final al instante. Esto elimina el flake
// "ReferenceError: window is not defined" que saltaba como unhandled error tras
// el teardown del entorno bajo coverage (un requestAnimationFrame de framer
// disparándose después de destruir jsdom). No toca `useReducedMotion` (lee
// matchMedia) ni la lógica de los componentes — los tests asertan DOM/estado,
// no la animación — y hace los renders más deterministas.
MotionGlobalConfig.skipAnimations = true

// Neutraliza navigator.sendBeacon en tests. happy-dom lo implementa haciendo
// una petición de red REAL, así que un track() de embudo disparado por
// cualquier componente (home, registro, compartir) intenta golpear el API de
// producción y emite un "unhandled error" de TLS tras el test — no rompe los
// asserts, pero ensucia el run y puede tumbar CI. Como skipAnimations arriba,
// es una neutralización de API de navegador (no un mock de dominio) para matar
// errores no controlados. analytics.test.ts redefine sendBeacon por test para
// asertar el envío real del beacon.
Object.defineProperty(navigator, 'sendBeacon', {
  value: () => true,
  configurable: true,
  writable: true,
})
