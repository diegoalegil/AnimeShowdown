/**
 * ConsentScroll — «El pergamino del consentimiento»
 * =================================================
 * Reemplazo de PIEL del banner RGPD actual: franja inferior de papel con
 * hairline superior dorada, texto legal ÍNTEGRO (vía prop, legal manda) y
 * dos decisiones como sellos EQUIVALENTES — «Solo esenciales» (sello gris
 * sobrio) y «Aceptar» (hanko carmesí).
 *
 * SOLO presentación + coreografía. El gating real NO vive aquí:
 *  · `onDecide` se dispara INMEDIATAMENTE al pulsar (t = 0 del click,
 *    ANTES de cualquier animación). Las claves de storage y el gating de
 *    Sentry/analytics actuales quedan intactos en el host.
 *  · Esc no hace NADA: ni decide ni cierra (RGPD: el silencio no consiente).
 *  · Sin trampa de foco: banner no modal (role="region").
 *
 * Coreografía (los @keyframes viven en consent-scroll.css — CSP por hash):
 *  entrada   : desenrollado scaleY 0→1, origin bottom, 350ms var(--ease-lift)
 *  estampado : caída + overshoot 300ms ease-stamp (local) + sangrado 200ms (+120ms)
 *  pausa     : 420ms (lectura del sello puesto)
 *  enrollado : scaleY 1→0, origin bottom, 350ms var(--ease-brush)
 *  reduced-motion: fades de 120–150ms, cero transform.
 *
 * React 19 + Compiler: cero refs en render, cero setState síncrono en
 * effects (solo dentro de callbacks de timers/rAF), inicializadores puros,
 * componentes auxiliares a nivel de módulo.
 */
import { useEffect, useRef, useState } from 'react';
// Sonidos ya existentes en lib/sounds.js, enrutados por nombre a través de
// play() del SoundContext para respetar el mute global (gate único en
// SoundContext.play) — ver notas de handoff, punto «Sonido».
import { useSoundOptional } from '../contexts/SoundContext';
import './consent-scroll.css';

const ENTRY_MS = 350;
const STAMP_MS = 300;
const HOLD_MS = 420;
const ROLL_MS = 350;
const REDUCED_MS = 150;

const DEFAULT_LABELS = {
  region: 'Aviso de cookies',
  essentials: 'Solo esenciales',
  accept: 'Aceptar',
  current: 'decisión actual',
  moreInfo: 'Más información',
};

function prefersReduced() {
  return typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Un sello del pergamino. Ambos sellos usan EXACTAMENTE el mismo
 * componente, mismas dimensiones y misma estructura: la única diferencia
 * es la tinta (paridad RGPD — rechazar es tan fácil como aceptar).
 *
 * @param {object} props
 * @param {'essentials'|'accept'} props.kind
 * @param {string} props.label Texto del botón.
 * @param {string} props.srCurrent Texto solo-lector para la decisión vigente.
 * @param {boolean} props.placed Sello ya puesto (decisión previa o recién elegida).
 * @param {boolean} props.stamping Sello cayendo ahora mismo (fase stamping/rolling).
 * @param {() => void} props.onChoose
 */
function SealButton({ kind, label, srCurrent, placed, stamping, onChoose }) {
  const classes = [
    'cs-seal',
    kind === 'accept' ? 'cs-seal--accept' : 'cs-seal--essentials',
    placed ? 'is-placed' : '',
    stamping ? 'is-stamping' : '',
  ].join(' ').trim();
  return (
    <button type="button" className={classes} aria-pressed={placed} onClick={onChoose}>
      <span className="cs-seal__face" aria-hidden="true">
        <span className="cs-seal__kanji">印</span>
        <span className="cs-seal__bleed"></span>
        <span className="cs-seal__stamp">印</span>
      </span>
      <span className="cs-seal__label">{label}</span>
      {placed && !stamping ? <span className="cs-sr"> ({srCurrent})</span> : null}
    </button>
  );
}

/**
 * @typedef {'essentials'|'accept'} ConsentDecision
 */

/**
 * El pergamino del consentimiento.
 *
 * @param {object} props
 * @param {boolean} [props.open=true]
 *   Visible/montado. El host lo pone a false tras `onDismissed` (o desmonta).
 * @param {ConsentDecision|null} [props.decision=null]
 *   Decisión previa (reapertura desde ajustes): se muestra como sello YA
 *   puesto con opción de cambiarla. null = primera visita.
 * @param {(d: ConsentDecision) => void} props.onDecide
 *   GATING REAL. Se invoca a t=0 del click, antes de la animación: aquí el
 *   host escribe su clave de storage actual y aplica el gating de
 *   Sentry/analytics vigente (sin cambios). Idempotente si repiten decisión.
 * @param {() => void} [props.onDismissed]
 *   Fin del enrollado: el host desmonta / pone open=false. El foco vuelve de
 *   forma natural al disparador (botón de ajustes) — no se gestiona aquí.
 * @param {import('react').ReactNode} props.legalText
 *   OBLIGATORIO: el texto legal ACTUAL, ÍNTEGRO. No se incluye aquí a
 *   propósito (dato real del producto: no inventar).
 * @param {string} props.moreInfoHref
 *   Href ACTUAL del enlace «más info» (intacto).
 * @param {string} [props.moreInfoLabel]
 *   Texto ACTUAL del enlace «más info» (intacto). Por defecto, etiqueta genérica.
 * @param {import('react').ReactNode} [props.moreInfo]
 *   Enlace «más info» ya construido (p.ej. un <Link> de react-router para no
 *   perder la navegación SPA). Si se pasa, se usa en vez del <a href>.
 * @param {boolean} [props.playEntry=true]
 *   Desenrollado de entrada. La regla «UNA vez por decisión pendiente» la
 *   gobierna el host con su estado actual (no se introduce storage nuevo).
 * @param {boolean} [props.autoFocus=false]
 *   Mover el foco al pergamino al abrir. true SOLO en reapertura explícita
 *   desde ajustes; en primera visita debe quedar false (no robar el foco).
 * @param {'papel'|'noche'} [props.tone='papel']
 *   Variante visual del papel. 'papel' = pergamino claro (por defecto).
 * @param {Partial<typeof DEFAULT_LABELS>} [props.labels]
 *   Sobrescritura puntual de textos de interfaz (no del texto legal).
 */
export default function ConsentScroll({
  open = true,
  decision = null,
  onDecide,
  onDismissed,
  legalText,
  moreInfoHref,
  moreInfoLabel,
  moreInfo,
  playEntry = true,
  autoFocus = false,
  tone = 'papel',
  labels,
}) {
  const [phase, setPhase] = useState(() => (open ? (playEntry ? 'entering' : 'open') : 'hidden'));
  const [placed, setPlaced] = useState(decision);
  const [pendingKind, setPendingKind] = useState(null);
  const [focusArmed, setFocusArmed] = useState(open && autoFocus);
  const [prevOpen, setPrevOpen] = useState(open);
  const rootRef = useRef(null);
  // Variante tolerante: fuera de <SoundProvider> (tests aislados) play() es
  // no-op; dentro de la app corre el play() con gate de mute global.
  const { play } = useSoundOptional();

  // Cambio de `open`: ajuste DURANTE el render con guard (patrón canónico
  // React 19 — nada de espejos en effects).
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (open) {
      setPhase(playEntry ? 'entering' : 'open');
      setPlaced(decision);
      setPendingKind(null);
      setFocusArmed(autoFocus);
    } else {
      setPhase('hidden');
    }
  }

  // entrada → abierto (setState SOLO dentro del callback del timer)
  useEffect(() => {
    if (phase !== 'entering') return undefined;
    play('playWhoosh');
    const t = setTimeout(() => {
      setPhase('open');
    }, prefersReduced() ? REDUCED_MS : ENTRY_MS);
    return () => clearTimeout(t);
    // play fuera de deps: efecto disparado por phase; re-correrlo al togglear mute
    // repetiria el whoosh y reprogramaria la transicion. Mute gateado en play().
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // estampado → enrollado
  useEffect(() => {
    if (phase !== 'stamping') return undefined;
    const t = setTimeout(() => {
      setPhase('rolling');
    }, prefersReduced() ? 260 : STAMP_MS + HOLD_MS);
    return () => clearTimeout(t);
  }, [phase]);

  // enrollado → cerrado (+ aviso al host)
  useEffect(() => {
    if (phase !== 'rolling') return undefined;
    play('playWhoosh');
    const t = setTimeout(() => {
      setPhase('closed');
      if (onDismissed) onDismissed();
    }, prefersReduced() ? REDUCED_MS : ROLL_MS);
    return () => clearTimeout(t);
    // play fuera de deps (ver nota de arriba): one-shot por phase, mute en play().
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, onDismissed]);

  // foco programático SOLO si autoFocus (reapertura desde ajustes);
  // el desarme del flag ocurre dentro del rAF (legal para el Compiler).
  useEffect(() => {
    if (!focusArmed) return undefined;
    if (phase !== 'entering' && phase !== 'open') return undefined;
    const raf = requestAnimationFrame(() => {
      if (rootRef.current) rootRef.current.focus({ preventScroll: true });
      setFocusArmed(false);
    });
    return () => cancelAnimationFrame(raf);
  }, [focusArmed, phase]);

  function choose(kind) {
    if (phase !== 'open') return;
    onDecide(kind); // ← gating real, t=0: storage + Sentry/analytics del host
    play('playSello');
    setPlaced(kind);
    setPendingKind(kind);
    setPhase('stamping');
  }

  if (!open || phase === 'hidden' || phase === 'closed') return null;

  const L = { ...DEFAULT_LABELS, ...labels };
  const stampingKind = phase === 'stamping' || phase === 'rolling' ? pendingKind : null;

  return (
    <div
      ref={rootRef}
      className={tone === 'noche' ? 'cs-root cs-tone--noche' : 'cs-root'}
      data-phase={phase}
      data-screen-label="Pergamino RGPD"
      role="region"
      aria-label={L.region}
      tabIndex={-1}
    >
      <div className="cs-paper">
        <div className="cs-hairline" aria-hidden="true"></div>
        <span className="cs-watermark" aria-hidden="true">印</span>
        <div className="cs-inner">
          <div className="cs-text">
            <p className="cs-legal">{legalText}</p>
            {moreInfo ?? (
              <a className="cs-more" href={moreInfoHref}>{moreInfoLabel || L.moreInfo}</a>
            )}
          </div>
          <div className="cs-seals">
            <SealButton
              kind="essentials"
              label={L.essentials}
              srCurrent={L.current}
              placed={placed === 'essentials'}
              stamping={stampingKind === 'essentials'}
              onChoose={() => choose('essentials')}
            />
            <SealButton
              kind="accept"
              label={L.accept}
              srCurrent={L.current}
              placed={placed === 'accept'}
              stamping={stampingKind === 'accept'}
              onChoose={() => choose('accept')}
            />
          </div>
        </div>
        <div className="cs-rolledge" aria-hidden="true"></div>
      </div>
    </div>
  );
}
