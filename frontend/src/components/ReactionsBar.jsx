import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useReducedMotion } from 'framer-motion'
import { toast } from 'sonner'
import { ApiError } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import { useSound } from '../contexts/SoundContext'
import LiveNumber from '../features/ranking/components/LiveNumber'
import {
  useAplicarReaccion,
  useReacciones,
} from '../hooks/useReacciones'
import './fan-reactions.css'

/**
 * Barra de reactions como uchiwa ("los abanicos del público").
 *
 * 4 abanicos FIRE/HEART/LAUGH/CRY, cada uno con su kanji: cerrados en
 * reposo, el del espectador se abre al reaccionar; el más votado lleva
 * laca oro. El conteo rueda con LiveNumber (el odómetro canónico). Click:
 *   - Si no estaba logueado → toast con CTA "Inicia sesión".
 *   - Si la misma que ya tenía → toggle off.
 *   - Si distinta → swap.
 *
 * FUENTE DE VERDAD = el hook. `useReacciones` devuelve `counts[tipo]` YA
 * con la reacción del espectador y `miReaccion` (la activa); el
 * toggle/swap es server-side y `useAplicarReaccion` hace el optimismo /
 * rollback vía react-query. Por eso este componente es CONTROLADO:
 *   - el activo = `miReaccion` (no un estado optimista propio);
 *   - el conteo = `counts[tipo]` TAL CUAL (sin sumar +1 local).
 * El único estado local es el "gesto" (pop del glifo), efímero y
 * puramente visual: nace en el handler del tap, no toca el conteo.
 */

const REACCIONES = [
  { tipo: 'FIRE', kanji: '熱', label: 'Fuego' },
  { tipo: 'HEART', kanji: '好', label: 'Me encanta' },
  { tipo: 'LAUGH', kanji: '笑', label: 'Divertido' },
  { tipo: 'CRY', kanji: '涙', label: 'Me da pena' },
]

/**
 * Líder real = máximo ÚNICO con conteo > 0. Empate ⇒ nadie lleva oro.
 */
function lider(entradas) {
  let leader = null
  let best = 0
  let tie = false
  for (const e of entradas) {
    if (e.count > best) {
      best = e.count
      leader = e.tipo
      tie = false
    } else if (e.count === best && best > 0) {
      tie = true
    }
  }
  return tie || best === 0 ? null : leader
}

function ReactionsBar({ targetType, targetId, className = '' }) {
  const prefersReducedMotion = useReducedMotion()
  const { user } = useAuth()
  const { play } = useSound()
  const navigate = useNavigate()
  const { data, isLoading } = useReacciones(targetType, targetId)
  const mutation = useAplicarReaccion(targetType, targetId)

  const mia = data?.miReaccion ?? null
  const counts = data?.counts ?? {}
  const total = data?.total ?? 0

  // Gesto = última activación del usuario { tipo, from }: gobierna el pop
  // del glifo y el delay de cambio. Es solo visual; la verdad (activo /
  // conteo) la manda el hook. Sin gesto al montar (cero ceremonia).
  const [gesture, setGesture] = useState(null)
  const seqRef = useRef(0)

  // El gesto caduca tras la coreografía (setState dentro de setTimeout: legal
  // en React 19 + Compiler — no es setState síncrono en cuerpo de effect).
  useEffect(() => {
    if (!gesture) return undefined
    const t = setTimeout(() => setGesture(null), 700)
    return () => clearTimeout(t)
  }, [gesture])

  const handleClick = (tipo) => {
    if (!user) {
      play('playClick')
      // Gesto de invitado descartado: sin sesión no hay reacción ni pop.
      setGesture(null)
      toast('Inicia sesión para reaccionar', {
        description: 'Solo los usuarios logueados pueden reaccionar.',
        action: { label: 'Entrar', onClick: () => navigate('/login') },
      })
      return
    }
    if (mutation.isPending || isLoading) return

    const prev = mia
    const next = prev === tipo ? null : tipo
    // Sonido del repo: abrir → playVote, cerrar → playClack.
    play(next ? 'playVote' : 'playClack')
    // El pop se ancla al tipo clicado (open). Al cerrar no hay glifo que
    // animar, así que descartamos el gesto.
    seqRef.current += 1
    setGesture(next ? { tipo: next, from: prev } : null)

    mutation.mutate(tipo, {
      onError: (err) => {
        // El hook ya revierte el cache (no hace optimismo, repuebla con el
        // resumen del server). Aquí solo limpiamos el gesto visual.
        setGesture(null)
        const msg =
          err instanceof ApiError ? err.message : 'No se pudo aplicar la reacción.'
        toast.error('Error', { description: msg })
      },
    })
  }

  const entradas = REACCIONES.map((r) => ({ ...r, count: counts[r.tipo] ?? 0 }))
  const leaderTipo = lider(entradas)

  // Nota de producto: invitado clicando un abanico recibe un toast con CTA
  // "Entrar", pero antes del click no había pista visual de que estaba
  // pendiente de auth. El tooltip nativo (title) ancla el contexto al
  // primer vistazo, sin convertir el componente en un wall-block.
  const hintInvitado = user ? null : 'Inicia sesión para añadir tu reacción'

  return (
    <div className={`fanr ${className}`.trim()} data-reduced-motion={prefersReducedMotion ? 'true' : undefined}>
      <div className="fanr__row" role="group" aria-label="Reacciones del público">
        {entradas.map((r) => {
          const active = mia === r.tipo
          const isPop = !prefersReducedMotion && !!(gesture && gesture.tipo === r.tipo)
          const isSwitch = isPop && !!gesture.from
          const cls = [
            'fanr__btn',
            leaderTipo === r.tipo ? 'fanr__btn--leader' : '',
            isPop ? 'fanr__btn--pop' : '',
            isSwitch ? 'fanr__btn--switch' : '',
          ]
            .filter(Boolean)
            .join(' ')
          const plural = r.count === 1 ? 'reacción' : 'reacciones'
          const aria = `${r.label}, ${r.count} ${plural}${active ? ', activa' : ''}${
            hintInvitado ? ` — ${hintInvitado}` : ''
          }`
          return (
            <button
              key={r.tipo}
              type="button"
              data-fanr-id={r.tipo}
              className={cls}
              aria-pressed={active}
              aria-label={aria}
              title={hintInvitado || r.label}
              disabled={mutation.isPending || isLoading}
              onClick={() => handleClick(r.tipo)}
            >
              <span className="fanr__fan" aria-hidden="true">
                <span className="fanr__closed">
                  <span className="fanr__closedFace">{r.kanji}</span>
                  <span className="fanr__closedStick" />
                </span>
                <span className="fanr__openWrap">
                  <span className="fanr__openFace">
                    <span className="fanr__openGlyph">{r.kanji}</span>
                  </span>
                  <span className="fanr__openStick" />
                </span>
              </span>
              <span className="fanr__count" aria-hidden="true">
                <LiveNumber value={r.count} />
              </span>
            </button>
          )
        })}
        {total > 0 && (
          <span className="fanr__total">
            · {total} reacci{total === 1 ? 'ón' : 'ones'}
          </span>
        )}
      </div>
      {!user && (
        <button
          type="button"
          onClick={() => navigate('/login')}
          className="fanr__login"
        >
          Inicia sesión para reaccionar →
        </button>
      )}
    </div>
  )
}

export default ReactionsBar
