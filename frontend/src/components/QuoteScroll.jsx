import { useEffect, useRef, useState } from 'react';
import './quote-scroll.css';

/**
 * Umbral de "cita larga": por encima, la tipografía baja un punto y el
 * pergamino crece en altura. NUNCA scroll interno.
 */
const LONG_QUOTE_CHARS = 200;

/** Primer carácter CJK (kana/kanji) — para derivar el glifo del sello. */
const CJK_FIRST = /^[\u3005\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF]/;

/**
 * Glifo del sello del "autor": prop curada > inicial CJK del nombre > 印.
 * (animechan devuelve nombres en rōmaji, así que sin mapa curado el
 * fallback canónico 印 será el caso habitual — ver notas de handoff.)
 * @param {string} character
 * @param {string} [sealGlyph]
 * @returns {string}
 */
function resolveSealGlyph(character, sealGlyph) {
  if (sealGlyph) return sealGlyph;
  const first = (character || '').trim().charAt(0);
  return CJK_FIRST.test(first) ? first : '印';
}

/**
 * QuoteScroll — la cita del personaje (animechan) colgada como kakejiku:
 * pergamino vertical con varilla superior e inferior, cita con comillas
 * japonesas 「」, atribución en mono al pie y sello rojo del autor.
 *
 * Coreografía (una sola vez, al entrar al viewport — IntersectionObserver
 * threshold 0.25): desenrollado scaleY 0.06→1 origin-top 500ms ease-lift con
 * la varilla inferior bajando solidaria; texto a t+300ms (opacity 240ms);
 * sello a t+520ms (ease-stamp 300ms) con sangrado a t+760ms.
 * prefers-reduced-motion: desenrollado directo (estado final, sin animación).
 *
 * Contrato de montaje: sin cita o status="error" → devuelve null (el hueco
 * de la ficha colapsa limpio, jamás una cita inventada). status="loading" →
 * silueta de pergamino con piel .skl (reserva = var(--qs-reserve)).
 *
 * El wrapper ocupa su altura final desde el primer render (la coreografía es
 * solo transform/opacity), así que el desenrollado no produce CLS.
 *
 * @param {Object} props
 * @param {'ready'|'loading'|'error'} [props.status='ready'] Estado de la
 *   fuente de datos. 'error' nunca monta nada, aunque haya payload residual.
 * @param {{ content: string, character: string, anime?: string }|null} [props.quote=null]
 *   La cita de animechan. Si falta o content está vacío, no se monta nodo.
 * @param {string} [props.sealGlyph] Kanji curado para el sello (recomendado:
 *   mapa slug→kanji en datos). Sin él: inicial CJK del nombre, o 印.
 * @param {(cue: 'unroll'|'text'|'stamp') => void} [props.onCue] Se dispara en
 *   cada fase de la coreografía — punto de enganche para SoundContext
 *   ('unroll'→playWhoosh, 'stamp'→playSello). Respeta el mute global porque
 *   el sonido lo emite el consumidor, no esta pieza.
 * @param {string} [props.className] Clases extra para el nodo raíz.
 */
export default function QuoteScroll({
  status = 'ready',
  quote = null,
  sealGlyph,
  onCue,
  className = '',
}) {
  // 'pre' = colgado pero enrollado (oculto solo bajo no-preference);
  // 'play' = coreografía lanzada. Una vez por vida del componente.
  const [phase, setPhase] = useState('pre');
  const rootRef = useRef(null);
  const sheetRef = useRef(null);

  const content =
    quote && typeof quote.content === 'string' ? quote.content.trim() : '';
  const isMounted = status === 'ready' && content.length > 0;

  // Mide la lámina (para el descenso de la varilla) y arma el observer.
  // setPhase solo dentro del callback del observer (legal con Compiler).
  useEffect(() => {
    if (!isMounted || phase !== 'pre') return undefined;
    const root = rootRef.current;
    const sheet = sheetRef.current;
    if (!root || !sheet) return undefined;
    root.style.setProperty('--qs-drop', sheet.offsetHeight + 'px');
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          setPhase('play');
        }
      },
      { threshold: 0.25 }
    );
    io.observe(root);
    return () => io.disconnect();
  }, [isMounted, phase]);

  // Cues de sonido/integración — solo timers dentro del effect.
  useEffect(() => {
    if (phase !== 'play' || !onCue) return undefined;
    const timers = [
      setTimeout(() => onCue('unroll'), 0),
      setTimeout(() => onCue('text'), 300),
      setTimeout(() => onCue('stamp'), 520),
    ];
    return () => timers.forEach(clearTimeout);
  }, [phase, onCue]);

  // Error de fuente: no montar, jamás cita inventada.
  if (status === 'error') return null;

  if (status === 'loading') {
    return (
      <figure
        className={('qs-root qs-skeleton ' + className).trim()}
        aria-hidden="true"
      >
        <span className="qs-cord"></span>
        <span className="qs-rod qs-rod--top"></span>
        <div className="qs-body">
          <div className="qs-sheet skl"></div>
        </div>
        <span className="qs-rod qs-rod--bottom"></span>
      </figure>
    );
  }

  // Sin cita: no montar nodo — el hueco de la ficha colapsa limpio.
  if (!isMounted) return null;

  const isLong = content.length > LONG_QUOTE_CHARS;
  const glyph = resolveSealGlyph(quote.character, sealGlyph);

  return (
    <figure
      ref={rootRef}
      className={('qs-root' + (isLong ? ' qs-long' : '') + ' ' + className).trim()}
      data-phase={phase}
    >
      <span className="qs-cord" aria-hidden="true"></span>
      <span className="qs-rod qs-rod--top" aria-hidden="true"></span>
      <div className="qs-body">
        <div ref={sheetRef} className="qs-sheet">
          <span className="qs-watermark" aria-hidden="true">誓</span>
          <blockquote className="qs-quote">
            <p className="qs-text">「{content}」</p>
          </blockquote>
          <span className="qs-seal" aria-hidden="true">{glyph}</span>
        </div>
      </div>
      <span className="qs-rod qs-rod--bottom" aria-hidden="true"></span>
      <figcaption className="qs-attrib">
        — <cite className="qs-cite">{quote.character}</cite>
        {quote.anime ? <span className="qs-anime"> · {quote.anime}</span> : null}
      </figcaption>
    </figure>
  );
}
