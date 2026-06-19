/**
 * BattleChronicle — historial competitivo como crónica de bitácora.
 *
 * Filas de pergamino fino: rival en miniatura (2:3), mini-sello 勝/負,
 * delta de ELO en mono con signo y fecha relativa. Las rachas de
 * victorias se "encuadernan" con una hairline lateral y su conteo (×N),
 * calculado SIEMPRE del dato real.
 *
 * Coreografía (ver battle-chronicle.css):
 *  · Entrada al viewport: 6 primeras filas en stagger 40ms (250ms, --ease-lift).
 *  · Combate nuevo (prepend): la lista asienta desde arriba (300ms, --ease-lift)
 *    y el sello se estampa al asentarse (280ms, ease-stamp local).
 *  · "Ver más": las siguientes montan directas, sin animación.
 *
 * React 19 + React Compiler:
 *  · cero lecturas/escrituras de ref en render;
 *  · cero setState síncrono en cuerpo de effect (solo en callbacks de
 *    setTimeout/rAF/observer);
 *  · cero Date.now()/Math.random() en render — la fecha relativa usa la
 *    prop `ahora` o se resuelve en cliente vía rAF post-mount.
 *
 * @module BattleChronicle
 */

import { useEffect, useRef, useState } from 'react'
import './battle-chronicle.css'
import PersonajeImg from './PersonajeImg'

const PUSH_MS = 300 // espejo de --bc-push-ms
const STAMP_MS = 280 // espejo de --bc-stamp-ms
const STAGGER_MS = 40
const ROW_IN_MS = 250
const MAX_STAGGER = 6

/**
 * @typedef {Object} Rival
 * @property {string} nombre   Nombre visible del rival.
 * @property {string} slug     Slug para PersonajeImg (/img/<Anime>/<slug>.webp, variantes -300/-600).
 * @property {string} [anime]  Título del anime (línea secundaria).
 * @property {string} [colorDominante] Color dominante que consume PersonajeImg.
 */

/**
 * @typedef {Object} Combate
 * @property {string} id          Id único y estable (clave de la fila).
 * @property {Rival} rival
 * @property {'victoria'|'derrota'} resultado
 * @property {number|null} [deltaElo] Con signo (+28 / -17). Opcional: si el
 *   backend no expone el cambio de ELO, la columna del delta se omite.
 * @property {string} fechaISO    Fecha del combate en ISO 8601.
 */

/* ------------------------------------------------------------------ */
/* Helpers puros (sin estado, seguros en render)                       */
/* ------------------------------------------------------------------ */

/**
 * Anota rachas de victorias consecutivas (longitud >= 2).
 * La lista llega en orden cronológico inverso (más reciente primero).
 * @param {Combate[]} combates
 * @returns {Array<{len:number, pos:'start'|'mid'|'end'}|null>}
 */
function anotarCadenas(combates) {
  const out = new Array(combates.length).fill(null)
  let i = 0
  while (i < combates.length) {
    if (combates[i].resultado === 'victoria') {
      let j = i
      while (j < combates.length && combates[j].resultado === 'victoria') j += 1
      const len = j - i
      if (len >= 2) {
        for (let k = i; k < j; k += 1) {
          out[k] = { len, pos: k === i ? 'start' : k === j - 1 ? 'end' : 'mid' }
        }
      }
      i = j
    } else {
      i += 1
    }
  }
  return out
}

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/**
 * Fecha relativa en dos longitudes (larga / corta para 390px).
 * Si `ahora` aún no se conoce, cae a fecha absoluta corta (pura).
 * @param {string} iso
 * @param {number|null} ahora epoch ms de referencia
 * @returns {{larga: string, corta: string}}
 */
function formatearFecha(iso, ahora) {
  const t = new Date(iso)
  if (ahora == null) {
    const abs = `${t.getDate()} ${MESES_CORTOS[t.getMonth()]}`
    return { larga: abs, corta: abs }
  }
  const s = Math.max(0, Math.round((ahora - t.getTime()) / 1000))
  if (s < 45) return { larga: 'ahora mismo', corta: 'ahora' }
  const m = Math.round(s / 60)
  if (m < 60) return { larga: `hace ${m} min`, corta: `${m}min` }
  const h = Math.round(m / 60)
  if (h < 24) return { larga: `hace ${h} h`, corta: `${h}h` }
  const d = Math.round(h / 24)
  if (d === 1) return { larga: 'ayer', corta: '1d' }
  if (d < 7) return { larga: `hace ${d} días`, corta: `${d}d` }
  const sem = Math.round(d / 7)
  if (sem < 5) return { larga: `hace ${sem} sem`, corta: `${sem}sem` }
  const mes = Math.round(d / 30)
  return { larga: `hace ${mes} ${mes === 1 ? 'mes' : 'meses'}`, corta: `${mes}mes` }
}

/* ------------------------------------------------------------------ */
/* Subcomponentes (a nivel de módulo, nunca anidados)                  */
/* ------------------------------------------------------------------ */

/**
 * Una línea de la crónica.
 * @param {{combate: Combate, indice: number, conStagger: boolean,
 *          cadena: ({len:number,pos:string}|null), ahora: (number|null),
 *          fresh: boolean, stamping: boolean}} props
 */
function FilaCombate({ combate, indice, conStagger, cadena, ahora, fresh, stamping }) {
  const esVictoria = combate.resultado === 'victoria'
  const f = formatearFecha(combate.fechaISO, ahora)
  const tieneDelta = combate.deltaElo != null
  const signo = combate.deltaElo > 0 ? '+' : combate.deltaElo < 0 ? '−' : '±'
  const etiqueta =
    `${esVictoria ? 'Victoria' : 'Derrota'} contra ${combate.rival.nombre}` +
    `${combate.rival.anime ? ` (${combate.rival.anime})` : ''}` +
    `${tieneDelta ? `, ${combate.deltaElo < 0 ? 'menos' : 'más'} ${Math.abs(combate.deltaElo)} puntos de ELO` : ''}` +
    `, ${f.larga}`

  return (
    <li
      className="bc-row"
      aria-label={etiqueta}
      data-res={combate.resultado}
      data-chain={cadena ? cadena.pos : undefined}
      data-anim={conStagger ? 'stagger' : undefined}
      data-fresh={fresh ? 'true' : undefined}
      data-stamping={stamping ? 'true' : undefined}
      data-no-delta={tieneDelta ? undefined : 'true'}
      style={conStagger ? { '--bc-i': indice } : undefined}
    >
      <span className="bc-rail" aria-hidden="true">
        {cadena && cadena.pos === 'start' ? (
          <span className="bc-chain-count">×{cadena.len}</span>
        ) : null}
      </span>
      <span className="bc-thumb" aria-hidden="true">
        <PersonajeImg
          slug={combate.rival.slug}
          colorDominante={combate.rival.colorDominante}
          alt=""
          loading="lazy"
          sizes="34px"
          fit="cover"
          className="bc-thumb-img"
        />
      </span>
      <span className="bc-quien">
        <span className="bc-nombre">{combate.rival.nombre}</span>
        {combate.rival.anime ? <span className="bc-anime">{combate.rival.anime}</span> : null}
      </span>
      <span className="bc-fecha" aria-hidden="true">
        <span className="bc-fecha-larga">{f.larga}</span>
        <span className="bc-fecha-corta">{f.corta}</span>
      </span>
      {tieneDelta ? (
        <span
          className={`bc-delta ${combate.deltaElo >= 0 ? 'bc-delta-pos' : 'bc-delta-neg'}`}
          aria-hidden="true"
        >
          {signo}{Math.abs(combate.deltaElo)}
        </span>
      ) : null}
      <span className="bc-stamp" aria-hidden="true">
        <span className="bc-stamp-bleed">{esVictoria ? '勝' : '負'}</span>
        <span className="bc-stamp-core">{esVictoria ? '勝' : '負'}</span>
      </span>
    </li>
  )
}

/** Estado vacío: la crónica espera su primera página. */
function CronicaVacia() {
  return (
    <div className="bc-empty">
      <span className="bc-empty-kanji" aria-hidden="true">戦</span>
      <p className="bc-empty-texto">La crónica espera su primera página.</p>
      <span className="bc-empty-hairline" aria-hidden="true"></span>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Componente principal                                                */
/* ------------------------------------------------------------------ */

/**
 * @param {Object} props
 * @param {Combate[]} props.combates
 *   Orden cronológico inverso (el más reciente primero). Un combate
 *   nuevo se inyecta haciendo PREPEND con id nuevo: el componente lo
 *   detecta y dispara la coreografía de empuje + sello.
 * @param {string} [props.titulo='Crónica de combates'] Título de la cabecera.
 * @param {number} [props.visiblesIniciales=6] Filas visibles antes de "Ver más".
 * @param {number} [props.pasoVerMas=6] Filas que añade cada "Ver más".
 * @param {number|null} [props.ahora=null]
 *   Epoch ms de referencia para fechas relativas. Si el llamador no lo
 *   pasa, se resuelve en cliente tras el mount (rAF); hasta entonces se
 *   muestra fecha absoluta corta. Recomendado pasarlo desde arriba.
 * @param {{empuje?: function(): void, estampar?: function(): void}|null} [props.sonidos=null]
 *   Puntos de enganche de sonido. INTEGRACIÓN: cablear vía SoundContext
 *   a playWhoosh (empuje) y playSello (sello) — respetan el mute global.
 */
export default function BattleChronicle({
  combates,
  titulo = 'Crónica de combates',
  visiblesIniciales = 6,
  pasoVerMas = 6,
  ahora = null,
  sonidos = null,
}) {
  const rootRef = useRef(null)
  const scrollRef = useRef(null)

  const [armed, setArmed] = useState(false)
  const [entranceDone, setEntranceDone] = useState(false)
  const [visibles, setVisibles] = useState(visiblesIniciales)
  const [ahoraInterno, setAhoraInterno] = useState(null)
  const [calmMQ, setCalmMQ] = useState(false)
  const [liveEntry, setLiveEntry] = useState(null)
  const [stampingId, setStampingId] = useState(null)
  const [anuncio, setAnuncio] = useState('')

  /* Detección de prepend — ajuste DURANTE el render con guard
     (patrón canónico React Compiler; nada de setState en effects). */
  const [prevLista, setPrevLista] = useState(combates)
  if (prevLista !== combates) {
    setPrevLista(combates)
    // Prepend de UN combate nuevo: la cabeza cambia y la cabeza vieja pasa al
    // índice 1. NO se exige length+1 — el endpoint capa a 10, así que con la
    // lista llena un combate nuevo mantiene length=10 (la última fila sale).
    const esPrepend =
      prevLista.length > 0 &&
      combates.length > 0 &&
      combates[0] != null &&
      prevLista[0] != null &&
      combates[0].id !== prevLista[0].id &&
      combates[1] != null &&
      combates[1].id === prevLista[0].id
    if (esPrepend) {
      const c = combates[0]
      setLiveEntry(c.id)
      setVisibles((v) => v + 1) // las filas ya reveladas no se pierden
      setAnuncio(
        `Nuevo combate: ${c.resultado} contra ${c.rival.nombre}` +
        `${c.deltaElo != null ? `, ${c.deltaElo < 0 ? 'menos' : 'más'} ${Math.abs(c.deltaElo)} puntos de ELO` : ''}.`,
      )
    } else {
      setLiveEntry(null)
      setStampingId(null)
    }
  }

  /* Armado de la entrada con IntersectionObserver (setState en callback
     de observer: legal). */
  useEffect(() => {
    const el = rootRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return undefined
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0] && entries[0].isIntersecting) {
          setArmed(true)
          io.disconnect()
        }
      },
      { threshold: 0.15 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  /* Fin de la entrada: retiramos data-anim para que cambios de índice
     posteriores (p. ej. un prepend) no re-disparen el stagger. */
  useEffect(() => {
    if (!armed || entranceDone) return undefined
    const t = setTimeout(
      () => setEntranceDone(true),
      (MAX_STAGGER - 1) * STAGGER_MS + ROW_IN_MS + 100,
    )
    return () => clearTimeout(t)
  }, [armed, entranceDone])

  /* prefers-reduced-motion (lectura fuera del render; setState vía rAF
     y listener: legal). El CSS ya gatea por su cuenta. */
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setCalmMQ(mq.matches)
    const id = requestAnimationFrame(onChange)
    mq.addEventListener('change', onChange)
    return () => {
      cancelAnimationFrame(id)
      mq.removeEventListener('change', onChange)
    }
  }, [])

  /* `ahora` interno si el llamador no lo pasa (nunca Date.now en render). */
  useEffect(() => {
    if (ahora != null) return undefined
    const id = requestAnimationFrame(() => setAhoraInterno(Date.now()))
    return () => cancelAnimationFrame(id)
  }, [ahora])

  /* Coreografía del combate en vivo — SOLO timers. */
  useEffect(() => {
    if (!liveEntry) return undefined
    const calmado =
      calmMQ ||
      document.documentElement.classList.contains('as-calm') ||
      document.documentElement.classList.contains('as-tab-hidden')
    if (calmado) {
      // reduced-motion: el nuevo aparece directo arriba, sello incluido.
      const id = requestAnimationFrame(() => {
        setLiveEntry(null)
        setStampingId(null)
      })
      return () => cancelAnimationFrame(id)
    }
    const scroller = scrollRef.current
    if (scroller) scroller.scrollTo({ top: 0 })
    if (sonidos && sonidos.empuje) sonidos.empuje()
    const t1 = setTimeout(() => {
      setStampingId(liveEntry)
      if (sonidos && sonidos.estampar) sonidos.estampar()
    }, PUSH_MS)
    const t2 = setTimeout(() => {
      setStampingId(null)
      setLiveEntry(null)
    }, PUSH_MS + STAMP_MS + 320)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [liveEntry, calmMQ, sonidos])

  /* Derivados puros */
  const ahoraEfectivo = ahora != null ? ahora : ahoraInterno
  const cadenas = anotarCadenas(combates)
  const filas = combates.slice(0, visibles)
  const restantes = combates.length - filas.length
  const victorias = combates.reduce((n, c) => n + (c.resultado === 'victoria' ? 1 : 0), 0)
  const derrotas = combates.length - victorias

  return (
    <section className="bc" ref={rootRef} data-armed={armed ? 'true' : 'false'}>
      <header className="bc-head">
        <span className="bc-head-kanji" aria-hidden="true">戦</span>
        <h2 className="bc-title">{titulo}</h2>
        {combates.length > 0 ? (
          <p
            className="bc-record"
            aria-label={`${victorias} ${victorias === 1 ? 'victoria' : 'victorias'}, ${derrotas} ${derrotas === 1 ? 'derrota' : 'derrotas'}`}
          >
            <span aria-hidden="true">
              {victorias}<span className="bc-record-k">勝</span>
              {' · '}
              {derrotas}<span className="bc-record-k">負</span>
            </span>
          </p>
        ) : null}
      </header>

      {combates.length === 0 ? (
        <CronicaVacia></CronicaVacia>
      ) : (
        <div className="bc-scroll" ref={scrollRef} tabIndex={0} role="region" aria-label="Historial de combates">
          <ol className="bc-list" aria-label="Combates recientes" data-pushing={liveEntry ? 'true' : undefined}>
            {filas.map((c, i) => (
              <FilaCombate
                key={c.id}
                combate={c}
                indice={i}
                conStagger={!entranceDone && i < MAX_STAGGER && c.id !== liveEntry}
                cadena={cadenas[i]}
                ahora={ahoraEfectivo}
                fresh={c.id === liveEntry}
                stamping={c.id === stampingId}
              ></FilaCombate>
            ))}
          </ol>
        </div>
      )}

      {restantes > 0 ? (
        <button type="button" className="bc-more" onClick={() => setVisibles((v) => v + pasoVerMas)}>
          Ver más combates
          <span className="bc-more-n">+{Math.min(restantes, pasoVerMas)}</span>
        </button>
      ) : null}

      <div className="bc-sr" role="status" aria-live="polite">{anuncio}</div>
    </section>
  )
}
