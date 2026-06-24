import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChevronDown, LogOut, Menu, Search, Shield, Shuffle, Swords, Volume2, VolumeX, X } from 'lucide-react'
import { AppLink, AppNavLink } from './AppLink'
import { useAuth } from '../contexts/AuthContext'
import { useSound } from '../contexts/SoundContext'
import Avatar from './Avatar'
import LanguageToggle from './LanguageToggle'
import CalmLantern from './CalmLantern'
import NotifBell from './NotifBell'
import SaldoChip from './SaldoChip'
import { useInstantSoundPress } from '../hooks/useInstantSoundPress'
import { usePersonajeRuleta } from '../hooks/usePersonajeRuleta'
import { OPEN_COMMAND_PALETTE_EVENT } from './CommandPaletteLazyMount'
import { registerRitoAvatarTarget, unregisterRitoAvatarTarget } from '../lib/viewTransitions'
import {
  NavInkRail,
  NorenMobileMenu,
  NorenTablilla,
  PaperDropdown,
} from './HeaderStandards'
import { useCondensedHeader } from '../hooks/useHeaderStandards'
import './header-standards.css'

// Destino del morph del rito de acuñación (registro → home): la placa del
// nuevo luchador vuela hasta el avatar del header. Hay dos avatares (cluster
// móvil y UserBadge desktop) y el CSS decide cuál se ve, así que se registran
// ambos y el morph elige el visible en el momento de salir.
function RitoAvatarTarget({ children }) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return undefined
    registerRitoAvatarTarget(el)
    return () => unregisterRitoAvatarTarget(el)
  }, [])
  return (
    <span ref={ref} className="inline-flex rounded-full">
      {children}
    </span>
  )
}

// Nota de producto: /votar sale de los enlaces regulares y pasa a
// CTA principal del header. El login deja de ser el botón accent (estaba
// pidiendo a un usuario nuevo registrarse antes de aportar valor) y
// queda como link ghost discreto: ahora la primera acción visible es
// participar (votar) y el login es secundario para usuarios existentes.
// Inicio se quita del nav (el logo ya lleva a home) y los enlaces
// secundarios (Eventos, PvP) se agrupan en un menú "Más", para que los
// principales quepan en una fila desde lg sin saturar el header.
const primaryNavLinks = [
  { to: '/personajes', i18nKey: 'personajes' },
  { to: '/cartas', i18nKey: 'cartas' },
  { to: '/torneos', i18nKey: 'torneos' },
  { to: '/games', i18nKey: 'games' },
  { to: '/ranking', i18nKey: 'ranking' },
]
const moreNavLinks = [
  { to: '/animes', i18nKey: 'animes' },
  { to: '/especiales', i18nKey: 'especiales' },
  { to: '/tier-lists', i18nKey: 'tierLists' },
  { to: '/fantasy', i18nKey: 'fantasy' },
  { to: '/feed', i18nKey: 'feed' },
  { to: '/eventos', i18nKey: 'eventos' },
  { to: '/duel-live', i18nKey: 'pvp' },
]

const navLinkBase = 'relative rounded-lg px-3 py-2 text-sm transition-colors'

// Estado activo: la gota de tinta (NavInkRail) reemplaza el subrayado
// decoration-accent del nav desktop; conservamos el peso/fondo y el
// aria-current lo aporta NavLink. El subrayado del panel móvil no cambia.
function regularLinkClass({ isActive }) {
  return `${navLinkBase} font-medium ${
    isActive
      ? 'bg-white/5 font-bold text-fg-strong shadow-aura'
      : 'text-fg hover:bg-white/5 hover:text-fg-strong'
  }`
}

// CTA principal de torneo: carmesí fijo + brillo dorado muy controlado.
function ctaVotarClass({ isActive }) {
  return `${navLinkBase} ml-2 inline-flex items-center gap-1.5 whitespace-nowrap border border-accent/50 bg-gradient-to-b from-accent-hover to-accent font-black text-white shadow-aura inset-shadow-hairline-strong ${
    isActive ? 'brightness-110' : 'hover:-translate-y-0.5 hover:brightness-110'
  }`
}

// Login pasa a ghost: borde sutil, texto neutro, hover acent. No grita,
// pero está siempre a la vista para los usuarios que ya tienen cuenta.
function loginGhostClass({ isActive }) {
  return `${navLinkBase} ml-1 border font-medium ${
    isActive
      ? 'border-accent bg-accent-soft text-gold'
      : 'border-border text-fg-muted hover:border-accent hover:text-gold'
  }`
}

// En móvil 390px el header ocupaba ~25% del primer
// viewport apilando logo + 7 navlinks + 5 iconos utility + login en
// flex-col. Refactor: en móvil solo logo + acción primaria (login o
// avatar+notif) + hamburger; nav y utility se abren en panel.
function Header() {
  const { t } = useTranslation()
  const { user, logout } = useAuth()
  const { muted, toggleMute, play } = useSound()
  const { pathname } = useLocation()
  // Nota de rendimiento 2026-05-18: CTAs principales del header con pointerdown
  // para que el sonido vaya por delante del click (más perceptible como
  // "instantáneo"). Aplica al "Votar ahora" desktop + "Votar" mobile.
  const ctaVotarDesktop = useInstantSoundPress('playClick')
  const ctaVotarMobile = useInstantSoundPress('playClick')
  const { girarRuleta, isLoading: ruletaLoading } = usePersonajeRuleta()
  // Condensación al scrollear: direccional con histéresis, sin animar height.
  // Sustituye al antiguo estado `scrolled`. La gota de tinta (NavInkRail) se
  // ancla al nav vía navRef.
  const condensed = useCondensedHeader()
  const [mobileOpen, setMobileOpen] = useState(false)
  const mobileToggleRef = useRef(null)
  const navRef = useRef(null)

  // activeKey de la gota: la key i18n-estable cuyo `to` prefija el pathname;
  // null en fichas, /votar, grupo «Más», auth, etc. (la gota se desvanece).
  const activeKey =
    primaryNavLinks.find(
      ({ to }) => pathname === to || pathname.startsWith(`${to}/`),
    )?.i18nKey ?? null

  // useCallback: estabiliza la referencia de onClose que recibe NorenMobileMenu;
  // sin esto, su efecto de focus-trap se re-ejecutaba en cada render del Header
  // y re-robaba el foco al primer ítem del menú.
  const closeMobile = useCallback(() => setMobileOpen(false), [])
  const openQuickSearch = () => {
    play('playClick')
    window.dispatchEvent(new CustomEvent(OPEN_COMMAND_PALETTE_EVENT))
  }
  const handleRuleta = async ({ close = false } = {}) => {
    play('playClick')
    const personaje = await girarRuleta()
    if (personaje && close) closeMobile()
  }

  return (
    <header
      className="as-vt-header as-header-shell"
      data-condensed={condensed || undefined}
    >
      {/* Capa de fondo: lleva el fondo/borde/blur EXISTENTE del header (incl.
          el backdrop-blur de pointer-fine:); la condensación la sube vía
          transform (header-standards.css), nunca animando height. El shell
          jamás lleva transform — rompería su position:sticky. */}
      <div className="as-header-bg border-b border-white/10 bg-bg/90 pointer-fine:bg-bg/52 pointer-fine:backdrop-blur-xl" />
      <div className="as-header-row justify-between">
      <AppLink to="/" className="flex min-h-11 min-w-0 flex-1 items-center gap-2.5 min-[1120px]:flex-none">
        <img
          src="/logo.svg"
          alt=""
          width={40}
          height={40}
          className="h-9 w-9 shrink-0 object-contain sm:h-10 sm:w-10"
        />
        <span className="as-header-wordmark truncate text-base font-extrabold tracking-tight sm:text-lg">
          <span className="text-fg-strong">Anime</span>
          <span className="text-gold">Showdown</span>
        </span>
      </AppLink>

      {/* Nav desktop (≥1120px). 5 enlaces principales + menú "Más" + CTA caben
          en una fila con holgura; por debajo pasa al panel del hamburger.
          1024px (lg) era demasiado justo con el logotipo + estos elementos.
          `relative` ancla la gota de tinta (NavInkRail, última hija). */}
      <nav
        ref={navRef}
        className="relative hidden flex-nowrap items-center justify-center gap-1 min-[1120px]:flex"
      >
        {primaryNavLinks.map(({ to, i18nKey }) => (
          <AppNavLink
            key={to}
            to={to}
            data-nav-key={i18nKey}
            onClick={() => play('playClick')}
            className={regularLinkClass}
          >
            {t(`nav.${i18nKey}`)}
          </AppNavLink>
        ))}
        <MoreMenu moreLinks={moreNavLinks} t={t} play={play} />
        <button
          type="button"
          onClick={() => handleRuleta()}
          disabled={ruletaLoading}
          aria-label={t('header.ruletaAria')}
          className={`${navLinkBase} inline-flex items-center gap-1.5 border border-gold/35 bg-gold/10 font-black text-gold shadow-aura transition-transform hover:-translate-y-0.5 hover:bg-gold/15 disabled:translate-y-0`}
        >
          <Shuffle className="h-3.5 w-3.5" />
          {ruletaLoading ? t('header.ruletaLoading') : t('nav.ruleta')}
        </button>
        {/* CTA principal: votar siempre visible, no requiere login. */}
        <AppNavLink
          to="/votar"
          onPointerDown={ctaVotarDesktop.onPointerDown}
          onClick={ctaVotarDesktop.onClick}
          className={ctaVotarClass}
        >
          <Swords className="h-4 w-4" />
          {t('header.ctaVotar')}
        </AppNavLink>
        <button
          type="button"
          onClick={openQuickSearch}
          aria-label={t('header.searchAria')}
          title={t('header.searchAria')}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-border/60 bg-surface px-2.5 text-fg-muted transition-colors hover:bg-surface-alt hover:text-fg-strong"
        >
          <Search className="h-3.5 w-3.5 shrink-0" />
          <span className="hidden text-[11px] 2xl:inline">{t('header.searchShort')}</span>
          <kbd className="hidden rounded-md border border-border bg-bg px-1 font-mono text-[10px] leading-none text-fg-muted 2xl:inline-block">
            ⌘K
          </kbd>
        </button>
        <LanguageToggle />
        <button
          type="button"
          onClick={() => {
            toggleMute()
            if (muted) play('playClick')
          }}
          aria-label={muted ? t('header.activarSonidos') : t('header.silenciar')}
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-surface-alt hover:text-fg-strong"
        >
          {muted ? (
            <VolumeX className="h-4 w-4" />
          ) : (
            <Volume2 className="h-4 w-4" />
          )}
        </button>
        <CalmLantern />
        {user ? (
          <>
            <SaldoChip />
            <NotifBell />
            <UserBadge user={user} onLogout={logout} t={t} />
          </>
        ) : (
          <AppNavLink
            to="/login"
            onClick={() => play('playClick')}
            className={loginGhostClass}
          >
            {t('nav.login')}
          </AppNavLink>
        )}
        {/* Gota de tinta del item de sección activo (última hija del nav). */}
        <NavInkRail containerRef={navRef} activeKey={activeKey} />
      </nav>

      {/* Cluster móvil/tablet: avatar/notif si logueado, CTA Votar si no, +
          hamburger. El Login en mobile pasa al panel del hamburger
          (nota de producto 2026-05-18: primero participar, después
          registrarse — login secundario hasta que haya valor acumulado). */}
      <div className="flex items-center gap-1.5 min-[1120px]:hidden">
        {user ? (
          <>
            <SaldoChip className="px-1.5 py-0.5 text-xs" />
            <NotifBell />
            <AppLink
              to="/perfil"
              aria-label={t('nav.perfil')}
              onClick={() => play('playClick')}
            >
              <RitoAvatarTarget>
                <Avatar user={user} size={32} />
              </RitoAvatarTarget>
            </AppLink>
            <button
              type="button"
              onClick={openQuickSearch}
              aria-label={t('header.searchAria')}
              title={t('header.searchAria')}
              className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-surface-alt hover:text-fg-strong"
            >
              <Search className="h-4 w-4" aria-hidden="true" />
            </button>
          </>
        ) : (
          /* Nota de producto: "Votar ahora" en 2 líneas comía
             demasiado del header móvil. Cambio a "Votar" + icono Swords:
             una palabra cabe en una línea y deja respirar al hamburger. */
          <AppNavLink
            to="/votar"
            onPointerDown={ctaVotarMobile.onPointerDown}
            onClick={ctaVotarMobile.onClick}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-accent/50 bg-gradient-to-b from-accent-hover to-accent px-3 text-[13px] font-black text-white shadow-aura"
          >
            <Swords className="h-3.5 w-3.5" />
            {t('header.ctaVotarCompact')}
          </AppNavLink>
        )}
        {!user && (
          <button
            type="button"
            onClick={openQuickSearch}
            aria-label={t('header.searchAria')}
            title={t('header.searchAria')}
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-surface-alt hover:text-fg-strong"
          >
            <Search className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
        <button
          ref={mobileToggleRef}
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label={mobileOpen ? 'Cerrar menú' : 'Abrir menú'}
          aria-expanded={mobileOpen}
          aria-controls="mobile-nav-noren"
          className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-fg-strong transition-colors hover:bg-surface-alt"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
      </div>

      {/* Panel móvil — noren que cae desde el bajo del header. SIEMPRE montado
          (la tela existe, solo se levanta): scroll-lock/trap/Esc los gestiona
          NorenMobileMenu. Las tablillas hacen stagger de 40ms por índice. */}
      <NorenMobileMenu
        open={mobileOpen}
        onClose={closeMobile}
        toggleRef={mobileToggleRef}
        label="Menú de navegación"
      >
        <div className="flex flex-col gap-1">
          {[...primaryNavLinks, ...moreNavLinks].map(({ to, i18nKey }, i) => (
            <NorenTablilla key={to} index={i}>
              <AppNavLink
                to={to}
                onClick={() => { play('playClick'); closeMobile() }}
                className={({ isActive }) =>
                  `flex min-h-11 items-center rounded-lg px-3 text-sm font-medium ${
                    isActive
                      ? 'bg-surface-alt text-fg-strong'
                      : 'text-fg hover:bg-surface-alt'
                  }`
                }
              >
                {t(`nav.${i18nKey}`)}
              </AppNavLink>
            </NorenTablilla>
          ))}
          <NorenTablilla index={primaryNavLinks.length + moreNavLinks.length}>
            <AppNavLink
              to="/votar"
              onClick={() => { play('playClick'); closeMobile() }}
              className={({ isActive }) =>
                `flex min-h-11 items-center rounded-lg px-3 text-sm font-medium ${
                  isActive
                    ? 'bg-surface-alt text-fg-strong'
                    : 'text-fg hover:bg-surface-alt'
                }`
              }
            >
              {t('nav.votar')}
            </AppNavLink>
          </NorenTablilla>
          <NorenTablilla index={primaryNavLinks.length + moreNavLinks.length + 1}>
            <button
              type="button"
              onClick={() => handleRuleta({ close: true })}
              disabled={ruletaLoading}
              className="flex w-full min-h-11 items-center gap-2 rounded-lg px-3 text-left text-sm font-black text-gold hover:bg-surface-alt disabled:opacity-55"
            >
              <Shuffle className="h-4 w-4" />
              {ruletaLoading ? t('header.ruletaLoading') : t('nav.ruleta')}
            </button>
          </NorenTablilla>
          {!user && (
            <NorenTablilla index={primaryNavLinks.length + moreNavLinks.length + 2}>
              <AppNavLink
                to="/login"
                onClick={() => { play('playClick'); closeMobile() }}
                className="mt-1 inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-border px-3 text-sm font-medium text-fg-muted hover:border-accent hover:text-gold"
              >
                {t('nav.login')}
              </AppNavLink>
            </NorenTablilla>
          )}
        </div>
        <NorenTablilla index={primaryNavLinks.length + moreNavLinks.length + 3}>
          <div className="mt-3 flex items-center gap-2 border-t border-border pt-3">
            <LanguageToggle />
            <button
              type="button"
              onClick={() => { toggleMute(); if (muted) play('playClick') }}
              aria-label={muted ? t('header.activarSonidos') : t('header.silenciar')}
              className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-fg-muted hover:bg-surface-alt hover:text-fg-strong"
            >
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
            <CalmLantern size="h-11 w-11" />
            {user && (
              <button
                type="button"
                onClick={() => { logout(); closeMobile() }}
                className="ml-auto inline-flex min-h-11 items-center gap-1 rounded-lg border border-border bg-surface px-3 text-[12px] font-semibold text-fg-strong"
              >
                <LogOut className="h-3.5 w-3.5" />
                {t('nav.salir')}
              </button>
            )}
          </div>
        </NorenTablilla>
      </NorenMobileMenu>
    </header>
  )
}

// Menú "Más" del nav desktop: panel de papel (PaperDropdown) accesible —
// hover-intent + pin por click, Escape/click-fuera/Tab cierran, teclado de
// menú. El botón se resalta si la ruta activa está dentro del grupo.
function MoreMenu({ moreLinks, t, play }) {
  const { pathname } = useLocation()
  const isActive = moreLinks.some(
    ({ to }) => pathname === to || pathname.startsWith(`${to}/`),
  )

  return (
    <PaperDropdown
      isActive={isActive}
      onActivate={() => play('playClick')}
      buttonClassName={({ open, isActive: active }) =>
        `${navLinkBase} inline-flex items-center gap-1 font-medium ${
          active || open
            ? 'bg-white/5 text-fg-strong'
            : 'text-fg hover:bg-white/5 hover:text-fg-strong'
        }`
      }
      label={
        <>
          {t('nav.mas', 'Más')}
          <ChevronDown className="h-3.5 w-3.5" />
        </>
      }
    >
      {moreLinks.map(({ to, i18nKey }) => (
        <AppNavLink
          key={to}
          to={to}
          role="menuitem"
          onClick={() => play('playClick')}
          className={({ isActive: linkActive }) =>
            `flex min-h-10 items-center rounded-lg px-3 text-sm font-medium ${
              linkActive
                ? 'bg-surface-alt text-fg-strong'
                : 'text-fg hover:bg-surface-alt hover:text-fg-strong'
            }`
          }
        >
          {t(`nav.${i18nKey}`)}
        </AppNavLink>
      ))}
    </PaperDropdown>
  )
}

function UserBadge({ user, onLogout, t }) {
  const isAdmin = user.rol === 'ADMIN'
  return (
    <div className="ml-2 flex items-center gap-2 rounded-lg bg-surface-alt px-2 py-1.5">
      <AppLink
        to="/perfil"
        aria-label={t('nav.perfil')}
        className="flex items-center gap-2.5"
      >
        <RitoAvatarTarget>
          <Avatar user={user} size={28} />
        </RitoAvatarTarget>
        <span className="text-sm font-medium text-fg-strong hover:text-gold">
          {user.username}
        </span>
      </AppLink>
      {isAdmin && (
        <AppLink
          to="/admin"
          aria-label={t('nav.admin')}
          className="inline-flex items-center gap-1 rounded-md bg-accent/15 px-1.5 py-0.5 text-[10px] font-bold text-gold transition-colors hover:bg-accent/25"
        >
          <Shield className="h-3 w-3" />
          {t('nav.admin')}
        </AppLink>
      )}
      <button
        type="button"
        onClick={onLogout}
        aria-label={t('nav.salir')}
        className="ml-1 inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-2 py-1 text-[12px] font-semibold text-fg-strong transition-colors hover:border-accent hover:text-gold"
      >
        <LogOut className="h-3.5 w-3.5" />
        {t('nav.salir')}
      </button>
    </div>
  )
}

export default Header
