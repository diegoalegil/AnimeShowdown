import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './library.css'
import { useSoundOptional } from '../../../contexts/SoundContext'
import { markAnimeScene } from '../../../lib/animeSceneMorph'
import { construirBiblioteca } from './library-core'
import BookSpine from './BookSpine'
import FlyLeaf from './FlyLeaf'
import LibrarianLantern from './LibrarianLantern'

const POR_ESTANTERIA = 8

/**
 * UniverseLibrary — el catálogo /animes como SALA-BIBLIOTECA: estanterías de
 * madera en filas con perspectiva sutil, cada universo un tomo lacado. Orden
 * por tablilla (radiogroup, las MISMAS opciones de SORT_LABELS del catálogo),
 * búsqueda-linterna con barrido y fly-leaf por tomo abierto (cola: abrir otro
 * cierra el anterior primero).
 *
 * Controlado por el padre (AnimesPage) en search + sort para preservar el
 * useDeferredValue, el conteo "en vista" y el resto del shell SEO/JsonLd/h1.
 *
 * @param {Object} props
 * @param {import('./library-core').Universo[]} props.universos  Universos derivados del catálogo.
 * @param {string} props.search  Texto de búsqueda (controlado).
 * @param {(q:string)=>void} props.onSearch  Cambia la búsqueda.
 * @param {string} props.sort  Criterio de orden actual (clave de SORT_LABELS).
 * @param {(s:string)=>void} props.onSort  Cambia el orden.
 * @param {Array<{value:string,label:string}>} props.sortOptions  Tablillas de orden (de SORT_LABELS).
 * @param {(slug:string)=>string} props.hrefUniverso  Construye /animes/:slug.
 */
export default function UniverseLibrary({
  universos,
  search,
  onSearch,
  sort,
  onSort,
  sortOptions,
  hrefUniverso,
}) {
  const { play } = useSoundOptional()
  const [openSlug, setOpenSlug] = useState(null)
  const [closingSlug, setClosingSlug] = useState(null)
  // Solo se lee dentro del updater funcional (cola de cierre), nunca en render.
  const [, setPendingOpen] = useState(null)
  const [sweepKey, setSweepKey] = useState(0)
  const [entered, setEntered] = useState(false)

  // Refs de cada tomo para devolver el foco al cerrar su fly-leaf.
  const spineRefs = useRef(new Map())
  const focusSlugRef = useRef(null)
  // Refs de las tablillas de orden (radios) para el roving tabindex + flechas.
  const ordenRefs = useRef([])

  // Dispara la caída de canto SOLO cuando la página es visible: rAF no corre en
  // pestañas ocultas, así el estado base (visible) nunca queda atrapado en el
  // opacity:0 de una animación congelada. setState dentro de rAF es legal.
  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true))
    return () => cancelAnimationFrame(id)
  }, [])

  // Memoizado sobre [universos, sort, search]: así los tomos enriquecidos
  // conservan su referencia entre renders que NO tocan esas entradas (p.ej.
  // abrir/cerrar un fly-leaf), y el React.memo del BookSpine corta de verdad
  // (solo re-renderiza el tomo cuyo `expanded` cambia, no los 7 hermanos).
  const { estanterias, total, visibles } = useMemo(
    () =>
      construirBiblioteca(universos, {
        criterio: sort,
        query: search,
        porEstanteria: POR_ESTANTERIA,
      }),
    [universos, sort, search],
  )

  // Cola de cierre: cuando hay un slug cerrándose, esperar 250 ms (timing del
  // colapso) y luego limpiar; si había uno en cola, abrirlo. setState dentro
  // del timer es legal con el React Compiler.
  useEffect(() => {
    if (!closingSlug) return undefined
    const id = setTimeout(() => {
      setClosingSlug(null)
      setPendingOpen((queued) => {
        if (queued) setOpenSlug(queued)
        return null
      })
    }, 250)
    return () => clearTimeout(id)
  }, [closingSlug])

  // Devolver el foco al tomo tras cerrar del todo (sin abrir otro).
  useEffect(() => {
    if (openSlug || closingSlug) return
    const slug = focusSlugRef.current
    if (!slug) return
    focusSlugRef.current = null
    const node = spineRefs.current.get(slug)
    if (node && typeof node.focus === 'function') node.focus()
  }, [openSlug, closingSlug])

  const handleToggle = useCallback(
    (slug) => {
      setOpenSlug((current) => {
        if (current === slug) {
          // cerrar el abierto
          focusSlugRef.current = slug
          setClosingSlug(slug)
          play('playClack')
          return null
        }
        if (current) {
          // hay otro abierto: cerrarlo primero, encolar este (sin solapar)
          setClosingSlug(current)
          setPendingOpen(slug)
          play('playClick')
          return null
        }
        play('playClick')
        return slug
      })
    },
    [play],
  )

  const handleClose = useCallback(() => {
    setOpenSlug((current) => {
      if (!current) return null
      focusSlugRef.current = current
      setClosingSlug(current)
      play('playClack')
      return null
    })
  }, [play])

  const handleSweep = useCallback(() => {
    setSweepKey((k) => k + 1)
    play('playWhoosh')
  }, [play])

  // Entrar al universo (mismo gesto que la card del catálogo original): marcar
  // el origen del morph va SOLO en onViewTransitionStart (si fuera en onClick,
  // un click modificado dejaría un view-transition-name fantasma); el whoosh sí
  // va en onClick.
  const handleEnter = useCallback((slug) => markAnimeScene(slug), [])
  const handleEnterWhoosh = useCallback(() => play('playWhoosh'), [play])

  // registerRef recibe (slug, node): el BookSpine lo invoca en su ref callback.
  // Estable (sin closure por tomo) para no anular el React.memo del BookSpine.
  const registerRef = useCallback((slug, node) => {
    if (node) spineRefs.current.set(slug, node)
    else spineRefs.current.delete(slug)
  }, [])

  // Patrón ARIA radiogroup: roving tabindex (solo el radio activo es tabbable)
  // + navegación por flechas con wrap, que mueve la selección, reproduce el
  // click y enfoca el radio destino.
  const handleOrdenKeyDown = useCallback(
    (e) => {
      const keys = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp']
      if (!keys.includes(e.key)) return
      e.preventDefault()
      const n = sortOptions.length
      if (n === 0) return
      const actual = sortOptions.findIndex((o) => o.value === sort)
      const base = actual < 0 ? 0 : actual
      const adelante = e.key === 'ArrowRight' || e.key === 'ArrowDown'
      const siguiente = (base + (adelante ? 1 : -1) + n) % n
      const destino = sortOptions[siguiente]
      onSort(destino.value)
      play('playClick')
      ordenRefs.current[siguiente]?.focus()
    },
    [sortOptions, sort, onSort, play],
  )

  const buscando = search.trim().length > 0
  const sinResultados = buscando && visibles === 0

  // Una búsqueda que no casa con nada sustituye las estanterías por la sala
  // vacía: el fly-leaf del tomo previamente abierto se desmonta, pero su
  // openSlug/closingSlug seguían vivos, así que al volver a casar reaparecía
  // solo y robaba el foco. Cerrar al entrar en "sin resultados" lo evita.
  // El reset va dentro de un rAF (no setState síncrono en cuerpo de effect).
  useEffect(() => {
    if (!sinResultados) return undefined
    const id = requestAnimationFrame(() => {
      setOpenSlug(null)
      setClosingSlug(null)
    })
    return () => cancelAnimationFrame(id)
  }, [sinResultados])

  return (
    <div
      className="lib-room"
      data-buscando={buscando ? '1' : '0'}
      data-entered={entered ? '1' : '0'}
    >
      <header className="lib-toolbar">
        <LibrarianLantern
          query={search}
          onQuery={onSearch}
          onSweep={handleSweep}
          visibles={visibles}
          total={total}
        />
        <div
          className="lib-orden"
          role="radiogroup"
          aria-label="Ordenar estantería"
          onKeyDown={handleOrdenKeyDown}
        >
          {sortOptions.map((o, i) => (
            <button
              key={o.value}
              ref={(node) => {
                ordenRefs.current[i] = node
              }}
              type="button"
              role="radio"
              aria-checked={sort === o.value}
              tabIndex={sort === o.value ? 0 : -1}
              className="lib-orden__tab"
              data-active={sort === o.value ? '1' : '0'}
              onClick={() => {
                onSort(o.value)
                play('playClick')
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      </header>

      {sinResultados ? (
        <div className="lib-empty" role="status">
          <span className="lib-empty__kanji" lang="ja" aria-hidden="true">
            空
          </span>
          <p className="lib-empty__title">Estantería vacía</p>
          <p className="lib-empty__hint">
            Ningún universo casa con «{search.trim()}».
          </p>
          <button
            type="button"
            className="lib-empty__reset"
            onClick={() => onSearch('')}
          >
            Ver todos los universos
          </button>
        </div>
      ) : (
        estanterias.map((fila, shelfIndex) => {
          // ¿Esta estantería contiene el tomo abierto (o cerrándose)? Si sí, su
          // CSS levanta el content-visibility para no recortar el fly-leaf.
          const filaConOpen = fila.some(
            (u) => u.slug === openSlug || u.slug === closingSlug,
          )
          return (
          <div
            key={shelfIndex}
            className={`lib-shelf${shelfIndex === 0 ? ' lib-shelf--first' : ''}`}
            data-has-open={filaConOpen ? '1' : '0'}
          >
            <ul className="lib-row">
              {fila.map((u, indexEnFila) => {
                const anchor =
                  indexEnFila >= Math.ceil(fila.length / 2) ? 'right' : 'left'
                const isOpen = openSlug === u.slug
                const isClosing = closingSlug === u.slug
                return (
                  <BookSpine
                    key={u.slug}
                    universo={u}
                    kanji={u.kanji}
                    indiceGlobal={u._i}
                    expanded={isOpen || isClosing}
                    match={u._match}
                    onToggle={handleToggle}
                    registerRef={registerRef}
                  >
                    {(isOpen || isClosing) && (
                      <FlyLeaf
                        universo={u}
                        kanji={u.kanji}
                        anchor={anchor}
                        closing={isClosing}
                        hrefUniverso={hrefUniverso}
                        onClose={handleClose}
                        onEnter={handleEnter}
                        onWhoosh={handleEnterWhoosh}
                      />
                    )}
                  </BookSpine>
                )
              })}
            </ul>
            {/* capa ÚNICA de barrido por estantería, re-disparada por sweepKey */}
            <div
              key={`sweep-${sweepKey}`}
              className="lantern-sweep"
              data-run={buscando ? '1' : '0'}
              aria-hidden="true"
            />
            <div className="lib-plank" aria-hidden="true" />
          </div>
          )
        })
      )}
    </div>
  )
}
