import { useId, useMemo, useRef, useState } from 'react'
import { recuento, textoRecuento } from '../lib/album.js'
import { aplicarImportacion, cartasDistintas, exportar, previsionImportacion } from '../lib/collection.js'
import { coleccion, useColeccion } from '../lib/useCollection.js'
import { EtiquetaVertical } from './EtiquetaVertical.jsx'

const cartas = (n) => `${n} ${n === 1 ? 'carta' : 'cartas'}`

/**
 * Copia de la colección: el código para llevarla a otro navegador y el
 * formulario para pegar uno. Importar siempre pide confirmación y deja
 * elegir entre combinar con la colección actual o sustituirla.
 */
export function PanelCodigo() {
  const estado = useColeccion()
  const { tengo, desde } = estado
  const codigo = useMemo(() => exportar({ tengo, desde }), [tengo, desde])
  const actuales = cartasDistintas(estado)

  return (
    <section id="codigo" className="codigo" aria-labelledby="codigo-titulo">
      <div className="wrap">
        <header className="codigo-cabecera">
          <EtiquetaVertical ja="控え" className="codigo-tate" />
          <div className="min-w-0">
            <h2 id="codigo-titulo" className="codigo-titulo">
              Tu colección, en un código
            </h2>
            <p className="codigo-intro">
              Tu colección se guarda en este navegador. Si borras sus datos o cambias de dispositivo, no la verás:
              guarda este código para recuperarla o llevarla a otro sitio.
            </p>

            <div className="codigo-rejilla">
              <Exportar codigo={codigo} tengo={tengo} actuales={actuales} />
              <Importar estado={estado} actuales={actuales} />
            </div>
          </div>
        </header>
      </div>
    </section>
  )
}

function Exportar({ codigo, tengo, actuales }) {
  const campo = useRef(null)
  const [aviso, setAviso] = useState(null)

  async function copiar() {
    try {
      await navigator.clipboard.writeText(codigo)
      setAviso({ ok: true, texto: 'Código copiado.' })
    } catch {
      // Sin permiso para el portapapeles: se deja seleccionado para copiarlo a mano.
      campo.current?.select()
      setAviso({ ok: false, texto: 'No se pudo copiar solo. El código está seleccionado: cópialo con Ctrl+C o ⌘C.' })
    }
  }

  return (
    <div className="codigo-bloque">
      <h3 className="codigo-subtitulo">Copiar tu código</h3>
      {!actuales && <p className="codigo-texto">Cuando consigas cartas, aquí tendrás el código de tu colección.</p>}
      {actuales > 0 && (
        <>
          <p className="codigo-texto">
            Guarda tu colección ({textoRecuento(recuento(tengo), { total: false })}). El código no incluye los sobres
            del día.
          </p>
          <textarea
            ref={campo}
            className="codigo-campo cifra"
            value={codigo}
            readOnly
            rows={4}
            spellCheck="false"
            aria-label="Código de tu colección"
            onFocus={(e) => e.target.select()}
          />
          <div className="codigo-acciones">
            <button type="button" className="boton-sumi" onClick={copiar}>
              Copiar código
            </button>
            <p className="codigo-aviso" data-ok={aviso?.ok || undefined} role="status" aria-live="polite">
              {aviso?.texto}
            </p>
          </div>
        </>
      )}
    </div>
  )
}

function Importar({ estado, actuales }) {
  const idError = useId()
  const confirmacion = useRef(null)
  const [texto, setTexto] = useState('')
  // null | { error } | { leido } (esperando confirmación) | { hecho }
  const [paso, setPaso] = useState(null)

  function revisar(evento) {
    evento.preventDefault()
    const leido = coleccion.comprobar(texto)
    if (!leido.ok) {
      setPaso({ error: leido.error })
      return
    }
    setPaso({ leido })
    // La confirmación aparece en el siguiente render; el foco va a ella.
    requestAnimationFrame(() => confirmacion.current?.focus())
  }

  function aplicar(modo) {
    const resultado = coleccion.importar(texto, modo)
    if (!resultado.ok) {
      setPaso({ error: resultado.error })
      return
    }
    setTexto('')
    setPaso({ hecho: textoRecuento(recuento(coleccion.getSnapshot().tengo), { total: false }) })
  }

  const leido = paso?.leido
  const prevision = leido && previsionImportacion(estado, leido)

  return (
    <div className="codigo-bloque">
      <h3 className="codigo-subtitulo">Pegar un código</h3>
      <p className="codigo-texto">Para recuperar tu colección o traerla desde otro navegador.</p>
      <form onSubmit={revisar}>
        <textarea
          className="codigo-campo cifra"
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value)
            if (paso) setPaso(null)
          }}
          rows={4}
          spellCheck="false"
          autoComplete="off"
          placeholder="Pega aquí el código"
          aria-label="Código para importar"
          aria-invalid={paso?.error ? true : undefined}
          aria-describedby={paso?.error ? idError : undefined}
        />
        <div className="codigo-acciones">
          <button type="submit" className="enlace-tinta" disabled={!texto.trim()}>
            Revisar código
          </button>
          {paso?.error && (
            <p id={idError} className="codigo-aviso codigo-aviso--error" role="alert">
              {paso.error}
            </p>
          )}
          {paso?.hecho !== undefined && (
            <p className="codigo-aviso" data-ok="" role="status">
              Listo: tu colección tiene ahora {paso.hecho}.
            </p>
          )}
        </div>
      </form>

      {prevision && (
        <div ref={confirmacion} className="confirmar" tabIndex={-1} role="group" aria-labelledby="confirmar-titulo">
          <p id="confirmar-titulo" className="confirmar-titulo">
            Este código trae {textoRecuento(recuento(leido.tengo), { total: false })}.
          </p>
          <p className="confirmar-texto">
            {leido.descartadas > 0 &&
              `${cartas(leido.descartadas)} del código ya no ${leido.descartadas === 1 ? 'existe' : 'existen'} y se ${leido.descartadas === 1 ? 'omite' : 'omiten'}. `}
            {actuales
              ? `Ahora tienes ${textoRecuento(recuento(estado.tengo), { total: false })}. Puedes combinar las dos colecciones o sustituir la tuya por la del código.`
              : 'Tu colección está vacía: pasará a ser la del código.'}
          </p>
          <div className="confirmar-acciones">
            {actuales ? (
              <>
                <button type="button" className="boton-sumi" onClick={() => aplicar('combinar')}>
                  Combinar ({textoRecuento(recuento(aplicarImportacion(estado, leido, 'combinar').tengo), { total: false })})
                </button>
                <button type="button" className="enlace-tinta" onClick={() => aplicar('sustituir')}>
                  Sustituir la mía
                </button>
              </>
            ) : (
              <button type="button" className="boton-sumi" onClick={() => aplicar('sustituir')}>
                Importar
              </button>
            )}
            <button type="button" className="boton-simple" onClick={() => setPaso(null)}>
              Cancelar
            </button>
          </div>
          {actuales > 0 && (
            <p className="confirmar-nota">
              Al sustituir, las cartas que no estén en el código se pierden. Combinar conserva todas: de cada carta, el
              mayor número de copias.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
