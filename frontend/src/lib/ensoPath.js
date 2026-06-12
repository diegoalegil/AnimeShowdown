/**
 * ensoPath — el ensō de la racha de sesión, como dato.
 *
 * UN solo path (criterio 4 del encargo): círculo de pincel irregular con
 * boca abierta arriba-izquierda (~20°), construido con 4 cúbicas cuyo
 * radio ondula entre 46 y 49 sobre un viewBox de 120×120 centrado en
 * (60,60). Se traza con stroke-dasharray + stroke-dashoffset usando
 * pathLength="1" — nunca se genera SVG por frame.
 *
 * El doble trazo del hito 50 es ESTE MISMO path rotado 11° desde el
 * componente (transform="rotate(11 60 60)"), no un segundo dibujo.
 *
 * Destino en el repo: frontend/src/lib/ensoPath.js
 */

export const ENSO_VIEWBOX = '0 0 120 120'

export const ENSO_PATH =
  'M 60 13 ' +
  'C 85.96 13 109 32.94 109 60 ' +
  'C 109 87.06 86.23 107.5 60 107.5 ' +
  'C 33.77 107.5 14 85.41 14 60 ' +
  'C 14 40.66 24.64 21.8 43.6 14.9'
