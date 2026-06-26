import { useCallback, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { recordDailyShare } from '../../../lib/dailyProgress'
import { track, FUNNEL_EVENTS } from '../../../lib/analytics'
import { imagenPersonaje } from '../../../lib/personajes-core'
import { shareOrCopy } from '../../../lib/share'
import { shareWithToast } from '../../../lib/shareWithToast'

// Variante -600 del arte del catálogo (la convención de PersonajeImg):
// suficiente para una card de 1080 y la mitad de bytes que el original.
function imagen600(slug) {
  const src = imagenPersonaje(slug)
  if (!src || !/\.webp$/i.test(src)) return src
  return src.replace(/(?:-(?:300|600|1024))?\.webp$/i, '-600.webp')
}

/**
 * Acciones de compartir de la arena: retar con el duelo actual, compartir
 * el resultado del voto y el recap de sesión. Solo leen estado — sin refs
 * compartidas con el flujo de voto.
 */
export function useVotarShare({
  a,
  b,
  votedPersonaje,
  losingPersonaje,
  voteResult,
  personalVoteImpact,
  sessionStats,
  fixedSlug,
  fixedAnime,
}) {
  // "Reta a un amigo": comparte el duelo ACTUAL (a vs b) sin revelar tu voto,
  // para que el receptor aterrice votando ese mismo duelo. El middleware OG
  // pinta la card de duelo (/api/og/duelo/a/vs/b.png) en la preview social.
  const handleChallenge = useCallback(() => {
    if (!a?.slug || !b?.slug) return undefined
    // Embudo: gesto de compartir (semilla del loop viral).
    track(FUNNEL_EVENTS.SHARE_CLICK)
    return shareWithToast(
      {
        title: `Reto: ${a.nombre} vs ${b.nombre}`,
        text: `Te reto a este duelo en AnimeShowdown: ${a.nombre} (${a.anime}) vs ${b.nombre} (${b.anime}). ¿A quién subes tú?`,
        url: `/votar?personaje=${encodeURIComponent(a.slug)}&rival=${encodeURIComponent(b.slug)}`,
      },
      {
        nativeSuccess: 'Reto enviado',
        clipboardSuccess: 'Enlace de reto copiado',
        errorTitle: 'No se pudo compartir el reto',
      },
    )
  }, [a, b])

  const handleShareVote = useCallback(async () => {
    if (!votedPersonaje) return
    // Embudo: gesto de compartir el resultado del voto (semilla del loop viral).
    track(FUNNEL_EVENTS.SHARE_CLICK)
    const personalLine = personalVoteImpact?.slug === votedPersonaje.slug
      ? `En mi ranking personal va #${personalVoteImpact.rank} con ${personalVoteImpact.count} votos míos.`
      : ''
    const baseShareText =
      sessionStats.lastShareText ||
      `Voté por ${votedPersonaje.nombre} en AnimeShowdown. ¿Tú a quién elegirías?`
    const text = [baseShareText, personalLine].filter(Boolean).join('\n')
    try {
      const result = await shareOrCopy({
        title: `${votedPersonaje.nombre} ganó mi duelo`,
        text,
        url: losingPersonaje?.slug
          ? `/votar?personaje=${encodeURIComponent(votedPersonaje.slug)}&rival=${encodeURIComponent(losingPersonaje.slug)}`
          : `/votar${
              fixedSlug
                ? `?personaje=${encodeURIComponent(fixedSlug)}`
                : fixedAnime
                  ? `?anime=${encodeURIComponent(fixedAnime)}`
                  : ''
            }`,
      })
      if (result === 'cancelled') return
      recordDailyShare()
      toast.success(result === 'native' ? 'Reto enviado' : 'Enlace de reto copiado')
    } catch (error) {
      toast.error('No se pudo compartir el reto', {
        description: error?.message || 'Copia el resultado manualmente.',
      })
    }
  }, [fixedAnime, fixedSlug, losingPersonaje, personalVoteImpact, sessionStats.lastShareText, votedPersonaje])

  // Card 1080×1080 del resultado pintada en canvas (duel-share-card.js,
  // cargado con import() para no meter el pintor en el chunk de la arena).
  // El PINTOR no cambia (drawDuelShareCard/loadDuelImages/resolveDuelTheme):
  // se envuelve como painter ()=>Promise<Blob> para la hoja de impresión
  // (PressSheet), que ahora orquesta el preview + native/X/WhatsApp/copy/
  // descargar. recordDailyShare cuelga del onShared de la hoja.
  const [dueloShareOpen, setDueloShareOpen] = useState(false)

  // Painter re-invocable: pinta la card 1080×1080 en un canvas offscreen con
  // el mismo módulo y resuelve el PNG. PressSheet lo reintenta bajo demanda.
  const pintarDueloBlob = useCallback(async () => {
    if (!votedPersonaje || !losingPersonaje) {
      throw new Error('Faltan los personajes del duelo.')
    }
    const votosGanador = voteResult?.votosGanador
    const votosPerdedor = voteResult?.votosPerdedor
    const { DUEL_CARD_SIZE, drawDuelShareCard, loadDuelImages, resolveDuelTheme } =
      await import('../duel-share-card')
    const total = (votosGanador ?? 0) + (votosPerdedor ?? 0)
    const duel = {
      left: {
        name: votedPersonaje.nombre,
        anime: votedPersonaje.anime,
        image: imagen600(votedPersonaje.slug),
      },
      right: {
        name: losingPersonaje.nombre,
        anime: losingPersonaje.anime,
        image: imagen600(losingPersonaje.slug),
      },
      // Sin totales del backend (modo casual): 51/49 simbólico para que
      // el oro caiga del lado votado sin inventar una paliza.
      leftPct: total > 0 ? (votosGanador / total) * 100 : 51,
    }
    const canvas = document.createElement('canvas')
    canvas.width = DUEL_CARD_SIZE
    canvas.height = DUEL_CARD_SIZE
    const ctx = canvas.getContext('2d')
    const images = await loadDuelImages(duel)
    drawDuelShareCard(ctx, duel, { images, theme: resolveDuelTheme(canvas) })
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('No se pudo generar el PNG'))),
        'image/png',
      )
    })
  }, [losingPersonaje, voteResult, votedPersonaje])

  // Contexto del share del duelo (mismo título/texto/URL/fileName que antes).
  const dueloContexto = useMemo(() => {
    if (!votedPersonaje || !losingPersonaje) return null
    return {
      titulo: `${votedPersonaje.nombre} ganó mi duelo`,
      texto: `${votedPersonaje.nombre} vs ${losingPersonaje.nombre} en AnimeShowdown. ¿Tú a quién subes?`,
      url: `/votar?personaje=${encodeURIComponent(votedPersonaje.slug)}&rival=${encodeURIComponent(losingPersonaje.slug)}`,
      alt: `Duelo: ${votedPersonaje.nombre} contra ${losingPersonaje.nombre}, con ${votedPersonaje.nombre} como ganador`,
      fileName: `animeshowdown-${votedPersonaje.slug}-vs-${losingPersonaje.slug}.png`,
      dims: [1080, 1080],
    }
  }, [losingPersonaje, votedPersonaje])

  // Abre la hoja de impresión para la card del duelo.
  const handleShareResultImage = useCallback(() => {
    if (!votedPersonaje || !losingPersonaje) return
    // Embudo: gesto de compartir la imagen del duelo (semilla del loop viral).
    track(FUNNEL_EVENTS.SHARE_CLICK)
    setDueloShareOpen(true)
  }, [losingPersonaje, votedPersonaje])

  const closeDueloShare = useCallback(() => setDueloShareOpen(false), [])
  const onDueloShared = useCallback(() => recordDailyShare(), [])

  const handleShareSessionRecap = useCallback(async () => {
    if (sessionStats.total <= 0) return
    // Embudo: gesto de compartir el recap de sesión (semilla del loop viral).
    track(FUNNEL_EVENTS.SHARE_CLICK)
    const top = Object.values(sessionStats.bySlug || {})
      .sort((x, y) => y.count - x.count)
      .slice(0, 5)
      .map((p, index) => `${index + 1}. ${p.nombre} (${p.anime}) · x${p.count}`)
      .join('\n')
    const text = [
      `Llevo ${sessionStats.total} votos en AnimeShowdown hoy.`,
      top ? `Mi top de la sesión:\n${top}` : null,
      sessionStats.closeDuels > 0
        ? `${sessionStats.closeDuels} duelos estuvieron a 1 voto o menos.`
        : 'Todavía estoy buscando el duelo más polémico.',
      '¿A quién defenderías tú?',
    ].filter(Boolean).join('\n')
    try {
      const result = await shareOrCopy({
        title: 'Mi recap de votos anime',
        text,
        url: '/mi-ranking',
      })
      if (result === 'cancelled') return
      recordDailyShare()
      toast.success(result === 'native' ? 'Recap compartido' : 'Recap copiado')
    } catch (error) {
      toast.error('No se pudo compartir el recap', {
        description: error?.message || 'Copia tu resumen manualmente.',
      })
    }
  }, [sessionStats])

  return {
    handleChallenge,
    handleShareVote,
    handleShareSessionRecap,
    handleShareResultImage,
    // Estado/datos de la hoja de impresión del duelo (la consume VotarPage).
    dueloShareOpen,
    closeDueloShare,
    pintarDueloBlob,
    dueloContexto,
    onDueloShared,
  }
}
