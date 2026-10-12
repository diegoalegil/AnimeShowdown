import { useEffect, useRef, useState } from 'react'
import { BuscadorPersonajes, Carta, MarcoJuego, PERSONAJES, catalogo } from '../comun/index.js'
import { NOMBRE_ARCHIVO, crearPng } from './imagen.js'
import { HUECOS, NUMERALES, anadir, cartasDe, completo, guardarAltar, leerAltar, mover, ocupados, quitar } from './reglas.js'
import './top5.css'

// En el altar caben personajes y también sus cartas especiales, como adorno.
const CANDIDATAS = [...PERSONAJES, ...catalogo.especiales]

/**
 * Mi Top 5: un altar con cinco peanas numeradas. Se añaden cartas con el
 * buscador, se suben, bajan y quitan, y al completarlo se crea una imagen
 * (1200×630) para compartir. Se guarda en el navegador; no da sobre.
 */
export default function Juego({ juego }) {
  const [altar, setAltar] = useState(leerAltar)
  const [aviso, setAviso] = useState('') // lo que se anuncia al lector de pantalla
  const [recien, setRecien] = useState(null) // id de la carta que acaba de llegar (anima su descenso)
  const [imagen, setImagen] = useState(null) // null | { creando } | { url } | { error }
  const [enfoque, setEnfoque] = useState(null) // { id, accion } a enfocar tras reordenar
  const altarRef = useRef(null)
  const urlRef = useRef(null)

  const cartas = cartasDe(altar)
  const cuantas = ocupados(altar).length
  const lleno = completo(altar)

  // Al soltar la imagen anterior se libera su URL (también al salir de la página).
  function soltarImagen() {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    urlRef.current = null
  }
  useEffect(() => soltarImagen, [])

  // Tras subir o bajar una carta, el foco vuelve a su botón (o al vecino si ese se desactivó).
  useEffect(() => {
    if (!enfoque || !altarRef.current) return
    const peana = altarRef.current.querySelector(`[data-id="${enfoque.id}"]`)
    const boton = peana?.querySelector(`[data-accion="${enfoque.accion}"]`)
    const destino = boton && !boton.disabled ? boton : peana?.querySelector('[data-accion]:not(:disabled)')
    destino?.focus()
  }, [enfoque])

  function cambiar(nuevo) {
    setAltar(nuevo)
    guardarAltar(nuevo)
    soltarImagen()
    setImagen(null)
  }

  function elegir(carta) {
    const { altar: nuevo, puesto, error } = anadir(altar, carta.id)
    if (error) {
      setAviso(error)
      return
    }
    cambiar(nuevo)
    setRecien(carta.id)
    setAviso(`${carta.nombre} añadido al altar, en el puesto ${puesto}.`)
  }

  function desplazar(indice, paso) {
    const id = altar[indice]
    const nuevo = mover(altar, indice, indice + paso)
    if (nuevo === altar) return
    cambiar(nuevo)
    setRecien(null)
    setEnfoque({ id, accion: paso < 0 ? 'subir' : 'bajar' })
    setAviso(`${cartas[indice].nombre} pasa al puesto ${indice + paso + 1}.`)
  }

  function retirar(indice) {
    cambiar(quitar(altar, altar[indice]))
    setRecien(null)
    setAviso(`${cartas[indice].nombre} retirado del altar.`)
  }

  async function crearImagen() {
    if (!lleno || imagen?.creando) return
    setImagen({ creando: true })
    try {
      const blob = await crearPng(cartas)
      soltarImagen()
      urlRef.current = URL.createObjectURL(blob)
      setImagen({ url: urlRef.current })
      setAviso('Imagen lista para descargar.')
    } catch {
      setImagen({ error: 'No se pudo crear la imagen. Prueba otra vez.' })
    }
  }

  const nombres = cartas.filter(Boolean).map((c) => c.nombre)

  return (
    <MarcoJuego
      juego={juego}
      reglas={
        <ol>
          <li>Busca una carta y añádela: ocupa el primer hueco libre.</li>
          <li>Sube, baja o quita cartas hasta dejar el altar a tu gusto. Se guarda en este navegador.</li>
          <li>Con las cinco colocadas, pulsa «Crear imagen» y descarga tu Top 5 para compartirlo.</li>
        </ol>
      }
      estadisticas={[
        { etiqueta: 'En el altar', valor: cuantas },
        { etiqueta: 'Huecos', valor: HUECOS - cuantas },
      ]}
      acciones={
        <button type="button" className="boton boton--principal top5-crear" onClick={crearImagen} aria-disabled={!lleno || undefined} disabled={Boolean(imagen?.creando)}>
          {imagen?.creando ? 'Creando…' : 'Crear imagen'}
        </button>
      }
    >
      <div className="top5-mesa">
        <section className="top5-altar" aria-label="Tu altar" ref={altarRef}>
          <span className="top5-marca" lang="ja" aria-hidden="true">
            誓
          </span>
          <span className="top5-vela top5-vela--izquierda" aria-hidden="true" />
          <span className="top5-vela top5-vela--derecha" aria-hidden="true" />
          <ol className="top5-peanas">
            {altar.map((id, i) => {
              const carta = cartas[i]
              return (
                <li key={id ?? `hueco-${i}`} className="top5-peana" data-puesto={i + 1} data-vacia={carta ? undefined : ''} data-id={id ?? undefined}>
                  <span className="top5-numeral" lang="ja" aria-hidden="true">
                    {NUMERALES[i]}
                  </span>
                  {carta ? (
                    <>
                      <div className="top5-carta" data-llega={recien === id ? '' : undefined}>
                        <Carta carta={carta} tamano="album" enlace={false} cartela={false} prioridad />
                      </div>
                      <p className="top5-nombre">
                        <span className="solo-lectores">Puesto {i + 1}: </span>
                        <strong>{carta.nombre}</strong>
                        <span className="top5-serie">{carta.anime}</span>
                      </p>
                      <div className="top5-mandos" role="group" aria-label={`Mover a ${carta.nombre}`}>
                        <button type="button" className="top5-mando" data-accion="subir" onClick={() => desplazar(i, -1)} disabled={i === 0} aria-label={`Subir a ${carta.nombre} al puesto ${i}`}>
                          <span aria-hidden="true">▲</span>
                        </button>
                        <button type="button" className="top5-mando" data-accion="bajar" onClick={() => desplazar(i, 1)} disabled={!altar[i + 1]} aria-label={`Bajar a ${carta.nombre} al puesto ${i + 2}`}>
                          <span aria-hidden="true">▼</span>
                        </button>
                        <button type="button" className="top5-mando top5-mando--quitar" data-accion="quitar" onClick={() => retirar(i)} aria-label={`Quitar a ${carta.nombre} del altar`}>
                          <span aria-hidden="true">✕</span>
                        </button>
                      </div>
                    </>
                  ) : (
                    <p className="top5-hueco">
                      <span className="solo-lectores">Puesto {i + 1}: </span>libre
                    </p>
                  )}
                </li>
              )
            })}
          </ol>
        </section>

        <div className="top5-panel">
          <BuscadorPersonajes
            onElegir={elegir}
            lista={CANDIDATAS}
            excluir={new Set(ocupados(altar))}
            etiqueta="Añadir al altar"
            placeholder={lleno ? 'El altar está completo' : 'Nombre del personaje o de su serie'}
            desactivado={lleno}
          />
          <p className="juego-aviso" data-tono={lleno ? 'acierto' : undefined}>
            {lleno ? 'Altar completo. Ya puedes crear tu imagen.' : `Faltan ${HUECOS - cuantas} ${HUECOS - cuantas === 1 ? 'carta' : 'cartas'} para completar tu Top 5.`}
          </p>
          <p className="solo-lectores" aria-live="polite">
            {aviso}
          </p>
        </div>

        {imagen && !imagen.creando && (
          <section className="top5-salida" aria-label="Tu imagen">
            {imagen.url ? (
              <>
                <img className="top5-vista" src={imagen.url} width="1200" height="630" alt={`Vista previa de tu Top 5: ${nombres.join(', ')}.`} />
                <div className="juego-fila">
                  <a className="boton boton--principal" href={imagen.url} download={NOMBRE_ARCHIVO}>
                    Descargar PNG
                  </a>
                  <button type="button" className="boton" onClick={crearImagen}>
                    Volver a crear
                  </button>
                </div>
              </>
            ) : (
              <p className="juego-aviso" data-tono="fallo" role="alert">
                {imagen.error}
              </p>
            )}
          </section>
        )}
      </div>
    </MarcoJuego>
  )
}
