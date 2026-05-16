import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowUpRight } from 'lucide-react'
import NewsletterForm from './NewsletterForm'
import { personajes } from '../data/personajes'

function GithubIcon({ className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
    </svg>
  )
}

const navLinks = [
  { to: '/', i18nKey: 'inicio' },
  { to: '/personajes', i18nKey: 'personajes' },
  { to: '/torneos', i18nKey: 'torneos' },
  { to: '/votar', i18nKey: 'votar' },
  { to: '/ranking', i18nKey: 'ranking' },
  { to: '/faq', i18nKey: 'faq' },
  { to: '/api-docs', i18nKey: 'apiDocs' },
]

// Top 7 animes por cantidad de personajes en catálogo. Calculado en
// module load (estable, no cambia entre renders). Plan v2 §5.6: footer
// sitemap con anchor descriptivo para que el crawler siga los animes
// "estrella" en cada visita al footer (toda página los expone).
const topAnimes = (() => {
  const counts = {}
  personajes.forEach((p) => {
    counts[p.anime] = (counts[p.anime] || 0) + 1
  })
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 7)
})()

const techStack = [
  'React 19',
  'Vite 8',
  'Tailwind v4',
  'Framer Motion',
  'React Router 7',
  'Spring Boot 3',
  'Java 21',
  'PostgreSQL',
  'JWT',
]

function Footer() {
  const { t } = useTranslation()
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-12">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-4">
          <div className="flex flex-col gap-3">
            <Link to="/" className="flex items-center gap-3">
              <img
                src="/logo.webp"
                alt=""
                width={40}
                height={40}
                className="h-10 w-10 object-contain"
              />
              <span className="text-lg font-extrabold tracking-tight text-fg-strong">
                AnimeShowdown
              </span>
            </Link>
            <p className="max-w-xs text-[13px] leading-relaxed text-fg-muted">
              {t('footer.descripcion')}
            </p>
          </div>
          <div className="flex flex-col gap-4">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-fg-muted">
              {t('footer.newsletter')}
            </h3>
            <NewsletterForm />
          </div>
          <div className="flex flex-col gap-4">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-fg-muted">
              {t('footer.navegacion')}
            </h3>
            <nav className="flex flex-col gap-2">
              {navLinks.map(({ to, i18nKey }) => (
                <Link
                  key={to}
                  to={to}
                  className="w-fit text-[13px] text-fg transition-colors hover:text-accent"
                >
                  {t(`nav.${i18nKey}`)}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex flex-col gap-4">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-fg-muted">
              {t('footer.stack')}
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {techStack.map((tech) => (
                <span
                  key={tech}
                  className="inline-flex items-center rounded-md bg-surface-alt px-2 py-1 font-mono text-[11px] font-medium text-fg-muted"
                >
                  {tech}
                </span>
              ))}
            </div>
            <a
              href="https://github.com/diegoalegil/AnimeShowdown"
              target="_blank"
              rel="noreferrer"
              className="group inline-flex w-fit items-center gap-1.5 text-[13px] font-medium text-fg-strong transition-colors hover:text-accent"
            >
              <GithubIcon className="h-4 w-4" />
              {t('footer.verGithub')}
              <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </a>
          </div>
        </div>
        <div className="mt-10 flex flex-col gap-2 border-t border-border pt-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-fg-muted">
            Animes con más personajes
          </p>
          <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[12px]">
            {topAnimes.map(([anime, count]) => (
              <li key={anime}>
                <Link
                  to={`/personajes?anime=${encodeURIComponent(anime)}`}
                  className="text-fg-muted transition-colors hover:text-accent hover:underline"
                  title={`${count} personajes de ${anime} en AnimeShowdown`}
                >
                  {anime}{' '}
                  <span className="font-mono text-[10px] tabular-nums">
                    ({count})
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-6 flex flex-col items-center justify-between gap-2 border-t border-border pt-6 text-[12px] text-fg-muted sm:flex-row">
          <p>{t('footer.copyright')}</p>
          <p>
            {t('footer.hechoCon')} <span className="text-accent">♥</span>{' '}
            {t('footer.enTenerife')}
          </p>
        </div>
      </div>
    </footer>
  )
}

export default Footer
