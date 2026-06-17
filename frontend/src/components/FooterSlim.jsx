import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

/**
 * Footer minimal para páginas internas. El footer completo (marca, newsletter,
 * 20+ enlaces, top-animes y CTA de cierre) se reserva para la home como remate
 * de landing; en páginas internas resultaba demasiado pesado y repetitivo.
 *
 * En el resto de páginas dejamos solo lo imprescindible: marca, enlaces LEGALES
 * (privacidad/términos/DMCA deben seguir alcanzables en toda la web, no solo en
 * la home) y copyright. Una franja delgada, sin las capas atmosféricas pesadas
 * del footer completo.
 */
function FooterSlim() {
  const { t } = useTranslation()

  // Atajos de PRODUCTO de vuelta al loop: un visitante SEO que aterriza en una
  // página interna necesita un camino claro a votar / explorar / jugar, no solo
  // los enlaces legales. Reutilizan las claves nav.* ya existentes.
  const producto = [
    { to: '/votar', label: t('nav.votar') },
    { to: '/personajes', label: t('nav.personajes') },
    { to: '/ranking', label: t('nav.ranking') },
    { to: '/games', label: t('nav.games') },
  ]

  return (
    <footer className="border-t border-white/10 bg-bg/95">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 px-5 py-5 sm:px-8">
        <nav
          aria-label={t('footer.producto')}
          className="-mx-2 flex flex-wrap items-center justify-center gap-y-1 text-[13px]"
        >
          {producto.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="inline-flex min-h-11 items-center px-3 font-semibold text-fg-muted transition-colors hover:text-gold"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="border-t border-white/5">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-5 py-6 text-[12px] text-fg-muted sm:flex-row sm:px-8">
        <Link to="/" className="inline-flex items-center gap-2">
          <img
            src="/logo.webp"
            alt=""
            width={24}
            height={24}
            className="h-6 w-6 object-contain"
          />
          <span className="font-bold text-fg-strong">AnimeShowdown</span>
        </Link>
        <ul className="-mx-2 flex flex-wrap items-center justify-center gap-y-1">
          <li>
            <Link
              to="/privacidad"
              className="inline-flex min-h-11 items-center px-2 hover:text-gold hover:underline"
            >
              {t('footer.privacidad')}
            </Link>
          </li>
          <li>
            <Link
              to="/terminos"
              className="inline-flex min-h-11 items-center px-2 hover:text-gold hover:underline"
            >
              {t('footer.terminos')}
            </Link>
          </li>
          <li>
            <Link
              to="/dmca"
              className="inline-flex min-h-11 items-center px-2 hover:text-gold hover:underline"
            >
              DMCA
            </Link>
          </li>
        </ul>
        <p>{t('footer.copyright')}</p>
      </div>
      </div>
    </footer>
  )
}

export default FooterSlim
