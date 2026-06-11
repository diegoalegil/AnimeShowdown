// Selector para elementos focusables dentro de un modal. Cubre los casos
// estándar de WAI-ARIA: links con href, botones no disabled, inputs/select/
// textarea no disabled, [tabindex>=0] explícitos, y contenteditable.
// Compartido por los overlays modales (AccessibleDialog, CardShowcase) para
// que todos trapeen Tab igual.
export const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(',')
