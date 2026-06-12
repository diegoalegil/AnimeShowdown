import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { usePersonajesCatalogo } from '../hooks/usePersonajesCatalogo'
import { slugifyAnime } from '../lib/animes'

/* Animes con más roster, para el cierre del colofón. Vivía dentro de
   Footer.jsx; extraído al retirarse aquel a favor de FederationColophon. */
function getTopAnimes(personajes) {
  const counts = {}
  personajes.forEach((p) => {
    counts[p.anime] = (counts[p.anime] || 0) + 1
  })
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 7)
}

function FooterTopAnimes() {
  const { t } = useTranslation()
  const { personajes } = usePersonajesCatalogo()
  const topAnimes = useMemo(() => getTopAnimes(personajes), [personajes])

  if (topAnimes.length === 0) return null

  return (
    <div className="mt-10 flex flex-col gap-2 border-t border-border pt-6">
      <p className="text-xs font-semibold text-fg-muted">
        {t('footer.animesPopulares')}
      </p>
      <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[12px]">
        {topAnimes.map(([anime, count]) => (
          <li key={anime}>
            <Link
              to={`/animes/${slugifyAnime(anime)}`}
              className="text-fg-muted transition-colors hover:text-gold hover:underline"
              title={`Ranking interno y roster de ${anime} (${count} personajes)`}
            >
              {anime}{' '}
              <span className="font-mono text-[11px] tabular-nums">
                ({count})
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default FooterTopAnimes
