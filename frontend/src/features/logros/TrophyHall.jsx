/**
 * TrophyHall — la sala de trofeos del dojo (/logros).
 *
 * Rediseño de medallas hanko: cada logro cuelga de su cordón sobre la
 * estantería de madera; conseguido = laca viva con la fecha en mono,
 * pendiente = silueta entintada. Conserva TODOS los contratos del salón
 * anterior: props {estanterias, logueado, logroDestacado}, modo
 * escaparate sin sesión, deep-link `logro-<codigo>` por medalla y el arte
 * logros-trophy-hall del banco como fondo del propio salón.
 *
 * Estampado EN VIVO (cola de timers): los logros con `nuevo && unlocked`
 * (calculado por la página contra el registro LOCAL logros-vistos) entran
 * como silueta y se estampan uno a uno con ease-stamp + sangrado + barrido,
 * el contador de sala rueda y aria-live anuncia cada uno. Al terminar la
 * cola, onEstampadosVistos(codigos) persiste el registro.
 *
 * React 19 + Compiler: la coreografía vive en un effect que SOLO programa
 * timers; cada setState ocurre dentro de callbacks de setTimeout.
 * Sin loops infinitos (el humo de secretos del diseño original quedó
 * fuera: el producto no tiene logros secretos hoy).
 */
import { useState, useEffect, useMemo, useRef } from 'react'
import { brandImage } from '../../lib/brand-assets'
import { useSound } from '../../contexts/SoundContext'
import './trophy-hall.css'

const HALL = brandImage('logros-trophy-hall')

const FECHA_CORTA = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', year: 'numeric' })
const FECHA_LARGA = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'long', year: 'numeric' })

// parse LOCAL del ISO (new Date('YYYY-MM-DD') parsea UTC y puede retroceder
// un día según huso). Determinista: legal en render.
function fechaLocal(iso) {
  const [d] = String(iso).split('T')
  const p = d.split('-')
  return new Date(+p[0], +p[1] - 1, +p[2])
}

/** Glifo de la medalla: kanji real del badge o su icono lucide de respaldo. */
function Glifo({ item }) {
  if (item.kanji) {
    return (
      <span className="th-disc__kanji" aria-hidden="true" lang="ja">
        {item.kanji}
      </span>
    )
  }
  const Icon = item.Icon
  return Icon ? <Icon className="th-disc__icon" aria-hidden="true" /> : null
}

/**
 * Medalla hanko individual (módulo, React Compiler).
 *
 * @param {object} props
 * @param {object} props.item        {codigo, kanji?, Icon?, nombre, descripcion,
 *                                    unlocked, fecha?, nuevo?, count?}
 * @param {string} props.tier        'gold'|'silver'|'bronze' (de la estantería)
 * @param {boolean} props.estampando esta medalla se está estampando AHORA
 * @param {boolean} props.sinEstampar conseguida pero aún en cola (silueta llena)
 * @param {boolean} props.entrada    participa en el stagger de entrada
 * @param {number}  props.indice     índice en la estantería (delay = i × 30ms)
 * @param {boolean} props.destacada  deep-link ?logro= apunta aquí
 */
function Medalla({ item, tier, estampando, sinEstampar, entrada, indice, destacada }) {
  const lograda = Boolean(item.unlocked) && !sinEstampar

  // count comunitario: dato social, va en el aria-label de TODA medalla (no
  // solo las pendientes) — antes los logros conseguidos lo perdían.
  const countTxt =
    item.count != null
      ? `, ${item.count} ${item.count === 1 ? 'persona lo tiene' : 'personas lo tienen'}`
      : ''
  let estado
  if (estampando) estado = ', conseguido ahora mismo'
  else if (lograda && item.fecha) estado = `, conseguido el ${FECHA_LARGA.format(fechaLocal(item.fecha))}`
  else if (lograda) estado = ', conseguido'
  else estado = ', pendiente'
  const ariaLabel =
    `${item.nombre}: ${item.descripcion}${estado}${countTxt}` +
    (destacada ? ' (resaltado por enlace)' : '')

  const cls =
    'th-medal' +
    (lograda ? ' is-lograda' : ' is-pendiente') +
    (estampando ? ' is-stamping' : '') +
    (entrada ? ' has-entrada' : '') +
    (destacada ? ' th-medal--destacada' : '')

  return (
    <div className="th-slot" id={`logro-${item.codigo}`}>
      <span className="th-cord" aria-hidden="true"></span>
      <button
        type="button"
        className={cls}
        style={{ '--th-i': indice, '--th-tier': `var(--color-medal-${tier})` }}
        aria-label={ariaLabel}
        title={ariaLabel}
      >
        <span className="th-discwrap">
          <span className="th-disc">
            <Glifo item={item} />
            {lograda && <span className="th-sweep" aria-hidden="true"></span>}
          </span>
          <span className="th-bleed" aria-hidden="true"></span>
        </span>
        <span className="th-caption">
          <span className="th-name">{item.nombre}</span>
          {lograda ? (
            <span className="th-meta">
              {item.fecha ? FECHA_CORTA.format(fechaLocal(item.fecha)) : 'conseguido'}
              {item.count != null ? (
                <span className="th-meta--count">
                  {' · '}
                  {item.count.toLocaleString('es-ES')} {item.count === 1 ? 'lo tiene' : 'lo tienen'}
                </span>
              ) : null}
            </span>
          ) : item.count != null ? (
            <span className="th-meta th-meta--count">
              {item.count.toLocaleString('es-ES')} {item.count === 1 ? 'lo tiene' : 'lo tienen'}
            </span>
          ) : (
            <span className="th-meta">pendiente</span>
          )}
        </span>
      </button>
    </div>
  )
}

/**
 * Estantería (una por rareza; la página construye el agrupado).
 */
function MedalShelf({ shelf, logueado, logroDestacado, estampandoId, pendientes, entrada }) {
  const logradas = shelf.items.filter((l) => l.unlocked && !pendientes.has(l.codigo)).length
  const completa = logueado && shelf.items.length > 0 && logradas === shelf.items.length
  // id slug-safe por rareza (los nombres con espacio — "Poco comunes" —
  // producían un id inválido y la sección perdía su nombre accesible)
  const idHead = `th-cat-${shelf.value ?? shelf.name.replace(/\s+/g, '-')}`

  return (
    <section
      className={'th-shelf' + (completa ? ' th-shelf--completa th-shelf--remate' : '')}
      aria-labelledby={idHead}
    >
      <div className="th-shelf__head">
        <span className="th-shelf__kanji" aria-hidden="true" lang="ja">{shelf.kanji}</span>
        <h2 className="th-shelf__name" id={idHead}>{shelf.name}</h2>
        {logueado ? (
          <span className="th-shelf__count">
            {logradas}/{shelf.items.length}
            {completa ? ' · completa' : ''}
          </span>
        ) : null}
      </div>
      {completa && <div className="th-shelf__hairline" aria-hidden="true"></div>}
      <div className="th-shelf__grid">
        {shelf.items.map((l, i) => (
          <Medalla
            key={l.codigo}
            item={l}
            tier={shelf.tier ?? 'bronze'}
            indice={i}
            entrada={entrada}
            estampando={estampandoId === l.codigo}
            sinEstampar={pendientes.has(l.codigo) && estampandoId !== l.codigo}
            destacada={l.codigo === logroDestacado}
          />
        ))}
      </div>
    </section>
  )
}

/**
 * @param {object} props
 * @param {Array<{kanji, name, tier?, items: Array<{codigo, kanji?, Icon?,
 *   nombre, descripcion, unlocked, fecha?, nuevo?, count?}>}>} props.estanterias
 * @param {boolean} [props.logueado=false]  sin sesión = modo escaparate
 *   (todas brillantes, sin contadores propios ni estampado)
 * @param {?string} [props.logroDestacado]  codigo del ?logro= (deep-link)
 * @param {(codigos: string[]) => void} [props.onEstampadosVistos]
 *   fin de la cola de estampado — persistir el registro local
 */
// tope de estampados con ceremonia a la vez: el resto se asienta al instante.
// 5 × 1400ms ≈ 7s de ceremonia como mucho; sin tope, 30 logros = 42s bloqueantes.
const MAX_CEREMONIA = 5

function TrophyHall({ estanterias, logueado = false, logroDestacado = null, onEstampadosVistos }) {
  const { play } = useSound()

  const todos = useMemo(() => estanterias.flatMap((s) => s.items), [estanterias])
  const codigosNuevos = useMemo(
    () => (logueado ? todos.filter((l) => l.nuevo && l.unlocked).map((l) => l.codigo) : []),
    [todos, logueado],
  )
  // clave por CONTENIDO: una query tardía (stats) recalcula `estanterias` y da
  // arrays nuevos con los MISMOS códigos → sin esto el effect haría cleanup y
  // reiniciaría la ceremonia en vuelo. Con la clave, solo re-corre si los
  // códigos cambian de verdad (p.ej. un badge nuevo por WS).
  const nuevosKey = codigosNuevos.join('|')

  // inicializador PURO: con el gate del padre (espera a `mios`), codigosNuevos
  // ya está poblado al montar; el effect concilia los que lleguen después.
  const [pendientes, setPendientes] = useState(() => new Set(codigosNuevos))
  const [estampandoId, setEstampandoId] = useState(null)
  const [anuncio, setAnuncio] = useState('')

  // refs estables (play cambia de identidad con el mute; los callbacks/datos no
  // deben re-disparar ni interrumpir la ceremonia)
  const playRef = useRef(play)
  const onVistosRef = useRef(onEstampadosVistos)
  const todosRef = useRef(todos)
  const yaCeremoniados = useRef(new Set()) // códigos ya estampados esta sesión
  useEffect(() => {
    playRef.current = play
    onVistosRef.current = onEstampadosVistos
    todosRef.current = todos
  })

  useEffect(() => {
    const aCeremoniar = codigosNuevos.filter((c) => !yaCeremoniados.current.has(c))
    if (aCeremoniar.length === 0) return undefined
    aCeremoniar.forEach((c) => yaCeremoniados.current.add(c))
    const porCodigo = new Map(todosRef.current.map((l) => [l.codigo, l]))
    const conCeremonia = aCeremoniar.slice(0, MAX_CEREMONIA)
    const sinCeremonia = aCeremoniar.slice(MAX_CEREMONIA)
    const timers = []
    // siembra siluetas de los que llegan tarde (WS) + asienta al instante el
    // excedente del tope (setState en callback de timer = legal con Compiler)
    timers.push(setTimeout(() => {
      setPendientes((prev) => {
        const s = new Set(prev)
        conCeremonia.forEach((c) => s.add(c))
        sinCeremonia.forEach((c) => s.delete(c))
        return s
      })
    }, 0))
    conCeremonia.forEach((codigo, i) => {
      const t0 = 700 + i * 1400 // 700ms deja asentarse la entrada
      timers.push(setTimeout(() => {
        setEstampandoId(codigo) // arranca th-stamp (380ms) + sangrado + barrido
        playRef.current('playVerdictStamp')
      }, t0))
      timers.push(setTimeout(() => {
        // el contador rueda cuando el sello ya "tocó" la madera
        setPendientes((prev) => {
          const s = new Set(prev)
          s.delete(codigo)
          return s
        })
      }, t0 + 420))
      timers.push(setTimeout(() => {
        const l = porCodigo.get(codigo)
        if (l) setAnuncio(`Logro conseguido: ${l.nombre}. ${l.descripcion}.`)
      }, t0 + 500))
    })
    timers.push(setTimeout(() => {
      // marca vistos TODOS (incl. el excedente sin ceremonia) para no repetir
      onVistosRef.current?.(aCeremoniar)
    }, 700 + conCeremonia.length * 1400))
    return () => timers.forEach(clearTimeout)
    // deps por clave de contenido + refs estables: la ceremonia no se reinicia
    // con queries tardías y solo añade los códigos genuinamente nuevos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nuevosKey])

  const total = todos.length
  const logrados = todos.filter((l) => l.unlocked && !pendientes.has(l.codigo)).length

  return (
    <div className="th-root">
      {/* hall dorado del banco + scrim de legibilidad (capa del propio salón) */}
      {HALL ? (
        <img
          src={HALL.src}
          srcSet={HALL.srcSet}
          sizes="(min-width: 1280px) 1152px, 100vw"
          alt=""
          aria-hidden="true"
          loading="lazy"
          className="th-hallart"
        />
      ) : null}
      <div className="th-hallscrim" aria-hidden="true"></div>
      <span className="th-mark" aria-hidden="true" lang="ja">印</span>
      <header className="th-header">
        <div>
          <h2 className="th-title">Sala de trofeos</h2>
          {logueado && logrados === 0 ? (
            <p className="th-empty">La sala espera tu primer sello. Cada duelo cuenta.</p>
          ) : null}
        </div>
        {logueado ? (
          <div className="th-counter">
            <Odometro valor={logrados} etiqueta={`${logrados} de ${total} logros`} />
            <span className="th-counter__total">/ {total}</span>
          </div>
        ) : null}
      </header>
      {estanterias.map((shelf, ci) => (
        <MedalShelf
          key={shelf.name}
          shelf={shelf}
          logueado={logueado}
          logroDestacado={logroDestacado}
          estampandoId={estampandoId}
          pendientes={pendientes}
          entrada={ci === 0}
        />
      ))}
      <div className="th-vh" aria-live="polite">{anuncio}</div>
    </div>
  )
}

/**
 * Odómetro del contador de sala (fallback sin dependencias — el LiveNumber
 * del repo tiene otro contrato: rAF del número completo + burst de tabla).
 */
function Odometro({ valor, etiqueta }) {
  const digitos = String(valor).split('')
  return (
    <span className="th-odo" role="img" aria-label={etiqueta}>
      {digitos.map((d, i) => (
        <span key={digitos.length - i} className="th-odo__digit" aria-hidden="true">
          <span className="th-odo__reel" style={{ transform: `translateY(-${Number(d)}em)` }}>
            <span>0</span><span>1</span><span>2</span><span>3</span><span>4</span>
            <span>5</span><span>6</span><span>7</span><span>8</span><span>9</span>
          </span>
        </span>
      ))}
    </span>
  )
}

export default TrophyHall
