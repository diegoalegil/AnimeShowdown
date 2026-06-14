/**
 * EloTreatise.jsx — «El tratado del ELO», la metodología como
 * documento de archivo (ruta /metodologia-elo).
 *
 * Portada con sello 算 (cae + overshoot + sangrado, 250ms,
 * ease-stamp local), fórmulas en placas mono con corte de tinta
 * (480ms var(--ease-brush), filo dorado 3px) y términos anotados al
 * margen, ejemplo vivo interactivo (LiveEloExample) y notas del
 * sistema en tipografía de lectura.
 *
 * Coreografía solo al montar; reduced-motion ⇒ todo directo
 * (el estado base de cada capa ES el estado final).
 *
 * JERARQUÍA: el h1 de la página lo pinta la página (CinematicHero).
 * El título «El tratado del ELO» es un rótulo decorativo del documento
 * (no es heading); las secciones §01–§05 son los h2 reales del cuerpo.
 */
import { useEffect } from 'react'
import LiveEloExample from './LiveEloExample'
import './elo-treatise.css'

/* ── Placa de fórmula + términos al margen (nivel de módulo) ──── */

/**
 * @param {object} props
 * @param {string} props.ariaLabel — la fórmula en texto plano accesible
 * @param {Array<{term: string, def: string}>} props.notes — términos al margen
 * @param {number} [props.cutDelay=0] — delay del corte de tinta (ms)
 * @param {number} [props.cutsKey=0] — solo QA: re-monta el corte (replay)
 */
function FormulaPlaque({ ariaLabel, notes, cutDelay = 0, cutsKey = 0, children }) {
  return (
    <div className="et-formula-row">
      <figure className="et-plaque" role="img" aria-label={ariaLabel}>
        <span
          key={'cut-' + cutsKey}
          className="et-cut-cover"
          style={{ animationDelay: cutDelay + 'ms' }}
          aria-hidden="true"
        ></span>
        <span className="et-f" aria-hidden="true">{children}</span>
      </figure>
      <dl className="et-margin">
        {notes.map((n) => (
          <div className="et-margin-item" key={n.term}>
            <dt>{n.term}</dt>
            <dd>{n.def}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

/**
 * §05 por defecto. El contenido real se puede inyectar por la prop
 * systemNotes ([{title, body}]) sin tocar código.
 */
const DEFAULT_SYSTEM_NOTES = [
  {
    title: 'Suma cero',
    body: 'Los puntos que gana un personaje salen del otro: el archivo no imprime ELO. La media del sistema es constante por construcción.',
  },
  {
    title: 'Convergencia',
    body: 'Con suficientes duelos, cada puntuación se estabiliza alrededor del favoritismo real del personaje. Las primeras semanas se mueven mucho; después, solo lo que la sorpresa justifica.',
  },
  {
    title: 'Sin memoria',
    body: 'Solo cuenta el presente: el sistema no guarda rencor ni privilegios. Una racha mueve el meta esta semana, no para siempre.',
  },
]

/* ── El tratado ───────────────────────────────────────────────── */

/**
 * @param {object} props
 * @param {number} props.kFactor — Factor K de la demostración del ejemplo
 *   vivo. El valor K real del producto vive en el backend; aquí es un valor
 *   ilustrativo declarado por la página.
 * @param {string} [props.revision='—'] — revisión del documento.
 * @param {() => void} [props.onStamp] — se dispara en el impacto del sello
 *   (~180ms tras montar). Punto de integración del sonido (playSello vía
 *   SoundContext — respeta el mute global).
 * @param {object} [props.exampleProps] — props del ejemplo vivo
 *   (initialA, initialB, minRating, maxRating, step).
 * @param {Array<{title: string, body: string}>} [props.systemNotes] —
 *   notas de §05.
 * @param {number} [props.stampKey=0] — solo QA: re-monta el sello (replay).
 * @param {number} [props.cutsKey=0] — solo QA: re-monta los cortes (replay).
 */
export default function EloTreatise({
  kFactor,
  revision = '—',
  onStamp,
  exampleProps = {},
  systemNotes = DEFAULT_SYSTEM_NOTES,
  stampKey = 0,
  cutsKey = 0,
}) {
  // Sonido del sello: timer puro dentro del effect (React Compiler ok).
  useEffect(() => {
    if (!onStamp) return undefined
    const t = setTimeout(onStamp, 180) // impacto del hanko
    return () => clearTimeout(t)
  }, [onStamp, stampKey])

  return (
    <article className="et-scope" lang="es">
      <div className="et-doc">
        <header className="et-cover">
          <span className="et-watermark" aria-hidden="true">算</span>
          <p className="et-meta">archivo animeshowdown · doc. ELO-01 · rev. {revision}</p>
          <p className="et-title">El tratado del <span className="et-title-elo">ELO</span></p>
          <p className="et-lede">Cómo el archivo convierte cada duelo en puntuación.</p>
          <span key={'stamp-' + stampKey} className="et-stamp" role="img" aria-label="Sello de cálculo (kanji 算)">算</span>
        </header>

        <section className="et-section">
          <h2 className="et-h2"><span className="et-h2-num">§ 01</span> El duelo como medida</h2>
          <p className="et-prose">
            Cada voto del archivo es un duelo: dos personajes, una decisión. El ELO no opina;
            contabiliza. Tras cada enfrentamiento, el ganador toma puntos del perdedor —
            exactamente los que la sorpresa del resultado justifica.
          </p>
          <p className="et-prose">
            Dos reglas gobiernan todo el sistema: <strong>la expectativa</strong> antes del duelo
            y <strong>la actualización</strong> después.
          </p>
        </section>

        <section className="et-section">
          <h2 className="et-h2"><span className="et-h2-num">§ 02</span> La expectativa</h2>
          <p className="et-prose">
            Antes del duelo, el sistema estima la probabilidad de victoria de cada personaje a
            partir de la distancia entre sus puntuaciones. No importa quién es: solo cuántos
            puntos los separan.
          </p>
          <FormulaPlaque
            cutsKey={cutsKey}
            cutDelay={0}
            ariaLabel="Fórmula de la expectativa: E sub A igual a uno, dividido entre uno más diez elevado a, abre paréntesis, R sub B menos R sub A, cierra paréntesis, entre cuatrocientos."
            notes={[
              { term: 'E', def: 'Expectativa de victoria, entre 0 y 1. Las dos expectativas del duelo suman exactamente 1.' },
              { term: 'R', def: 'Puntuación ELO actual de cada personaje.' },
              { term: '400', def: 'Escala logística: 400 puntos de ventaja ≈ favorito 10 a 1.' },
            ]}
          >
            <var className="et-var">E</var><sub>A</sub><span className="et-op"> = </span>
            <span className="et-frac">
              <span className="et-frac-num">1</span>
              <span className="et-frac-den">1 + 10<sup>( <var className="et-var">R</var><sub>B</sub> <span className="et-op">−</span> <var className="et-var">R</var><sub>A</sub> ) ∕ 400</sup></span>
            </span>
          </FormulaPlaque>
        </section>

        <section className="et-section">
          <h2 className="et-h2"><span className="et-h2-num">§ 03</span> La actualización</h2>
          <p className="et-prose">
            Tras el duelo, cada personaje se mueve en proporción a lo inesperado del resultado.
            Ganar siendo favorito apenas paga; ganar contra pronóstico paga casi K entero.
          </p>
          <FormulaPlaque
            cutsKey={cutsKey}
            cutDelay={120}
            ariaLabel="Fórmula de actualización: R prima sub A igual a R sub A más K por, abre paréntesis, S sub A menos E sub A, cierra paréntesis."
            notes={[
              { term: 'K', def: 'Amplitud máxima del ajuste por duelo. El valor real vive en el backend del producto (prop kFactor).' },
              { term: 'S', def: 'Resultado del duelo: 1 victoria · 0 derrota.' },
              { term: 'S − E', def: 'La sorpresa: cuanto menos esperado el resultado, más puntos se mueven.' },
            ]}
          >
            <var className="et-var">R</var>′<sub>A</sub><span className="et-op"> = </span>
            <var className="et-var">R</var><sub>A</sub><span className="et-op"> + </span>
            <var className="et-var">K</var><span className="et-op"> · </span>
            ( <var className="et-var">S</var><sub>A</sub><span className="et-op"> − </span><var className="et-var">E</var><sub>A</sub> )
          </FormulaPlaque>
        </section>

        <section className="et-section">
          <h2 className="et-h2"><span className="et-h2-num">§ 04</span> El ejemplo vivo</h2>
          <p className="et-prose">
            Mueve las puntuaciones y observa el reparto. Todo lo que ves sale de las dos fórmulas
            anteriores, calculado en el momento. Es una demostración ilustrativa de la metodología.
          </p>
          <LiveEloExample kFactor={kFactor} {...exampleProps} />
        </section>

        <section className="et-section">
          <h2 className="et-h2"><span className="et-h2-num">§ 05</span> Notas del sistema</h2>
          <div className="et-notes">
            {systemNotes.map((n, i) => (
              <div className="et-note" key={n.title}>
                <h3><span className="et-note-num">{String(i + 1).padStart(2, '0')}</span>{n.title}</h3>
                <p>{n.body}</p>
              </div>
            ))}
          </div>
        </section>

        <footer className="et-footer">
          <span>animeshowdown · /metodologia-elo</span>
          <span>doc. ELO-01 · rev. {revision}</span>
        </footer>
      </div>
    </article>
  )
}
