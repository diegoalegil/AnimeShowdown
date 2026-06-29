import { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import InkComposer from './InkComposer.jsx'
import VoiceStrip from './VoiceStrip.jsx'
import { reducedMotion, flyGhost, stripRotation } from './voiceWallUtils.js'
import './voice-wall.css'

/** Ids del nivel raíz (el muro real no anida). Pura. */
function collectIds(voices, into) {
  const set = into || new Set()
  for (const v of voices || []) set.add(v.id)
  return set
}

/**
 * EL MURO DE VOCES — bloque de comentarios de AnimeShowdown.
 *
 * Acotado al backend REAL de comentarios (sin features que la API no tiene):
 * - Lista PLANA (sin hilos): `allowReplies` queda apagado y cada voz lleva
 *   `replies: []`. El árbol de respuestas NO se renderiza.
 * - SIN reacciones: `reactionCatalog` vacío y cada voz `reactions: []`. La
 *   UI de hanko se oculta limpiamente.
 * - La acción por-voz es REPORTAR (el repo no expone borrado de muro):
 *   `onReport(voiceId)` dispara la mutation. El backend manda el comentario a
 *   moderación (PENDIENTE_REVISION), así que en el siguiente refetch deja el
 *   muro público; el feedback (toast) lo emite el contenedor.
 * - Scroll infinito: lo gobierna el contenedor (este muro solo pinta lo que
 *   le pasan en `voices`).
 *
 * @param {object} props
 * @param {Voice[]} props.voices — lista del server, en el ORDEN en que debe
 *   pintarse (el muro no reordena). Cada voz: { id, author: {id, name,
 *   avatarUrl?}, timeLabel (string YA formateado — regla Compiler: aquí no
 *   se llama a Date.now()), text, reactions: [], replies: [] }.
 * @param {{id, name, avatarUrl?}|null} [props.currentUser] — null => invitado
 *   (formulario sellado con CTA al dojo).
 * @param {number} [props.maxLength] — límite real de la API (contador del pincel).
 * @param {string} [props.dojoHref] — destino del CTA de invitado.
 * @param {(text: string, opts: {parentId: string|null}) => Promise<{id} & object>}
 *   props.onPublish — POST del comentario (parentId siempre null). La voz
 *   nueva es optimista: si la promesa rechaza, la tira vuelve al pincel con
 *   el texto INTACTO.
 * @param {(voiceId) => Promise|void} [props.onReport] — reporta la voz al dojo.
 *   El feedback (éxito/fallo) lo emite el contenedor; al confirmar, el
 *   comentario pasa a moderación y deja el muro público en el siguiente refetch.
 * @param {object|null} [props.sounds] — adaptador de lib/sounds.js vía
 *   SoundContext: { playWhoosh, playSello, playClink, playClack }. Todos
 *   opcionales; el muro nunca suena por su cuenta si faltan.
 * @param {string} [props.title]
 * @param {React.ReactNode} [props.footer] — slot del contenedor (sentinel del
 *   scroll infinito + spinner de carga de más páginas).
 * @param {boolean} [props.pending] — el contenedor carga la primera página:
 *   suprime el estado vacío hasta tener datos (evita el flash del CTA "Sé la
 *   primera voz" en fichas que sí tienen comentarios).
 */
export default function VoiceWall({
  voices,
  currentUser = null,
  maxLength,
  dojoHref = '#',
  onPublish,
  onReport,
  sounds = null,
  title = 'El muro de voces',
  footer = null,
  pending = false,
  isError = false,
}) {
  const [localVoices, setLocalVoices] = useState([]) // optimistas + confirmadas aún no presentes en props
  const [pendingFlight, setPendingFlight] = useState(null) // { id, from }
  const [settlingId, setSettlingId] = useState(null)
  const [weldId, setWeldId] = useState(null)
  const [restore, setRestore] = useState(null) // { text, error, token } para el pincel
  const [statusMsg, setStatusMsg] = useState('')
  const [initialIds] = useState(() => collectIds(voices)) // inicializador puro

  const stripNodes = useRef(new Map())
  const composerPaperRef = useRef(null)
  const seqRef = useRef(0)
  const failAnimRef = useRef(null) // vuelo de regreso (fallo) en curso, para cancelarlo al desmontar

  // Re-anuncia aunque la cadena se repita: aria-live no relee texto idéntico,
  // así que dos fallos seguidos con el mismo mensaje no se anunciarían sin esto.
  const announce = useCallback((msg) => {
    setStatusMsg('')
    requestAnimationFrame(() => setStatusMsg(msg))
  }, [])

  // Reconciliación cuando el server refresca `voices`: ajuste durante el
  // render con guard (canónico Compiler). Cualquier refetch es la fuente de
  // verdad: las confirmadas locales se descartan (las visibles ya vienen en
  // props; las que el moderador retuvo NO vuelven y no deben quedar de ghost).
  const [prevVoices, setPrevVoices] = useState(voices)
  if (prevVoices !== voices) {
    setPrevVoices(voices)
    setLocalVoices((prev) => prev.filter((v) => v.status !== 'confirmed'))
  }

  const registerNode = useCallback((id, el) => {
    if (el) stripNodes.current.set(id, el)
    else stripNodes.current.delete(id)
  }, [])

  /* ---------- Publicar (optimista + vuelo FLIP) ---------- */

  const handleComposerSubmit = useCallback(
    (text) => {
      seqRef.current += 1
      const id = 'vw-local-' + seqRef.current
      const calm = reducedMotion()
      const optimistic = {
        id,
        status: 'pending',
        fresh: calm, // sin vuelo: aparece directa con la animación de entrada
        author: currentUser,
        timeLabel: 'ahora',
        text,
        reactions: [],
        replies: [],
      }
      setLocalVoices((prev) => [optimistic, ...prev])
      if (!calm && composerPaperRef.current) {
        const r = composerPaperRef.current.getBoundingClientRect()
        setPendingFlight({
          id,
          from: { left: r.left, top: r.top, width: r.width, height: r.height },
        })
      }
      setStatusMsg('Publicando tu voz...')

      Promise.resolve(onPublish(text, { parentId: null })).then(
        (server) => {
          setLocalVoices((prev) =>
            prev.map((v) =>
              v.id === id
                ? { ...v, status: 'confirmed', serverId: server && server.id }
                : v,
            ),
          )
          setWeldId(id)
          if (sounds && sounds.playClink) sounds.playClink()
          setStatusMsg('Tu voz está en el muro.')
        },
        () => {
          const node = stripNodes.current.get(id)
          const paper = composerPaperRef.current
          const finishFail = () => {
            seqRef.current += 1
            setPendingFlight((p) => (p && p.id === id ? null : p))
            setLocalVoices((prev) => prev.filter((v) => v.id !== id))
            setRestore({
              text,
              error:
                'El dojo no ha respondido y tu voz no se ha publicado. Tu texto está a salvo.',
              token: seqRef.current,
            })
            announce('La publicación ha fallado. Tu texto se ha recuperado.')
          }
          if (node && paper && !reducedMotion()) {
            // La tira vuelve al pincel: ghost de ida... a casa.
            node.style.visibility = 'hidden'
            failAnimRef.current = flyGhost({
              el: node,
              from: node.getBoundingClientRect(),
              to: paper.getBoundingClientRect(),
              mode: 'out',
              duration: 320,
              rot: stripRotation(id),
              onDone: finishFail,
            })
          } else {
            finishFail()
          }
        },
      )

      // Optimista: el pincel se limpia ya (el rescate llega por `restore`).
      return Promise.resolve()
    },
    [announce, currentUser, onPublish, sounds],
  )

  // Coreografía del vuelo: estado pendiente fijado en el handler; aquí solo
  // timers/rAF (setState dentro de callbacks es legal para el Compiler).
  // El rAF espera al primer frame con la tira ya montada; el timeout es el
  // cinturón para pestañas ocultas/throttled donde el rAF no llega a correr.
  useEffect(() => {
    if (!pendingFlight) return undefined
    let started = false
    let anim = null
    const start = () => {
      if (started) return
      started = true
      const node = stripNodes.current.get(pendingFlight.id)
      if (!node) {
        setPendingFlight(null)
        return
      }
      if (sounds && sounds.playWhoosh) sounds.playWhoosh()
      anim = flyGhost({
        el: node,
        from: pendingFlight.from,
        to: node.getBoundingClientRect(),
        mode: 'in',
        duration: 400,
        rot: stripRotation(pendingFlight.id),
        onDone: () => {
          setPendingFlight(null)
          setSettlingId(pendingFlight.id)
          if (sounds && sounds.playSello) sounds.playSello()
        },
      })
    }
    const raf = requestAnimationFrame(start)
    const fallback = setTimeout(start, 120)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(fallback)
      // Si el muro se desmonta a mitad de vuelo, cancelar retira el ghost del
      // body al instante (oncancel) y, al no ser onfinish, no dispara onDone:
      // ni nodo huérfano ni setState sobre un componente desmontado.
      if (anim) {
        try {
          anim.cancel()
        } catch {
          /* ya terminada */
        }
      }
    }
  }, [pendingFlight, sounds])

  // Cancela un vuelo de regreso (fallo de publicación) en curso si el muro se
  // desmonta a mitad de animación: el oncancel de flyGhost retira el ghost.
  useEffect(
    () => () => {
      if (failAnimRef.current) {
        try {
          failAnimRef.current.cancel()
        } catch {
          /* ya terminada */
        }
      }
    },
    [],
  )

  /* ---------- Reportar (pasa a moderación; el feedback lo da el contenedor) ---------- */

  const handleRequestReport = useCallback(
    (voiceId) => {
      if (sounds && sounds.playClack) sounds.playClack()
      // Solo dispara la mutation: el contenedor ya anuncia éxito/fallo por toast
      // (visible y leído), así que el muro NO emite un segundo aviso distinto.
      // El catch evita una promesa rechazada sin manejar (el toast ya informa).
      if (onReport) Promise.resolve(onReport(voiceId)).catch(() => {})
    },
    [onReport, sounds],
  )

  const handleSettled = useCallback(() => setSettlingId(null), [])
  const handleWeldDone = useCallback((id) => {
    setWeldId(null)
    // La tira confirmada se retira al soldarse: su sitio ya lo ocupa la voz del
    // server (si se publicó) o deja el muro (si pasó a moderación). Esto cierra
    // el caso del refetch idéntico (PENDIENTE_REVISION), donde la reconciliación
    // por cambio de referencia no corre y la optimista quedaría de fantasma.
    setLocalVoices((prev) => prev.filter((v) => v.id !== id))
  }, [])

  /* ---------- Lista efectiva (pura, en render) ---------- */

  const merged = [...localVoices, ...(voices || [])].filter(
    // dedupe: si una confirmada local ya vino en props por id, se descarta
    (v, i, arr) => arr.findIndex((o) => o.id === v.id) === i,
  )
  const total = merged.length

  const ctx = {
    currentUser,
    maxLength,
    allowReplies: false,
    initialIds,
    inflightId: pendingFlight ? pendingFlight.id : null,
    settlingId,
    weldId,
    peelingId: null,
    registerNode,
    onToggleReaction: () => {},
    onRequestReport: handleRequestReport,
    onReplySubmit: () => Promise.resolve(),
    onSettled: handleSettled,
    onWeldDone: handleWeldDone,
    onPeeled: () => {},
  }

  return (
    <section className="voice-wall" aria-label={title}>
      <header className="vw-head">
        <span className="vw-head-kanji" aria-hidden="true">
          声
        </span>
        <h2 className="vw-title">{title}</h2>
        <span className="vw-count">
          {total} {total === 1 ? 'voz' : 'voces'}
        </span>
      </header>

      {currentUser ? (
        <InkComposer
          onSubmit={handleComposerSubmit}
          maxLength={maxLength}
          restore={restore}
          paperRef={composerPaperRef}
        />
      ) : (
        <div className="vw-guest">
          <span className="vw-guest-seal" aria-hidden="true">
            印
          </span>
          <p className="vw-guest-text">
            <strong>El muro está sellado para visitantes.</strong>
            <span>Entra en el dojo para dejar tu voz.</span>
          </p>
          <Link className="vw-cta" to={dojoHref}>
            Entrar al dojo
          </Link>
        </div>
      )}

      {merged.length === 0 && !pending && isError ? (
        // Sin voces Y la query falló: NO mostramos "Sé la primera voz" (mentiría
        // diciendo que no hay comentarios cuando en realidad la carga falló).
        <div className="vw-empty" role="alert">
          <p className="vw-empty-title">No se pudieron cargar los comentarios.</p>
          <p className="vw-empty-sub">
            Algo falló al traer el muro. Vuelve a intentarlo en un momento.
          </p>
        </div>
      ) : merged.length === 0 && !pending ? (
        <div className="vw-empty">
          <span className="vw-empty-kanji" aria-hidden="true">
            空
          </span>
          <p className="vw-empty-title">Sé la primera voz.</p>
          <p className="vw-empty-sub">
            {currentUser
              ? 'El muro está esperando. Lo que escribas abre el debate.'
              : 'El muro está esperando. Entra en el dojo y abre el debate.'}
          </p>
        </div>
      ) : (
        <ol className="vw-list" role="list">
          {merged.map((v, i) => (
            <VoiceStrip key={v.id} voice={v} index={i} depth={0} ctx={ctx} />
          ))}
        </ol>
      )}

      {footer}

      <p className="vw-sr" role="status" aria-live="polite">
        {statusMsg}
      </p>
    </section>
  )
}
