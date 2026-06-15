import PersonajeCutImg from '../../../components/PersonajeCutImg'

/**
 * MatchScroll — el ROLLO emaki de un duelo. Tres estados visuales:
 *   · 'pending'   : aún no jugado (asientos pueden estar vacíos en función).
 *   · 'resolved'  : ganador en oro (王), perdedor tachado por corte de tinta.
 *   · 'live'      : duelo abierto en curso → cordón cian latiendo + enlace a votar.
 *
 * Todo color por token (cero hex). Solo se animan transform/opacity/clip; el
 * desenrollado de entrada (scaleY origin-top) y la tacha (scaleX) viven en
 * theater.css. El cordón cian es una capa de glow PRE-PINTADA que cross-fadea
 * opacity (jamás box-shadow vivo). A11y: role="group" focusable con
 * aria-label completo; el voto es un enlace real ≥44px.
 *
 * @param {object} props
 * @param {object} props.m           Match derivado de deriveBracketState().
 * @param {boolean} [props.live]      Duelo abierto en curso (cordón cian + voto).
 * @param {boolean} [props.playingCut] Anima el corte de tinta del perdedor ahora.
 * @param {boolean} [props.enter]     Reproduce el desenrollado de entrada.
 * @param {number}  [props.delay=0]   Stagger del desenrollado (ms).
 * @param {number}  [props.height=104]
 * @param {(slug:string)=>string} props.hrefPersonaje
 */
export default function MatchScroll({ m, live = false, playingCut = false, enter = false, delay = 0, height = 104, hrefPersonaje }) {
  const { slot1, slot2, status } = m
  const resolved = status === 'resolved'
  const tachaCls = playingCut ? 'teatro-tacha teatro-tacha--play' : 'teatro-tacha teatro-tacha--set'
  const perdedorEsSlot1 = slot1.isLoser
  const borde = live
    ? 'color-mix(in srgb, var(--color-electric) 45%, transparent)'
    : resolved ? 'var(--color-border-gold-subtle)' : 'color-mix(in srgb, var(--color-fg) 12%, transparent)'

  return (
    <div role="group" tabIndex={0} aria-label={describeMatch(m, live)}
      className={`teatro-emaki ${enter ? 'teatro-emaki--play' : ''}`}
      style={{ '--teatro-emaki-delay': `${delay}ms`, position: 'relative', height }}>
      {/* varilla de madera superior del rollo */}
      <div aria-hidden="true" style={{ height: 9, borderRadius: '5px 5px 2px 2px',
        background: 'linear-gradient(180deg, color-mix(in srgb,var(--color-gold) 22%, var(--color-canvas)), color-mix(in srgb,var(--color-canvas) 30%, var(--color-gold)))',
        boxShadow: 'inset 0 1px 0 color-mix(in srgb,var(--color-gold-bright) 40%,transparent)' }} />
      <div className="teatro-emaki__papel" style={{ position: 'relative', height: height - 9, overflow: 'hidden',
        borderRadius: '2px 2px 7px 7px', border: `1px solid ${borde}`, boxShadow: 'var(--shadow-elev-2)' }}>
        {live && <span className="teatro-cian-glow" aria-hidden="true" />}

        <Asiento slot={slot1} votos={resolved ? m.votos1 : null} hrefPersonaje={hrefPersonaje} />
        <div aria-hidden="true" style={{ height: 1, background: 'color-mix(in srgb,var(--color-fg) 12%,transparent)', margin: '0 9px' }} />
        <Asiento slot={slot2} votos={resolved ? m.votos2 : null} hrefPersonaje={hrefPersonaje} />

        {resolved && (slot1.isLoser || slot2.isLoser) && (
          <span aria-hidden="true" className={tachaCls} style={{ position: 'absolute', left: 0, right: 0,
            height: (height - 9) / 2 - 1, top: perdedorEsSlot1 ? 0 : (height - 9) / 2 + 1, opacity: 0.9, mixBlendMode: 'multiply' }} />
        )}

      </div>
    </div>
  )
}

/** Una fila/asiento del rollo. Retrato real con PersonajeCutImg; placeholder si vacío. */
function Asiento({ slot, votos, hrefPersonaje }) {
  const p = slot.persona
  const seated = slot.seated && p && p.slug
  const tone = slot.isWinner ? 'win' : slot.isLoser ? 'lose' : 'idle'
  const ring = tone === 'win' ? 'var(--color-gold)' : tone === 'lose'
    ? 'color-mix(in srgb, var(--color-accent) 60%, transparent)' : 'color-mix(in srgb, var(--color-gold) 30%, transparent)'
  const inner = (
    <>
      <span aria-hidden="true" style={{ width: 38, height: 38, flex: '0 0 auto', borderRadius: 8, overflow: 'hidden',
        border: `1px solid ${ring}`, background: 'var(--color-surface)', display: 'grid', placeItems: 'center',
        filter: tone === 'lose' ? 'grayscale(0.7) brightness(0.7)' : 'none' }}>
        {seated
          ? <PersonajeCutImg slug={p.slug} alt="" loading="lazy" className="h-full w-full" imgClassName="object-cover" />
          : <span className="font-kanji-serif" style={{ color: 'var(--color-fg-muted)', fontSize: 19 }}>?</span>}
      </span>
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: 'block', fontWeight: 700, fontSize: 13.5, lineHeight: 1.15,
          color: slot.isWinner ? 'var(--color-gold-bright)' : seated ? 'var(--color-fg-strong)' : 'var(--color-fg-muted)',
          textDecorationLine: slot.isLoser ? 'line-through' : 'none',
          textDecorationColor: 'color-mix(in srgb, var(--color-accent) 80%, transparent)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', opacity: slot.isLoser ? 0.6 : 1 }}>
          {seated ? p.nombre : '—'}
        </span>
        <span style={{ display: 'block', fontSize: 10.5, color: 'var(--color-fg-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {seated ? (p.anime ?? '') : 'asiento vacío'}
        </span>
      </span>
      {votos != null && seated && (
        <span className="font-mono" style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums',
          color: slot.isWinner ? 'var(--color-gold-bright)' : 'var(--color-fg-muted)' }}>
          {votos.toLocaleString('es-ES')}
        </span>
      )}
      {slot.isWinner && <span lang="ja" aria-hidden="true" className="font-kanji-serif" style={{ fontSize: 13, color: 'var(--color-gold-bright)' }}>王</span>}
    </>
  )
  const base = { display: 'flex', alignItems: 'center', gap: 9, padding: '5px 9px', minHeight: 44 }
  if (seated && hrefPersonaje) {
    return (
      <a href={hrefPersonaje(p.slug)} style={{ ...base, textDecoration: 'none' }}
        aria-label={`${p.nombre}${p.anime ? ', ' + p.anime : ''}${slot.isWinner ? ', ganador' : slot.isLoser ? ', eliminado' : ''}`}>
        {inner}
      </a>
    )
  }
  return <div style={base}>{inner}</div>
}

/** Resumen accesible del duelo (aria-label del rollo). Sigue el estado VISIBLE
 * (seated), igual que el render: un asiento sin ocupar se anuncia "por definir",
 * no adelanta finalistas durante el scrub. Un slot resuelto siempre está seated. */
function describeMatch(m, live) {
  const an = m.slot1.seated && m.slot1.persona?.slug ? m.slot1.persona.nombre : 'por definir'
  const bn = m.slot2.seated && m.slot2.persona?.slug ? m.slot2.persona.nombre : 'por definir'
  if (m.status === 'resolved') {
    const g = m.slot1.isWinner ? an : bn
    const l = m.slot1.isWinner ? bn : an
    return `Duelo resuelto: ${g} venció a ${l}`
  }
  if (live) return `Duelo en vivo: ${an} contra ${bn}, votación abierta`
  return `Duelo: ${an} contra ${bn}`
}
