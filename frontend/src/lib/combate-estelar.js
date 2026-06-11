import { getStatsPersonaje } from './personajes-core'

/**
 * Selección del "Combate estelar" de la home: un duelo del día determinista
 * por día del año (mismo patrón que la rotación del arte del hero). Toda la
 * audiencia ve el mismo cartel y mañana habrá otro.
 *
 * <p>El pool es el top del catálogo por ELO base (estimación determinista de
 * personajes-core, etiquetada como tal en la UI) restringido a personajes con
 * arte promocionable — el cartel vive de los dos retratos a gran tamaño.
 *
 * <p>Sin Math.random: misma fecha + mismo catálogo → mismo par, lo que
 * mantiene estable el prerender y los e2e.
 */
const TAMANO_POOL = 30

function tieneArtePromocionable(p) {
  const imagen = p?.imagenUrl ?? p?.imagen
  return Boolean(
    imagen && !imagen.includes('/_missing/') && !imagen.includes('placeholder'),
  )
}

/**
 * Hash entero barato (mezcla multiplicativa de 32 bits, estilo lowbias32)
 * que descorrelaciona el cartel del índice del día. Con la selección lineal
 * anterior (pool[d % 30] + offset (7d+3) % 30) el retador recorría el top en
 * orden predecible y el par exacto se repetía cada 30 días; con el hash, el
 * retador salta por el pool y el ciclo del cartel pasa a ser el del propio
 * día del año. Determinista: mismo día → misma semilla.
 */
function hashDia(dia) {
  let h = dia >>> 0
  h = Math.imul(h ^ (h >>> 16), 0x21f0aaad)
  h = Math.imul(h ^ (h >>> 15), 0x735a2d97)
  return (h ^ (h >>> 15)) >>> 0
}

export function getCombateEstelarDelDia(catalogo, fecha = new Date()) {
  const pool = catalogo
    .filter((p) => p?.slug && p?.anime && tieneArtePromocionable(p))
    .map((p) => ({ ...p, ...getStatsPersonaje(p.slug) }))
    .sort((a, b) => b.elo - a.elo || a.slug.localeCompare(b.slug))
    .slice(0, TAMANO_POOL)
  if (pool.length < 2) return null

  const inicioDeAno = new Date(fecha.getFullYear(), 0, 0)
  const diaDelAno = Math.floor((fecha - inicioDeAno) / 86_400_000)
  const semilla = hashDia(diaDelAno)
  const retador = pool[semilla % pool.length]

  // El rival arranca en un offset independiente del retador (el siguiente
  // "dígito" en base pool.length de la misma semilla) y se salta a los
  // compañeros del mismo anime para que el duelo cruce universos.
  const inicio = Math.floor(semilla / pool.length) % pool.length
  let rival = null
  for (let i = 0; i < pool.length; i += 1) {
    const candidato = pool[(inicio + i) % pool.length]
    if (candidato.slug !== retador.slug && candidato.anime !== retador.anime) {
      rival = candidato
      break
    }
  }
  if (!rival) rival = pool.find((p) => p.slug !== retador.slug) ?? null
  if (!rival) return null

  return { retador, rival }
}
