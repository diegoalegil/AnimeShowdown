import { useCallback } from 'react'
import { toast } from 'sonner'
import { recordDailyShare } from '../../../lib/dailyProgress'
import { shareOrCopy } from '../../../lib/share'
import { shareWithToast } from '../../../lib/shareWithToast'

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

  return { handleChallenge, handleShareVote, handleShareSessionRecap }
}
