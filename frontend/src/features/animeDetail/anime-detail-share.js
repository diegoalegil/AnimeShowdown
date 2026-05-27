import { toast } from 'sonner'
import { recordDailyShare } from '../../lib/dailyProgress'
import { shareOrCopy } from '../../lib/share'

export async function shareAnimeRanking({ anime, slug, top10 }) {
  const resumen = top10
    .slice(0, 5)
    .map((personaje, index) => `${index + 1}. ${personaje.nombre} · ${personaje.elo} ELO base`)
    .join('\n')
  try {
    const result = await shareOrCopy({
      title: `Top personajes de ${anime}`,
      text: `Mi top 5 de ${anime} en AnimeShowdown:\n${resumen}\n\n¿A quién subirías votando?`,
      url: `/animes/${slug}`,
    })
    if (result === 'cancelled') return
    recordDailyShare()
    toast.success(result === 'native' ? 'Ranking compartido' : 'Ranking copiado')
  } catch (error) {
    toast.error('No se pudo compartir el ranking', {
      description: error?.message || 'Copia el enlace manualmente.',
    })
  }
}

export async function sharePersonalAnimeTop({ anime, slug, stats }) {
  const resumen = stats.top
    .slice(0, 5)
    .map((personaje, index) => `${index + 1}. ${personaje.nombre} x${personaje.count}`)
    .join('\n')
  try {
    const result = await shareOrCopy({
      title: `Mi top personal de ${anime}`,
      text: resumen
        ? `Mi top personal de ${anime} en AnimeShowdown:\n${resumen}\n\n¿A quién subirías tú?`
        : `Estoy creando mi top personal de ${anime} en AnimeShowdown. ¿A quién votarías tú?`,
      url: `/animes/${slug}`,
    })
    if (result === 'cancelled') return
    recordDailyShare()
    toast.success(result === 'native' ? 'Top personal compartido' : 'Top personal copiado')
  } catch (error) {
    toast.error('No se pudo compartir tu top', {
      description: error?.message || 'Copia el enlace manualmente.',
    })
  }
}

export async function shareFeaturedAnimeDuel({ anime, dueloDestacado }) {
  if (!dueloDestacado) return
  const [a, b] = dueloDestacado
  try {
    const result = await shareOrCopy({
      title: `${a.nombre} vs ${b.nombre}`,
      text: [
        `Duelo destacado de ${anime}: ${a.nombre} vs ${b.nombre}.`,
        `${a.nombre} lidera por ${Math.abs(a.elo - b.elo)} puntos de ELO base.`,
        '¿A quién subirías votando?',
      ].join('\n'),
      url: `/duelos/${a.slug}-vs-${b.slug}`,
    })
    if (result === 'cancelled') return
    recordDailyShare()
    toast.success(result === 'native' ? 'Duelo compartido' : 'Duelo copiado')
  } catch (error) {
    toast.error('No se pudo compartir el duelo', {
      description: error?.message || 'Copia el enlace manualmente.',
    })
  }
}
