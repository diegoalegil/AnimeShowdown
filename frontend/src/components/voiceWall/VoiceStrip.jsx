import { useState } from 'react'
import InkComposer from './InkComposer.jsx'
import { stripRotation } from './voiceWallUtils.js'

/**
 * Contador rodante para los sellos.
 * Stand-in mínimo: punto de integración para sustituirlo por el
 * <LiveNumber> canónico del repo si se prefiere (misma señal: `value`).
 * Cambio de valor => el dígito viejo sube/baja y el nuevo rueda dentro.
 */
function RollingCount({ value }) {
  // Ajuste durante el render con guard (canónico Compiler).
  const [prev, setPrev] = useState(value)
  const [dir, setDir] = useState(null)
  if (prev !== value) {
    setPrev(value)
    setDir(value > prev ? 'up' : 'down')
  }
  return (
    <span className="vw-react-count" data-dir={dir === 'down' ? 'down' : undefined}>
      {dir ? (
        <span
          key={'out-' + prev}
          className="vw-roll-out"
          aria-hidden="true"
          onAnimationEnd={() => setDir(null)}
        >
          {prev}
        </span>
      ) : null}
      <span key={'in-' + value} className={dir ? 'vw-roll-in' : undefined}>
        {value}
      </span>
    </span>
  )
}

/** Avatar con marco dorado; sin avatarUrl cae a la inicial. */
function Avatar({ author }) {
  const name = author && author.name ? author.name : '?'
  const initial = name.trim().charAt(0).toUpperCase() || '?'
  return (
    <span className="vw-avatar" aria-hidden="true">
      {author && author.avatarUrl ? (
        <img src={author.avatarUrl} alt="" loading="lazy" width="36" height="36" />
      ) : (
        initial
      )}
    </span>
  )
}

/**
 * VoiceStrip — una tira de papel del muro.
 *
 * Acotado al backend real de comentarios de AnimeShowdown:
 * - SIN reacciones (reactions siempre []): el footer de hanko no se pinta.
 * - SIN respuestas (allowReplies=false): ni botón Responder ni árbol de hilo.
 * - La acción por-voz es REPORTAR (no borrar): el repo expone reportar, no
 *   delete de muro. Se pinta «Reportar» en voces ajenas con sesión iniciada.
 *
 * @param {object} props
 * @param {Voice} props.voice — voz EFECTIVA (overrides ya aplicados):
 *   { id, author: {id, name, avatarUrl?}, timeLabel: string (preformateado
 *   por el server/contenedor — nada de Date.now() en render), text,
 *   reactions: [{id, kanji, label, count, mine}], replies: [Voice],
 *   status?: 'pending'|'confirmed', fresh?: boolean }
 * @param {number} props.index — posición para el stagger de entrada
 * @param {number} props.depth — 0 = tira raíz; 1 = respuesta en hilo
 * @param {object} props.ctx — contexto que reparte VoiceWall:
 *   { currentUser, maxLength, allowReplies, initialIds, inflightId,
 *     settlingId, weldId, peelingId, registerNode, onToggleReaction,
 *     onRequestReport, onReplySubmit, onSettled, onWeldDone, onPeeled }
 */
export default function VoiceStrip({ voice, index = 0, depth = 0, ctx }) {
  const [replyOpen, setReplyOpen] = useState(false)
  const [stamp, setStamp] = useState(null) // { id, seq } — re-dispara la caída del hanko

  const isOwn = !!(
    ctx.currentUser &&
    voice.author &&
    voice.author.id === ctx.currentUser.id
  )
  const status = voice.status
  const pending = status === 'pending'
  const rot = stripRotation(voice.id)
  const isInitial = ctx.initialIds.has(voice.id)
  const entering = isInitial || voice.fresh === true
  // Stagger 35ms solo en la entrada del muro; tope para muros de 100 voces.
  const delay = isInitial ? Math.min(index * 35, 700) : 0
  // Reportar: voz ajena, con sesión, ya confirmada (no la optimista propia).
  const canReport = !!ctx.currentUser && !isOwn && !pending
  const reactions = voice.reactions || []

  function handleAnimationEnd(e) {
    if (e.target !== e.currentTarget) return
    if (e.animationName === 'vw-peel') ctx.onPeeled(voice.id)
    else if (e.animationName === 'vw-settle') ctx.onSettled(voice.id)
    else if (e.animationName === 'vw-weld-fade') ctx.onWeldDone(voice.id)
  }

  return (
    <li className="vw-item">
      <article
        className="vw-strip"
        ref={(el) => ctx.registerNode(voice.id, el)}
        style={{ '--vw-rot-base': rot + 'deg', '--vw-delay': delay + 'ms' }}
        data-status={status || undefined}
        data-inflight={ctx.inflightId === voice.id ? 'true' : undefined}
        data-settling={ctx.settlingId === voice.id ? 'true' : undefined}
        data-weld={ctx.weldId === voice.id ? 'true' : undefined}
        data-peeling={ctx.peelingId === voice.id ? 'true' : undefined}
        data-enter={entering ? 'true' : undefined}
        aria-busy={pending || undefined}
        aria-label={'Voz de ' + (voice.author ? voice.author.name : 'alguien del dojo')}
        onAnimationEnd={handleAnimationEnd}
      >
        <header className="vw-strip-head">
          <Avatar author={voice.author} />
          <span className="vw-id">
            <span className="vw-author">{voice.author ? voice.author.name : '—'}</span>
            {isOwn ? <span className="vw-own-tag">tú</span> : null}
          </span>
          <span className="vw-time">
            {voice.timeLabel}
            {pending ? ' · enviando...' : ''}
          </span>
        </header>

        <p className="vw-text">{voice.text}</p>

        {reactions.length > 0 || canReport ? (
          <footer className="vw-foot">
            {reactions.map((r) => (
              <button
                key={r.id}
                type="button"
                className="vw-react"
                aria-pressed={r.mine === true}
                aria-label={
                  r.label + ' — ' + r.count + (r.count === 1 ? ' sello' : ' sellos')
                }
                disabled={pending}
                onClick={() => {
                  if (!r.mine) {
                    setStamp({ id: r.id, seq: (stamp ? stamp.seq : 0) + 1 })
                  }
                  ctx.onToggleReaction(voice.id, r.id, !r.mine)
                }}
              >
                <span
                  key={stamp && stamp.id === r.id ? 'stamp-' + stamp.seq : 'seal'}
                  className="vw-react-seal"
                  data-stamping={stamp && stamp.id === r.id ? 'true' : undefined}
                  aria-hidden="true"
                >
                  {r.kanji}
                </span>
                <RollingCount value={r.count} />
              </button>
            ))}
            <span className="vw-foot-actions">
              {ctx.allowReplies && ctx.currentUser && depth === 0 && !pending ? (
                <button
                  type="button"
                  className="vw-action"
                  aria-expanded={replyOpen}
                  onClick={() => setReplyOpen((o) => !o)}
                >
                  Responder
                </button>
              ) : null}
              {canReport ? (
                <button
                  type="button"
                  className="vw-action vw-action-danger"
                  onClick={() => ctx.onRequestReport(voice.id)}
                >
                  Reportar
                </button>
              ) : null}
            </span>
          </footer>
        ) : null}
      </article>

      {ctx.allowReplies && replyOpen ? (
        <div className="vw-reply-composer">
          <InkComposer
            compact
            autoFocus
            maxLength={ctx.maxLength}
            placeholder={
              'Responde a ' + (voice.author ? voice.author.name : 'esta voz') + '...'
            }
            submitLabel="Responder"
            onSubmit={(text) =>
              ctx.onReplySubmit(voice.id, text).then(() => setReplyOpen(false))
            }
          />
        </div>
      ) : null}

      {voice.replies && voice.replies.length > 0 ? (
        <ul className="vw-replies" role="list">
          {voice.replies.map((reply, i) => (
            <VoiceStrip key={reply.id} voice={reply} index={i} depth={depth + 1} ctx={ctx} />
          ))}
        </ul>
      ) : null}
    </li>
  )
}
