/**
 * VersusIntroOverlay — monta la intro cinemática a pantalla completa al entrar
 * a un duelo y se retira sola. Una sola vez por par y sesión: revisitar el
 * mismo enfrentamiento en la misma sesión ya no la repite.
 */

import * as React from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import VersusIntro from './VersusIntro'

export default function VersusIntroOverlay({ left, right, storageKey }) {
  const [show, setShow] = React.useState(() => {
    if (!left || !right) return false
    try {
      return !sessionStorage.getItem(storageKey)
    } catch {
      return true
    }
  })

  const close = React.useCallback(() => {
    try {
      sessionStorage.setItem(storageKey, '1')
    } catch {
      /* sessionStorage no disponible: solo cerramos en memoria */
    }
    setShow(false)
  }, [storageKey])

  // Bloquea el scroll del fondo mientras la intro está en pantalla.
  React.useEffect(() => {
    if (!show) return undefined
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [show])

  return (
    <AnimatePresence>
      {show ? (
        <motion.div
          className="fixed inset-0 z-[60] grid place-items-center bg-bg/95 p-4 backdrop-blur-sm"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.28, ease: 'easeOut' }}
        >
          <div className="w-full max-w-4xl">
            <VersusIntro left={left} right={right} onComplete={close} onSkip={close} />
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
