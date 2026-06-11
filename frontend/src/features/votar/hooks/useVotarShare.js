import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { recordDailyShare } from '../../../lib/dailyProgress'
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
  // Comparte el PNG como archivo si el dispositivo lo soporta (Web Share
  // Level 2); si no, lo descarga y copia el texto+enlace del reto.
  const [generandoCard, setGenerandoCard] = useState(false)
  const handleShareResultImage = useCallback(async () => {
    if (!votedPersonaje || !losingPersonaje) return
    const votosGanador = voteResult?.votosGanador
    const votosPerdedor = voteResult?.votosPerdedor
    setGenerandoCard(true)
    try {
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
      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error('No se pudo generar el PNG'))),
          'image/png',
        )
      })
      const nombreFichero = `animeshowdown-${votedPersonaje.slug}-vs-${losingPersonaje.slug}.png`
      const url = `/votar?personaje=${encodeURIComponent(votedPersonaje.slug)}&rival=${encodeURIComponent(losingPersonaje.slug)}`
      const file = typeof File !== 'undefined'
        ? new File([blob], nombreFichero, { type: 'image/png' })
        : null
      const payload = file
        ? {
            title: `${votedPersonaje.nombre} ganó mi duelo`,
            text: `${votedPersonaje.nombre} vs ${losingPersonaje.nombre} en AnimeShowdown. ¿Tú a quién subes?`,
            url: new URL(url, window.location.origin).toString(),
            files: [file],
          }
        : null
      if (
        payload &&
        navigator.share &&
        (!navigator.canShare || navigator.canShare({ files: [file] }))
      ) {
        try {
          await navigator.share(payload)
          recordDailyShare()
          toast.success('Card del duelo compartida')
          return
        } catch (error) {
          if (error?.name === 'AbortError') return
          // Si el share nativo falla por otra causa, caemos a la descarga.
        }
      }
      const enlace = document.createElement('a')
      enlace.href = URL.createObjectURL(blob)
      enlace.download = nombreFichero
      document.body.appendChild(enlace)
      enlace.click()
      enlace.remove()
      URL.revokeObjectURL(enlace.href)
      recordDailyShare()
      toast.success('Card descargada', {
        description: 'Adjúntala donde quieras presumir del duelo.',
      })
    } catch (error) {
      toast.error('No se pudo generar la card', {
        description: error?.message || 'Inténtalo otra vez.',
      })
    } finally {
      setGenerandoCard(false)
    }
  }, [losingPersonaje, voteResult, votedPersonaje])

  const handleShareSessionRecap = useCallback(async () => {
    if (sessionStats.total <= 0) return
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
    generandoCard,
  }
}
