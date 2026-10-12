import { useEffect, useMemo, useRef, useState } from 'react'
import { Carta, Enlace, Hanko, MarcoJuego, diaLocal, movimientoReducido, terminarRonda, useProgresoJuego } from '../comun/index.js'
import { guardarEstado, leerEstado } from './almacen.js'
import { SUERTES, fortunaDelDia, porcentaje, textoCompartir } from './reglas.js'
import {
  ASENTAMIENTO_S,
  AUTO_S,
  amplitudTras,
  anguloAgitando,
  anguloAsentando,
  faseEn,
  fuerzaDe,
  posturaDe,
} from './ritual.js'
import './omikuji.css'

/** Un toque más corto que esto se toma por «agítalo tú»: el cilindro se agita solo. */
const TOQUE_CORTO_S = 0.24
const CARAS = [0, 1, 2, 3, 4, 5]

const FASES_TEXTO = {
  reposo: 'El cilindro descansa. Mantén pulsado para agitarlo y suéltalo para sacar tu varilla.',
  agitando: 'Agitando el cilindro…',
  asentando: 'El cilindro se asienta.',
  cayendo: 'Cae una varilla.',
  desplegando: 'Se despliega el papel…',
}

/** Milisegundos hasta la próxima medianoche local (para estrenar varilla). */
function msHastaMedianoche(ahora = new Date()) {
  const manana = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + 1)
  return manana.getTime() - ahora.getTime()
}

/**
 * Omikuji: la suerte del día. Se agita el cilindro (mantener pulsado, un
 * toque corto o Intro), cae una varilla numerada y se despliega el papel con
 * la fortuna, un consejo y el personaje guardián. La misma fortuna todo el
 * día para este navegador; a medianoche hay otra. Sin sobre: es un ritual.
 */
export default function Juego({ juego }) {
  const progreso = useProgresoJuego(juego.slug)
  const [dia, setDia] = useState(() => diaLocal())
  const [estado, setEstado] = useState(() => leerEstado())
  const fortuna = useMemo(() => fortunaDelDia(dia, estado.sal), [dia, estado.sal])

  // La fase va atada al día: si cambia el día a mitad, se vuelve al reposo.
  const [ritual, setRitual] = useState(() => ({ dia, fase: estado.revelado === dia ? 'revelado' : 'reposo' }))
  const fase = ritual.dia === dia ? ritual.fase : estado.revelado === dia ? 'revelado' : 'reposo'
  const faseRef = useRef(fase) // la fase que ven los manejadores y el bucle de animación
  useEffect(() => {
    faseRef.current = fase
  }, [fase])
  const cambiarFase = (nueva) => {
    faseRef.current = nueva
    setRitual({ dia, fase: nueva })
  }

  const cilindro = useRef(null)
  const medidor = useRef(null)
  const panel = useRef(null)
  const bucle = useRef(0) // id del requestAnimationFrame en curso
  const inicio = useRef(0) // performance.now() al empezar a agitar
  const auto = useRef(false) // true si se suelta solo al cumplir AUTO_S
  const enfocar = useRef(false) // enfocar el papel al revelarlo (no al cargar ya revelado)
  const [copiado, setCopiado] = useState(false)

  function pintar(angulo, fuerza) {
    const { rz, rx, tx } = posturaDe(angulo)
    const nodo = cilindro.current
    if (nodo) {
      nodo.style.setProperty('--omikuji-rz', `${rz.toFixed(2)}deg`)
      nodo.style.setProperty('--omikuji-rx', `${rx.toFixed(2)}deg`)
      nodo.style.setProperty('--omikuji-tx', `${tx.toFixed(2)}px`)
    }
    if (medidor.current && fuerza !== undefined) medidor.current.style.setProperty('--omikuji-fuerza', fuerza.toFixed(3))
  }

  function parar() {
    if (bucle.current) cancelAnimationFrame(bucle.current)
    bucle.current = 0
  }

  function revelar() {
    parar()
    pintar(0, 0)
    if (faseRef.current === 'revelado') return
    enfocar.current = true
    cambiarFase('revelado')
    const siguiente = { ...estado, revelado: dia }
    setEstado(siguiente)
    guardarEstado(siguiente)
    // Sin recompensa: solo cuenta la consulta (las de buena suerte, como ganadas, por gusto).
    terminarRonda(juego, { ganada: fortuna.suerte.clave !== 'kyo' })
  }

  function soltar() {
    if (faseRef.current !== 'agitando') return
    parar()
    const t0 = (performance.now() - inicio.current) / 1000
    const a0 = amplitudTras(t0)
    const fase0 = faseEn(t0)
    const desde = performance.now()
    cambiarFase('asentando')
    const paso = () => {
      const t = (performance.now() - desde) / 1000
      if (t >= ASENTAMIENTO_S) {
        pintar(0)
        bucle.current = 0
        cambiarFase('cayendo')
        return
      }
      pintar(anguloAsentando(t, a0, fase0))
      bucle.current = requestAnimationFrame(paso)
    }
    bucle.current = requestAnimationFrame(paso)
  }

  function agitar(esAuto) {
    if (faseRef.current !== 'reposo') return
    if (movimientoReducido()) {
      revelar()
      return
    }
    auto.current = esAuto
    inicio.current = performance.now()
    cambiarFase('agitando')
    const paso = () => {
      const t = (performance.now() - inicio.current) / 1000
      pintar(anguloAgitando(t), fuerzaDe(amplitudTras(t)))
      if (auto.current && t >= AUTO_S) {
        soltar()
        return
      }
      bucle.current = requestAnimationFrame(paso)
    }
    bucle.current = requestAnimationFrame(paso)
  }

  /** Un toque durante la caída o el despliegue salta al revelado. */
  function saltar() {
    const actual = faseRef.current
    if (actual === 'cayendo' || actual === 'desplegando') revelar()
  }

  function alPulsar(evento) {
    if (evento.button !== undefined && evento.button !== 0) return
    if (faseRef.current === 'reposo') {
      evento.currentTarget.setPointerCapture?.(evento.pointerId)
      agitar(false)
    } else {
      saltar()
    }
  }

  function alSoltar() {
    if (faseRef.current !== 'agitando') return
    const mantenido = (performance.now() - inicio.current) / 1000
    if (mantenido < TOQUE_CORTO_S) auto.current = true // toque corto: se agita solo
    else soltar()
  }

  function alTecla(evento) {
    if (evento.key !== 'Enter' && evento.key !== ' ') return
    evento.preventDefault()
    if (evento.repeat) return
    if (faseRef.current === 'reposo') agitar(true)
    else saltar()
  }

  async function compartir() {
    try {
      await navigator.clipboard.writeText(textoCompartir(fortuna))
      setCopiado(true)
    } catch {
      setCopiado(false)
    }
  }

  // Al revelar (no al cargar ya revelado), el foco pasa al papel.
  useEffect(() => {
    if (fase === 'revelado' && enfocar.current) {
      enfocar.current = false
      panel.current?.focus({ preventScroll: true })
      panel.current?.scrollIntoView?.({ block: 'nearest', behavior: movimientoReducido() ? 'auto' : 'smooth' })
    }
  }, [fase])

  // Medianoche y vuelta a la pestaña: estrenar día. Pestaña oculta a mitad del agitado: al reposo.
  useEffect(() => {
    const temporizador = setTimeout(() => setDia(diaLocal()), msHastaMedianoche() + 50)
    const alVisibilidad = () => {
      if (document.hidden) {
        if (faseRef.current === 'agitando' || faseRef.current === 'asentando') {
          parar()
          pintar(0, 0)
          faseRef.current = 'reposo'
          setRitual({ dia, fase: 'reposo' })
        }
        return
      }
      const hoy = diaLocal()
      if (hoy !== dia) setDia(hoy)
    }
    document.addEventListener('visibilitychange', alVisibilidad)
    return () => {
      clearTimeout(temporizador)
      document.removeEventListener('visibilitychange', alVisibilidad)
      parar()
    }
  }, [dia])

  const revelado = fase === 'revelado'
  const enMarcha = fase !== 'reposo' && !revelado
  const reducido = movimientoReducido()
  const { suerte, numero, consejo, guardian } = fortuna

  return (
    <MarcoJuego
      juego={juego}
      estadisticas={[
        { etiqueta: 'Suerte de hoy', valor: revelado ? suerte.kanji : '—' },
        { etiqueta: 'Consultas', valor: progreso.jugadas },
      ]}
      reglas={
        <ol>
          <li>Mantén pulsado el cilindro para agitarlo con fuerza y suéltalo: cae una varilla numerada.</li>
          <li>Un toque corto o la tecla Intro lo agitan solo.</li>
          <li>El papel trae la suerte del día, un consejo y tu personaje guardián.</li>
          <li>Hay una fortuna al día: a medianoche se estrena otra. No da sobre: es un ritual.</li>
        </ol>
      }
      acciones={
        revelado && (
          <button type="button" className="boton" onClick={compartir}>
            {copiado ? 'Copiado' : 'Compartir la suerte'}
          </button>
        )
      }
    >
      <div className="omikuji-mesa" data-fase={fase} data-tono={suerte.tono}>
        <section className="omikuji-santuario" aria-label="El cilindro de las varillas">
          <button
            type="button"
            className="omikuji-cilindro-boton"
            aria-label={revelado ? 'Cilindro de omikuji: la fortuna de hoy ya está revelada' : 'Agitar el cilindro'}
            disabled={revelado}
            onPointerDown={alPulsar}
            onPointerUp={alSoltar}
            onPointerCancel={alSoltar}
            onKeyDown={alTecla}
            onContextMenu={(e) => e.preventDefault()}
          >
            <span className="omikuji-cilindro" ref={cilindro} aria-hidden="true">
              <span className="omikuji-tapa omikuji-tapa--arriba" />
              <span className="omikuji-prisma">
                {CARAS.map((i) => (
                  <span key={i} className="omikuji-cara" data-cara={i} style={{ '--i': i }}>
                    {i === 0 && (
                      <span className="omikuji-cara-kanji" lang="ja">
                        <span>御</span>
                        <span>神</span>
                        <span>籤</span>
                      </span>
                    )}
                  </span>
                ))}
              </span>
              <span className="omikuji-tapa omikuji-tapa--abajo" />
            </span>
          </button>

          <div className="omikuji-medidor" ref={medidor} aria-hidden="true">
            <span className="omikuji-medidor-barra" />
            <span className="omikuji-medidor-texto">fuerza</span>
          </div>

          <div className="omikuji-boca" aria-hidden="true">
            <span
              className="omikuji-varilla"
              onAnimationEnd={() => {
                if (faseRef.current === 'cayendo') cambiarFase('desplegando')
              }}
            >
              <span className="omikuji-varilla-numero cifra">{numero}</span>
            </span>
          </div>

          <div
            className="omikuji-papelito"
            aria-hidden="true"
            onAnimationEnd={() => {
              if (faseRef.current === 'desplegando') revelar()
            }}
          >
            <span className="omikuji-papelito-cabecera" lang="ja">
              御神籤
            </span>
            <span className="omikuji-papelito-kanji" lang="ja">
              {suerte.kanji}
            </span>
            <span className="omikuji-papelito-numero cifra">第 {numero} 番</span>
          </div>

          <p className="omikuji-guia">{revelado ? 'Vuelve mañana: a medianoche hay otra varilla.' : FASES_TEXTO[fase]}</p>
          {reducido && !revelado && !enMarcha && (
            <button type="button" className="boton boton--principal omikuji-revelar" onClick={revelar}>
              Revelar la fortuna
            </button>
          )}
          {enMarcha && (
            <button type="button" className="boton-texto omikuji-saltar" onClick={saltar}>
              Saltar al papel
            </button>
          )}
          <p className="solo-lectores" aria-live="polite">
            {revelado ? `Fortuna revelada: ${suerte.kanji}, ${suerte.nombre}, varilla ${numero}.` : enMarcha ? FASES_TEXTO[fase] : ''}
          </p>
        </section>

        {revelado && (
          <section ref={panel} className="omikuji-papel" tabIndex={-1} aria-labelledby="omikuji-suerte">
            <Hanko kanji="御" forma="redondo" className="omikuji-papel-sello" />
            <p className="rotulo omikuji-papel-rotulo">
              <span lang="ja">お御籤</span> · <span className="cifra">第 {numero} 番</span>
            </p>
            <h2 id="omikuji-suerte" className="omikuji-papel-kanji" lang="ja">
              {suerte.kanji}
            </h2>
            <p className="omikuji-papel-nombre">
              <span className="omikuji-papel-romaji">{suerte.romaji}</span> · {suerte.nombre}
            </p>
            <p className="omikuji-papel-texto">{suerte.texto}</p>
            <p className="omikuji-papel-consejo">
              <span className="rotulo">Consejo del día</span>
              {consejo}
            </p>

            <div className="omikuji-guardian">
              <p className="rotulo omikuji-guardian-rotulo">
                <span lang="ja" aria-hidden="true">
                  守
                </span>{' '}
                Personaje guardián del día
              </p>
              <Carta carta={guardian} tamano="sobre" prioridad className="omikuji-guardian-carta" />
            </div>

            <p className="omikuji-papel-pie">
              {suerte.clave === 'kyo'
                ? 'Por tradición, el 凶 se ata a un pino (松, matsu: «esperar») y se deja en el santuario. Mañana hay otra varilla.'
                : 'Guarda este papel contigo hasta medianoche: entonces hay otra varilla.'}{' '}
              <Enlace to="/sobres" className="enlace-oro">
                Abrir un sobre
              </Enlace>
            </p>
          </section>
        )}
      </div>

      <section className="omikuji-tabla" aria-labelledby="omikuji-tabla-titulo">
        <h2 id="omikuji-tabla-titulo" className="rotulo omikuji-tabla-titulo">
          Las cinco suertes
        </h2>
        <ol className="omikuji-suertes">
          {SUERTES.map((s) => (
            <li
              key={s.clave}
              className="omikuji-suerte"
              data-tono={s.tono}
              aria-current={revelado && s === suerte ? 'true' : undefined}
            >
              <span className="omikuji-suerte-kanji" lang="ja">
                {s.kanji}
              </span>
              <span className="omikuji-suerte-nombre">
                {s.nombre}
                <span className="omikuji-suerte-romaji">{s.romaji}</span>
              </span>
              <span className="omikuji-suerte-peso cifra">{porcentaje(s)} %</span>
            </li>
          ))}
        </ol>
      </section>
    </MarcoJuego>
  )
}
