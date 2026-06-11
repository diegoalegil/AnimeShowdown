// Flip 3D frente/dorso con backface correcto en Safari.
// rotateY 0→180 en 500ms (solo transform/opacity → 60fps).
// prefers-reduced-motion → crossfade de opacidad, sin rotación.
//
// Controlado: el padre decide `flipped` y pinta su propio toggle — la
// superficie llena al padre (que fija aspecto/alto), sin layout propio.
//
//   <CardFlip flipped={verStats} front={<Carta />} back={<Dossier />} />

import { motion, useReducedMotion } from 'framer-motion'

const EASE = [0.4, 0, 0.2, 1]

// ⚠️ Safari: backface-visibility NECESITA el prefijo -webkit- y debe ir en
// AMBAS caras, como estilo inline (no clase) para que framer-motion no lo
// pise al componer transforms. Este proyecto ya se quemó con esto.
const caraBase = {
  backfaceVisibility: 'hidden',
  WebkitBackfaceVisibility: 'hidden',
}

function CardFlip({ front, back, flipped = false }) {
  const reduced = useReducedMotion()

  return (
    <div className="h-full w-full" style={{ perspective: 1200 }}>
      <motion.div
        className="relative h-full w-full"
        style={{
          transformStyle: 'preserve-3d',
          WebkitTransformStyle: 'preserve-3d', // Safari
        }}
        initial={false}
        animate={reduced ? { rotateY: 0 } : { rotateY: flipped ? 180 : 0 }}
        transition={{ duration: 0.5, ease: EASE }}
      >
        {/* frente — EN FLUJO: es quien da el tamaño intrínseco al flip.
            Con ambas caras absolute, el contenedor w-auto de la ficha
            colapsaba a ancho 0 en móvil y los botones superpuestos
            quedaban inclicables (lo cazó el e2e del deeplink 3D). */}
        <motion.div
          style={{
            ...caraBase,
            position: 'relative',
            height: '100%',
            pointerEvents: flipped ? 'none' : 'auto',
          }}
          initial={false}
          animate={{ opacity: reduced && flipped ? 0 : 1 }}
          transition={{ duration: reduced ? 0.32 : 0 }}
          aria-hidden={flipped}
        >
          {front}
        </motion.div>

        {/* dorso — absoluto sobre el frente, pre-rotado 180º; en reduced
            queda a 0º y se hace crossfade */}
        <motion.div
          style={{
            ...caraBase,
            position: 'absolute',
            inset: 0,
            rotateY: reduced ? 0 : 180,
            pointerEvents: flipped ? 'auto' : 'none',
          }}
          initial={false}
          animate={{ opacity: reduced ? (flipped ? 1 : 0) : 1 }}
          transition={{ duration: reduced ? 0.32 : 0 }}
          aria-hidden={!flipped}
        >
          {back}
        </motion.div>
      </motion.div>
    </div>
  )
}

export default CardFlip
