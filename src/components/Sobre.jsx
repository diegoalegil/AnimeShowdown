import { useEffect } from 'react'
import { CARTAS_POR_SOBRE, SOBRES_POR_DIA } from '../config.js'
import { urlPublica } from '../lib/images.js'
import { Logo } from './Logo.jsx'

// La cara del sobre aplanada que llevan las piezas al rasgarse (ver SobreRasgado).
const CARA = urlPublica('sobre-cara.webp')
let cara = null

/** Descarga y decodifica la cara antes de abrir: así las piezas nunca llegan vacías. */
function precargarCara() {
  if (cara) return
  cara = new Image()
  cara.src = CARA
  cara.decode().catch(() => {})
}

// ---------------------------------------------------------------------------
// Formas del envoltorio: bordes dentados arriba y abajo (el cierre prensado
// de un sobre) y las líneas de rasgado. Son polígonos fijos, calculados una
// vez al cargar el módulo con un generador determinista: nada cambia de un
// render a otro ni se anima (solo se mueven las piezas con transform).
// ---------------------------------------------------------------------------

function pseudoAzar(semilla) {
  let a = semilla
  return () => {
    a = (a * 16807) % 2147483647
    return a / 2147483647
  }
}

const pct = (n) => `${Number(n.toFixed(2))}%`
const punto = ([x, y]) => `${pct(x)} ${pct(y)}`

/** Dientes del cierre prensado: n dientes de alto h en el borde y = base. */
function dientes(n, base, h, haciaAbajo) {
  const puntos = []
  for (let i = 0; i <= n; i++) {
    const x = (i / n) * 100
    puntos.push([x, base])
    if (i < n) puntos.push([x + 50 / n, haciaAbajo ? base + h : base - h])
  }
  return puntos
}

/** Línea rasgada de (x0, y0) a (x1, y1) con pequeñas irregularidades. */
function rasgado(desde, hasta, pasos, amplitud, semilla) {
  const azar = pseudoAzar(semilla)
  const [x0, y0] = desde
  const [x1, y1] = hasta
  const puntos = [desde]
  // Perpendicular unitaria (en unidades de porcentaje, suficiente aquí).
  const largo = Math.hypot(x1 - x0, y1 - y0)
  const [nx, ny] = [-(y1 - y0) / largo, (x1 - x0) / largo]
  for (let i = 1; i < pasos; i++) {
    const t = i / pasos
    const desvio = (azar() - 0.5) * 2 * amplitud
    puntos.push([x0 + (x1 - x0) * t + nx * desvio, y0 + (y1 - y0) * t + ny * desvio])
  }
  puntos.push(hasta)
  return puntos
}

const DIENTES = 26
const ALTO_DIENTE = 1.1
// Muescas en V a los dos lados de la línea de rasgado, para tirar de ahí.
const MUESCA = 2.6
const CIERRE_DIENTES = [
  ...dientes(DIENTES, ALTO_DIENTE, ALTO_DIENTE, false),
  [100, 12 - 1.2],
  [100 - MUESCA, 12],
  [100, 12 + 1.2],
  ...dientes(DIENTES, 100 - ALTO_DIENTE, ALTO_DIENTE, true).reverse(),
  [0, 12 + 1.2],
  [MUESCA, 12],
  [0, 12 - 1.2],
]

// La tira de arriba se rasga por la línea de puntos (12 %); el cuerpo se
// abre por el centro, de arriba abajo.
const CORTE_Y = 12
const CORTE_TIRA = rasgado([0, CORTE_Y], [100, CORTE_Y], 24, 0.55, 7)
const MITAD = rasgado([50, CORTE_Y], [51, 100], 20, 2.2, 31)
// El punto x = 50 de la tira pertenece a las dos mitades: así casan.
const TIRA_IZQ = CORTE_TIRA.filter(([x]) => x <= 50)
const TIRA_DER = CORTE_TIRA.filter(([x]) => x >= 50)
const poligono = (puntos) => `polygon(${puntos.map((p) => (typeof p === 'string' ? p : punto(p))).join(', ')})`

export const PIEZAS = {
  tira: poligono(['0% 0%', '100% 0%', ...[...CORTE_TIRA].reverse()]),
  izquierda: poligono([...TIRA_IZQ, ...MITAD, '0% 100%']),
  derecha: poligono([...TIRA_DER, '100% 100%', ...[...MITAD].reverse()]),
}

const CIERRE = poligono(CIERRE_DIENTES)

// ---------------------------------------------------------------------------
// Envoltorio
// ---------------------------------------------------------------------------

/**
 * La cara del sobre: lámina carmesí casi negra con olas (seigaiha) en oro,
 * los cierres prensados dorados, la tira de apertura, un marco dorado doble
 * como el de las cartas SSR con la ilustración del sobre y la marca. Solo
 * elementos en línea (va dentro de un botón). `numero` es el sobre del día
 * (1..5).
 */
export function Envoltorio({ numero }) {
  return (
    <span className="envoltorio" style={{ clipPath: CIERRE }}>
      <span className="envoltorio-motivo" />
      <span className="envoltorio-lamina" />
      <span className="envoltorio-cierre envoltorio-cierre--arriba" />
      <span className="envoltorio-cierre envoltorio-cierre--abajo" />
      <span className="envoltorio-tira">
        <span lang="ja" className="envoltorio-kaifu">
          開封口
        </span>
        <span className="envoltorio-flecha" />
      </span>
      <span className="envoltorio-corte" />
      <span className="envoltorio-marco" />
      <Numero numero={numero} />
      <span className="envoltorio-arte" />
      <span className="envoltorio-obi">
        <span className="envoltorio-marca">
          Anime<span className="envoltorio-oro">Showdown</span>
        </span>
        <span className="envoltorio-contenido">
          {CARTAS_POR_SOBRE} cartas
          <span lang="ja" className="envoltorio-mai">
            五枚入り
          </span>
        </span>
      </span>
    </span>
  )
}

/** «Nº 02 / 05»: qué sobre del día es. */
function Numero({ numero }) {
  return (
    <span className="envoltorio-numero cifra">
      Nº {String(numero).padStart(2, '0')}
      <span className="envoltorio-de"> / {String(SOBRES_POR_DIA).padStart(2, '0')}</span>
    </span>
  )
}

/** El sello 滅 de la marca en un medallón con filo dorado: cierra el sobre. */
function Sello() {
  return (
    <span className="sobre-sello">
      <Logo tamano={72} className="sobre-sello-logo" prioridad />
    </span>
  )
}

/**
 * El sobre cerrado, listo para abrir: todo él es el botón. Se inclina hacia
 * el puntero como las cartas y entra en escena una vez al montarse, con un
 * reflejo que recorre la lámina.
 */
export function SobreCerrado({ numero, otro, onAbrir }) {
  const accion = otro ? 'Abrir otro sobre' : 'Abrir sobre'
  useEffect(precargarCara, [])
  return (
    <button
      type="button"
      className="sobre"
      onClick={onAbrir}
      aria-label={`${accion} (${numero} de ${SOBRES_POR_DIA} de hoy)`}
    >
      <span className="sobre-caja">
        <span className="sobre-halo" />
        <span className="sobre-sombra" />
        <span className="sobre-cuerpo" data-inclinar="">
          <Envoltorio numero={numero} />
          <Sello />
          <span className="sobre-barrido" />
          <span className="carta-brillo" />
        </span>
      </span>
      <span className="sobre-accion">
        <span className="sobre-accion-texto">{accion}</span>
        <span className="sobre-accion-tecla">Intro</span>
      </span>
    </button>
  )
}

/**
 * El sobre mientras se rasga: la misma cara recortada en tres piezas (la
 * tira y dos mitades), el sello partido en dos y la luz que sale de dentro:
 * un destello en la línea de rasgado y, detrás de las hojas, un halo con un
 * abanico de rayos (un solo plano). Lo anima lib/coreografia.
 *
 * Cada pieza no lleva una copia del envoltorio sino su imagen aplanada
 * (public/sobre-cara.webp, ver scripts/generate-sobre.mjs): una sola imagen
 * por pieza es lo que Safari puede repintar a 60 fps mientras giran. Encima,
 * las dos mitades llevan el número del sobre, que no va en la imagen.
 */
export function SobreRasgado({ numero }) {
  return (
    <div className="sobre sobre--rasgado" aria-hidden="true">
      <span className="sobre-caja" data-pieza="caja">
        <span className="sobre-sombra" data-pieza="sombra" />
        <span className="sobre-luz" data-pieza="luz" />
        {['tira', 'izquierda', 'derecha'].map((pieza) => (
          <span key={pieza} className={`sobre-pieza sobre-pieza--${pieza}`} data-pieza={pieza} style={{ clipPath: PIEZAS[pieza] }}>
            {pieza !== 'tira' && <Numero numero={numero} />}
          </span>
        ))}
        <span className="sobre-sello-mitad sobre-sello-mitad--izquierda" data-pieza="sello-izquierda">
          <Sello />
        </span>
        <span className="sobre-sello-mitad sobre-sello-mitad--derecha" data-pieza="sello-derecha">
          <Sello />
        </span>
        <span className="sobre-grieta" data-pieza="grieta" />
      </span>
    </div>
  )
}
