// Reporting de Core Web Vitals.
//
// Captura CLS / INP / LCP / FCP / TTFB con la lib oficial 'web-vitals' y
// los envía a Sentry como measurements. En dev local sin DSN simplemente
// los logueamos en consola para inspección manual.
//
// Sampling: solo enviamos las métricas cuando el usuario abandona la
// página (visibilitychange / pagehide). Eso garantiza valores finales
// (sobre todo CLS que se acumula durante la sesión).

import { onCLS, onINP, onLCP, onFCP, onTTFB } from 'web-vitals'
import { Sentry } from './sentry.js'

/**
 * Convierte el name de la métrica a la unidad/categoría de Sentry.
 * Sentry acepta measurements arbitrarios pero estos nombres aparecen
 * formateados como "Core Web Vital" en la UI.
 */
const SENTRY_METRIC_NAME = {
  CLS: 'cls',
  INP: 'inp',
  LCP: 'lcp',
  FCP: 'fcp',
  TTFB: 'ttfb',
}

function reportar(metric) {
  // En dev sin DSN, solo console — útil para inspección manual con
  // Lighthouse / DevTools Performance.
  if (import.meta.env.DEV) {
    console.info(
      `[web-vitals] ${metric.name}=${metric.value.toFixed(2)} (rating=${metric.rating})`,
    )
  }

  // En prod (con DSN), enviamos a Sentry como measurement. Sentry agrega
  // estos valores en su panel "Performance" → "Web Vitals" por ruta.
  if (Sentry?.setMeasurement) {
    const sentryName = SENTRY_METRIC_NAME[metric.name] ?? metric.name.toLowerCase()
    const unit =
      metric.name === 'CLS' ? 'none' : 'millisecond'
    try {
      Sentry.setMeasurement(sentryName, metric.value, unit)
    } catch {
      /* Sentry no init, no-op */
    }
  }
}

/**
 * Activa la captura de las 5 métricas. Cada onX() registra un listener
 * que dispara `reportar` al final de la sesión (visibilitychange) o
 * cuando la métrica ya tiene un valor estable.
 */
export function initWebVitals() {
  onCLS(reportar)
  onINP(reportar)
  onLCP(reportar)
  onFCP(reportar)
  onTTFB(reportar)
}
