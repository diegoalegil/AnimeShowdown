import { lazy } from 'react'
import SakuraPetals from './SakuraPetals'

/**
 * Registro data-driven de capas estacionales — módulo hermano de
 * SeasonalLayer (fast-refresh) y testeable sin montar React.
 *
 * <p>Generaliza el patrón del hanami (gate por fechas + kill-switch de
 * localStorage) a un registro único. Añadir una temporada nueva = añadir
 * una entrada a {@link SEASONAL_EVENTS}; App.jsx no cambia.
 *
 * <p>Gates, en orden: kill global ({@code animeshowdown.seasonal='off'}),
 * kill/force por evento ({@code <storageKey>='off'|'on'}), ventana de
 * fechas (con soporte de cruce de año) y discreción por ruta.
 *
 * <p>Perf: las capas nuevas entran SIEMPRE con import() dinámico — fuera
 * de su ventana no aportan ni un byte al bundle inicial. El hanami se
 * queda estático por ser ya parte del bundle; migrarlo a lazy es un
 * follow-up seguro.
 */

const TanabataTanzaku = lazy(() => import('./TanabataTanzaku'))
// Slots futuros — misma forma, mismo gate. Implementarlos = descomentar:
// const TsukimiSusuki = lazy(() => import('./TsukimiSusuki'))
// const AnioNuevoKadomatsu = lazy(() => import('./AnioNuevoKadomatsu'))

export const GLOBAL_KILL_KEY = 'animeshowdown.seasonal'

/** Predicado de rutas: la capa puede vivir en toda la app (hanami legacy). */
export function rutasTodas() {
  return true
}

/**
 * Predicado de rutas "calmas": home + catálogos. Nunca flujos de voto,
 * duelos, juegos ni torneos — ahí la atención del usuario es sagrada.
 */
export function rutasCalmas(pathname) {
  return (
    pathname === '/' ||
    pathname === '/personajes' ||
    pathname.startsWith('/personajes/') ||
    pathname === '/animes' ||
    pathname.startsWith('/animes/')
  )
}

/**
 * Registro de temporadas. Meses 0-indexed (como Date#getMonth), igual que
 * el dentroDeHanami original para no introducir dos convenciones.
 */
export const SEASONAL_EVENTS = [
  {
    id: 'hanami',
    // Clave legacy respetada: los overrides existentes de usuarios siguen
    // funcionando tras la migración al registro.
    storageKey: 'animeshowdown.sakura',
    ventana: { desde: [2, 15], hasta: [3, 15] }, // 15 mar – 15 abr
    rutas: rutasTodas,
    Component: SakuraPetals,
    lazyBoundary: false,
  },
  {
    id: 'tanabata',
    storageKey: 'animeshowdown.tanabata',
    ventana: { desde: [6, 1], hasta: [6, 7] }, // 1 – 7 jul
    rutas: rutasCalmas,
    Component: TanabataTanzaku,
    lazyBoundary: true,
  },
  {
    id: 'tsukimi',
    storageKey: 'animeshowdown.tsukimi',
    // Placeholder: ajustar cada año a la semana de la luna llena de otoño.
    ventana: { desde: [9, 1], hasta: [9, 8] }, // 1 – 8 oct
    rutas: rutasCalmas,
    Component: null, // slot listo — pendiente TsukimiSusuki
    lazyBoundary: true,
  },
  {
    id: 'anio-nuevo',
    storageKey: 'animeshowdown.anio-nuevo',
    ventana: { desde: [11, 28], hasta: [0, 7] }, // 28 dic – 7 ene (cruza el año)
    rutas: rutasCalmas,
    Component: null, // slot listo — pendiente AnioNuevoKadomatsu
    lazyBoundary: true,
  },
]

/**
 * ¿Está la fecha dentro de la ventana? Soporta ventanas que cruzan el
 * cambio de año comparando claves mes*100+día.
 */
export function dentroDeVentana(ventana, date = new Date()) {
  const ahora = date.getMonth() * 100 + date.getDate()
  const desde = ventana.desde[0] * 100 + ventana.desde[1]
  const hasta = ventana.hasta[0] * 100 + ventana.hasta[1]
  if (desde <= hasta) return ahora >= desde && ahora <= hasta
  return ahora >= desde || ahora <= hasta
}

function leerOverride(key) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

/** Gate completo de un evento. */
export function eventoVisible(evento, pathname, date = new Date()) {
  if (!evento.Component) return false
  if (leerOverride(GLOBAL_KILL_KEY) === 'off') return false
  const override = leerOverride(evento.storageKey)
  if (override === 'off') return false
  if (override !== 'on' && !dentroDeVentana(evento.ventana, date)) return false
  return evento.rutas(pathname)
}
