/**
 * FighterProfile — «La Ficha del Combatiente» (/u/:username)
 * Re-jerarquiza lo que YA existe en el perfil público: banner subido como
 * estandarte (fallback = arte del favorito, regla actual), avatar con su
 * marco cosmético (lo renderiza Avatar/marcoClass tal cual), username +
 * meta de comunidad, KPIs acuñados y la vitrina (ProfileShowcase).
 *
 * Coreografía (timing exacto en las notas del canvas):
 *   t=0       banner + scrim ya pintados (LCP: sin animación, fetchpriority alta)
 *   t+150ms   avatar + marco asientan con UN golpe (fp-stamp 300ms, ease-stamp local)
 *   t+340ms   sangrado del sello (fp-bleed, solo opacity, 420ms)
 *   ~t+300ms  playVerdictStamp (contacto del hanko) — vía SoundContext, mute global
 *   scroll    vitrina: corte de tinta en títulos + stagger 50ms por pieza
 *
 * prefers-reduced-motion: asientos directos (CSS) + sonido inmediato.
 * Sin loops infinitos: nada que registrar en html.as-calm / as-tab-hidden.
 *
 * Datos NO disponibles hoy (degradan en silencio, documentado):
 *   - selloKanji (sello personal): solo se pinta si llega la prop.
 *   - cartaDestacada: el flujo de carta de perfil no existe aún (PR num. 282
 *     quedó en hold) — el bloque se omite para ajenos y queda informativo
 *     para el propio usuario.
 */
import { useEffect, useRef, useState } from 'react'
import './fighter-profile.css'
import ProfileShowcase from './ProfileShowcase'
import { usePrefersReducedMotion } from './fpHooks'
import Avatar from '../../components/Avatar'
import CountUp from '../../components/CountUp'
import { useSound } from '../../contexts/SoundContext'

/**
 * @param {object} props
 * @param {object} props.perfil               PerfilPublicoDto tal cual llega del backend.
 * @param {boolean} props.esPropio
 * @param {string} [props.selloKanji]         Sello personal (sin dato hoy: se omite).
 * @param {import('react').ReactNode} [props.accionPrincipal]
 *        Slot del header para la acción existente (Seguir / Editar perfil).
 * @param {string} [props.votarHref='/votar'] CTA del perfil recién creado.
 * @param {(slug:string) => string} [props.hrefPersonaje]
 *        Habilita la navegación (AppLink → morph personaje-hero) en las minis.
 */
export default function FighterProfile({
  perfil,
  esPropio,
  selloKanji,
  accionPrincipal,
  votarHref = '/votar',
  hrefPersonaje,
}) {
  const reduced = usePrefersReducedMotion()
  const { play } = useSound()
  const [stamped, setStamped] = useState(false)

  // `play` cambia de identidad con el mute global (useCallback sobre [muted]);
  // leerla por ref mantiene el sello como one-shot por montaje y evita que el
  // golpe se re-dispare al des-mutear (mismo patrón que VoteVerdict).
  const playRef = useRef(play)
  useEffect(() => {
    playRef.current = play
  })

  /* el golpe se arma en el primer frame pintado (setState dentro de rAF: legal) */
  useEffect(() => {
    const raf = requestAnimationFrame(() => setStamped(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  /* sonido en el contacto del hanko (t+300ms; directo con reduced-motion);
     mount-only: suena una vez por montaje, independiente del toggle de mute */
  useEffect(() => {
    if (!stamped) return undefined
    const t = setTimeout(() => playRef.current('playVerdictStamp'), reduced ? 0 : 300)
    return () => clearTimeout(t)
  }, [stamped, reduced])

  /* estandarte: banner subido o, si no hay, el arte del favorito (regla actual) */
  const bannerSrc = perfil.bannerUrl || perfil.top?.[0]?.imagenUrl || null
  const miembroDesde = formatMiembroDesde(perfil.fechaRegistro)

  const top5 = (perfil.top || []).slice(0, 5).map((p) => ({
    slug: p.slug,
    nombre: p.nombre,
    src: p.imagenUrl,
  }))
  const logrosRecientes = medallasRecientes(perfil.logros)

  return (
    <article className="fp-root fp-anim">
      {/* estandarte: ES el LCP — scrim ya puesto, cero animación */}
      <div className="fp-banner">
        {bannerSrc ? (
          <img
            className="fp-banner-media"
            src={bannerSrc}
            sizes="100vw"
            alt=""
            fetchPriority="high"
            decoding="async"
          />
        ) : null}
        <div className="fp-banner-scrim" aria-hidden="true"></div>
        <div className="fp-banner-hairline" aria-hidden="true"></div>
      </div>

      <header className={`fp-head${stamped ? ' fp-stamped' : ''}`}>
        <div className="fp-avatar-wrap">
          {/* avatar + marco cosmético existentes (marcoClass), sin retocar */}
          <Avatar user={perfil} size={124} className="fp-avatar" />
          <span className="fp-stamp-bleed" aria-hidden="true"></span>
        </div>
        <div className="fp-id">
          <div className="fp-username-row">
            <h1 className="fp-username">{perfil.username}</h1>
            {selloKanji ? (
              <span
                className="fp-sello"
                role="img"
                aria-label={`Sello personal ${selloKanji}`}
                lang="ja"
              >
                {selloKanji}
              </span>
            ) : null}
          </div>
          <p className="fp-meta">
            <strong>{perfil.seguidores}</strong> seguidores ·{' '}
            <strong>{perfil.seguidos}</strong> seguidos
          </p>
          {perfil.bio ? <p className="fp-bio">{perfil.bio}</p> : null}
        </div>
        {accionPrincipal ? (
          <div className="fp-own-actions">{accionPrincipal}</div>
        ) : null}
      </header>

      <div className="fp-kpis">
        <KpiGrid
          stats={perfil.stats}
          miembroDesde={miembroDesde}
          reduced={reduced}
        />
      </div>

      <ProfileShowcase
        top5={top5}
        logros={logrosRecientes}
        carta={null}
        esPropio={esPropio}
        votarHref={votarHref}
        hrefPersonaje={hrefPersonaje}
      />
    </article>
  )
}

function formatMiembroDesde(fechaRegistro) {
  if (!fechaRegistro) return '—'
  const d = new Date(fechaRegistro)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('es', { month: 'short', year: 'numeric' }).format(d)
}

/* Glifo de medalla determinista por rareza (decorativo; el nombre real va
   en title + texto sr). El catálogo de logros no tiene glifo propio aún. */
const KANJI_RAREZA = { 1: '印', 2: '戦', 3: '界', 4: '王' }

function medallasRecientes(logros) {
  if (!Array.isArray(logros)) return []
  return logros
    .filter((l) => l?.desbloqueadoEn)
    .sort((a, b) => String(b.desbloqueadoEn).localeCompare(String(a.desbloqueadoEn)))
    .slice(0, 5)
    .map((l) => ({
      id: String(l.id ?? l.codigo),
      kanji: KANJI_RAREZA[l.rareza] ?? '印',
      nombre: l.nombre,
    }))
}

/**
 * Fila de KPIs acuñados. CountUp asienta las cifras al montar (instant con
 * reduced-motion). Recupera las métricas que el perfil viejo mostraba en
 * CardStats — predicciones y torneos — todas con degradado HONESTO a "—"
 * cuando aún no hay datos (nunca un 0/1000 engañoso).
 */
function KpiGrid({ stats, miembroDesde, reduced }) {
  const eloPvp = stats?.pvpPartidos > 0 ? stats.eloPvp : null
  const pctAciertos =
    stats?.prediccionesResueltas > 0 ? Math.round(stats.porcentajeAciertos ?? 0) : null
  const torneos = Number(stats?.torneosCreados ?? 0)
  return (
    <dl className="fp-kpis-grid">
      <div className="fp-kpi">
        <dt>Votos emitidos</dt>
        <dd><CountUp target={Number(stats?.votosTotales ?? 0)} instant={reduced} /></dd>
      </div>
      <div className="fp-kpi">
        <dt>% Aciertos</dt>
        <dd>{pctAciertos != null ? <CountUp target={pctAciertos} suffix="%" instant={reduced} /> : '—'}</dd>
      </div>
      <div className="fp-kpi">
        <dt>Torneos creados</dt>
        <dd><CountUp target={torneos} instant={reduced} /></dd>
      </div>
      <div className="fp-kpi">
        <dt>ELO duelo</dt>
        <dd>{eloPvp != null ? <CountUp target={eloPvp} instant={reduced} /> : '—'}</dd>
      </div>
      <div className="fp-kpi">
        <dt>Logros</dt>
        <dd><CountUp target={Number(stats?.badgesDesbloqueados ?? 0)} instant={reduced} /></dd>
      </div>
      <div className="fp-kpi">
        <dt>Miembro desde</dt>
        <dd>{miembroDesde}</dd>
      </div>
    </dl>
  )
}
