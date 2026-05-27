import { ArrowRight, Crown } from 'lucide-react'
import { Link } from 'react-router-dom'
import PersonajeImg from '../../../../components/PersonajeImg'
import CardEyebrow from './CardEyebrow'
import PulseCard from './PulseCard'

function CampeonCard({ campeon, esFallback, loading, comunidadArrancando }) {
  if (loading || !campeon?.personaje) {
    return (
      <PulseCard tono="amber">
        {/* Label de loading neutro: el ranking se ordena por voto ponderado,
            así que "Líder del ranking" no promete una métrica incorrecta
            antes de que lleguen los datos. */}
        <CardEyebrow icon={Crown} label="Líder del ranking" tono="text-amber-300" />
        <p className="text-sm text-fg-muted">Cargando al líder…</p>
      </PulseCard>
    )
  }

  const p = campeon.personaje
  const votos = Number(campeon.votos ?? 0)
  // La métrica detrás es el TOP del endpoint /api/votos/ranking, ordenado
  // por SUM(v.peso) ponderado (anónimo 0.3, registrado 1.0). El campo
  // `votos` mostrado sigue siendo COUNT físico para no truncar números.
  // Distinguimos tres copys según contexto:
  //   - esFallback: backend sin votos → "Top del catálogo (ELO base)".
  //   - comunidadArrancando: muy pocos votos totales → "Más votado ahora".
  //   - normal: "Top de la comunidad" (orden ponderado).
  // CTA visible al ranking competitivo para el user que quiere el
  // "salón de la fama" completo.
  const eyebrow = esFallback
    ? 'Top del catálogo'
    : comunidadArrancando
      ? 'Más votado ahora'
      : 'Top de la comunidad'

  // Patrón "stretched link": el article es semántico
  // (article), y un Link absoluto invisible cubre toda la card. El CTA
  // interno a /ranking queda por encima con z-10, sigue siendo independiente.
  return (
    <article className="group relative flex flex-col gap-3 overflow-hidden rounded-xl border border-amber-500/30 bg-surface p-4 transition-all hover:-translate-y-0.5 hover:border-amber-500/60 sm:p-5">
      {/* Stretched link invisible que hace TODA la card clickeable.
          z-0 + el resto de elementos en z relativo (no absolute) =
          la card es accesible con teclado y screen-reader como un solo
          link a la ficha del personaje. */}
      <Link
        to={`/personajes/${p.slug}`}
        className="absolute inset-0 z-0"
        aria-label={`Ver ficha de ${p.nombre}`}
      />
      <CardEyebrow icon={Crown} label={eyebrow} tono="text-amber-300" />
      <div className="flex items-start gap-4">
        <PersonajeImg
          slug={p.slug}
          alt={p.nombre}
          className="h-28 w-20 shrink-0 rounded-lg object-cover object-top sm:h-32 sm:w-24"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h3 className="line-clamp-2 text-lg font-extrabold leading-tight text-fg-strong sm:text-xl">
            {p.nombre}
          </h3>
          <p className="text-[13px] text-fg-muted">{p.anime}</p>
          {esFallback ? (
            <p className="mt-2 font-mono text-2xl font-bold text-amber-300 tabular-nums">
              {Number(campeon.eloLocal ?? 0).toLocaleString('es-ES')}
              <span className="ml-1 text-[11px] font-medium uppercase text-fg-muted">
                ELO base
              </span>
            </p>
          ) : (
            <p className="mt-2 font-mono text-2xl font-bold text-amber-300 tabular-nums">
              {votos.toLocaleString('es-ES')}
              <span className="ml-1 text-[11px] font-medium uppercase text-fg-muted">
                {votos === 1 ? 'voto' : 'votos'}
              </span>
            </p>
          )}
          {comunidadArrancando ? (
            <p className="mt-1 text-[11px] leading-snug text-amber-200/70">
              Comunidad arrancando — tu voto puede cambiar el meta.
            </p>
          ) : (
            // El ranking REST se ordena por votos ponderados. Evitamos
            // llamarlo "ELO global" porque sugeriría un K-factor real.
            <p className="mt-1 text-[11px] leading-snug text-fg-muted">
              Top de la comunidad por votos ponderados.
            </p>
          )}
        </div>
      </div>
      {/* mt-auto + relative z-10 → el CTA queda POR ENCIMA del stretched
          link. Sin stopPropagation: ya no es necesario, no hay onClick
          en el padre. */}
      <div className="relative z-10 mt-auto flex items-center justify-between gap-2 pt-1">
        <Link
          to="/ranking"
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-fg-muted hover:text-amber-300"
        >
          Ver ranking competitivo
          <ArrowRight className="h-3 w-3" />
        </Link>
        <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-amber-300 opacity-0 transition-opacity group-hover:opacity-100">
          Ver ficha
          <ArrowRight className="h-3 w-3" />
        </span>
      </div>
    </article>
  )
}

export default CampeonCard
