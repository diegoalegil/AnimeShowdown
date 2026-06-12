/**
 * VerifySeal — momento de éxito de la verificación de email (/verify).
 * La estampación del hanko 認 (reconocido) sustituye al <Exito/> genérico
 * (CheckCircle2 verde) de VerifyPage.jsx.
 *
 * USO — en VerifyPage.jsx, el estado ok deja de renderizarse dentro del
 * panel compartido y pasa a ser este componente (que ES su propio panel,
 * para poder dar el micro-shake al panel entero y poseer el rect SVG del
 * borde):
 *
 *   import VerifySeal from '../components/VerifySeal'
 *   ...
 *   {estado === 'ok' ? (
 *     <VerifySeal />
 *   ) : (
 *     <motion.div ...panel actual...>
 *       {estado === 'verificando' && <Verificando />}
 *       {estado === 'invalido' && <TokenInvalido />}
 *       {estado === 'sin_token' && <SinToken />}
 *       {estado === 'error_red' && <ErrorRed />}
 *     </motion.div>
 *   )}
 *
 * Coreografía (~1.6s, one-shot, transform/opacity only):
 *   0ms    El sello entra desde delante de la cámara: translateZ 480→0
 *          bajo perspective(600px) (escala óptica ~5x→1, ease-in cargado).
 *          La sombra de contacto crece en el panel durante el descenso.
 *   420ms  IMPACTO — squash (scaleX↑/scaleY↓), micro-shake del panel
 *          (~2 frames) y golpe seco grave: play('playImpact') del banco
 *          de sfx existente, sincronizado con onAnimationComplete del
 *          descenso. La capa difusa del kanji (sangrado de tinta
 *          PRE-HORNEADO en text-shadow/box-shadow estáticos — nunca
 *          filter/blur) cross-fadea a 0 mientras la nítida se asienta.
 *   560ms  El borde del panel se ENCIENDE en oro una sola vez:
 *          stroke-dashoffset 1→0 sobre un rect SVG con EASE_BRUSH
 *          (+ un segundo rect gordo y tenue como halo pre-horneado del
 *          trazo). Queda encendido al terminar.
 *   600ms  Título, copy y CTA suben con EASE_LIFT.
 *
 * Reduced motion: marca ya estampada y borde encendido — sin descenso,
 * sin shake, sin sonido (los keyframes nunca corren).
 *
 * Perf: área animada pequeña (un cuadrado de 104px + dos rects), cero
 * blur()/backdrop-blur ni SVG filters nuevos, cero loops infinitos (nada
 * que pausar fuera del viewport), cero libs nuevas. El sonido falla en
 * silencio si el AudioContext sigue suspendido (llegada directa desde el
 * enlace del email, sin gesture previo) — mismo contrato que el resto
 * de sfx del proyecto.
 */
import { useCallback, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { useSound } from '../contexts/SoundContext'
import { EASE_BRUSH, EASE_LIFT } from '../lib/motion'

const SEAL = 104 // px — lado del sello; única zona del panel que anima
const DESCENT = 0.42 // s — duración del descenso hasta el impacto
// Caída del sello: arranca suave (aún lejos) y llega cargado — ease-in
// seco, lo contrario de EASE_LIFT. Solo se usa aquí.
const EASE_SLAM = [0.5, 0, 0.85, 0.4]

export default function VerifySeal() {
  const reduced = useReducedMotion()
  const { play } = useSound()
  // Con reduced-motion el estado inicial YA es el final: marca estampada.
  const [landed, setLanded] = useState(() => !!reduced)
  const firedRef = useRef(false)

  const onImpact = useCallback(() => {
    if (firedRef.current) return
    firedRef.current = true
    // Golpe seco grave en el frame exacto de contacto.
    play('playImpact')
    setLanded(true)
  }, [play])

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0 }}
      animate={
        landed && !reduced
          ? { opacity: 1, x: [0, -3, 2, 0], y: [0, 2, -1, 0] } // micro-shake ~2 frames
          : { opacity: 1, x: 0, y: 0 }
      }
      transition={{
        opacity: { duration: 0.2 },
        x: { duration: 0.1, ease: 'linear' },
        y: { duration: 0.1, ease: 'linear' },
      }}
      className="relative w-full rounded-2xl border border-border bg-surface/85 p-8 text-center shadow-aura-lg backdrop-blur-md"
    >
      {/* Borde que se enciende en oro UNA vez. Dos rects con el mismo
          recorrido: halo gordo tenue (glow pre-horneado del trazo, sin
          filter) + trazo fino brillante. El svg vive 1px dentro del
          panel para que el stroke caiga sobre la línea del border. */}
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute overflow-visible"
        style={{ top: 1, left: 1, width: 'calc(100% - 2px)', height: 'calc(100% - 2px)' }}
      >
        <motion.rect
          width="100%"
          height="100%"
          rx="15"
          pathLength={1}
          fill="none"
          strokeDasharray="1"
          className="stroke-gold"
          strokeWidth={5}
          opacity={0.3}
          initial={reduced ? false : { strokeDashoffset: 1 }}
          animate={{ strokeDashoffset: landed ? 0 : 1 }}
          transition={{ duration: 1.05, ease: EASE_BRUSH, delay: 0.14 }}
        />
        <motion.rect
          width="100%"
          height="100%"
          rx="15"
          pathLength={1}
          fill="none"
          strokeDasharray="1"
          className="stroke-gold-bright"
          strokeWidth={1.6}
          initial={reduced ? false : { strokeDashoffset: 1 }}
          animate={{ strokeDashoffset: landed ? 0 : 1 }}
          transition={{ duration: 1.05, ease: EASE_BRUSH, delay: 0.14 }}
        />
      </svg>

      {/* Escenario del sello. perspective vía transformPerspective del
          propio sello — sin preserve-3d en ningún nodo. */}
      <div className="relative mx-auto mb-2" style={{ width: SEAL + 16, height: SEAL + 24 }}>
        {/* Sombra de contacto: crece mientras el sello desciende y
            desaparece en el impacto (el objeto queda plano). Radial
            pre-pintado, no blur. */}
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-[54%] rounded-3xl"
          style={{
            width: SEAL,
            height: SEAL,
            x: '-50%',
            y: '-50%',
            background: 'radial-gradient(closest-side, var(--color-canvas) 25%, transparent 74%)',
          }}
          initial={reduced ? false : { scale: 0.3, opacity: 0 }}
          animate={reduced || landed ? { opacity: 0 } : { scale: 1, opacity: 0.6 }}
          transition={
            landed
              ? { duration: 0.05 }
              : { duration: DESCENT, ease: EASE_SLAM }
          }
        />

        {/* La marca 認 — es también el sello en vuelo: desciende por Z,
            impacta con squash y se queda como imprenta. */}
        <motion.div
          lang="ja"
          className="absolute left-1/2 top-1/2 flex items-center justify-center rounded-xl border-[3px] border-hanko text-hanko"
          style={{
            width: SEAL,
            height: SEAL,
            x: '-50%',
            y: '-50%',
            rotate: -6,
            transformPerspective: 600,
            fontFamily: 'var(--font-kanji-serif)',
            boxShadow: 'inset 0 0 14px var(--color-accent-soft)',
            backfaceVisibility: 'hidden',
          }}
          initial={reduced ? false : { z: 480, opacity: 0 }}
          animate={
            reduced
              ? { z: 0, opacity: 1 }
              : landed
                ? { z: 0, opacity: 1, scaleX: [1, 1.1, 0.99, 1], scaleY: [1, 0.84, 1.03, 1] }
                : { z: 0, opacity: 1 }
          }
          transition={
            landed
              ? {
                  scaleX: { duration: 0.22, times: [0, 0.3, 0.7, 1], ease: 'easeOut' },
                  scaleY: { duration: 0.22, times: [0, 0.3, 0.7, 1], ease: 'easeOut' },
                }
              : {
                  z: { duration: DESCENT, ease: EASE_SLAM },
                  opacity: { duration: 0.12, ease: 'linear' },
                }
          }
          onAnimationComplete={landed ? undefined : onImpact}
        >
          <span className="font-bold" style={{ fontSize: 60, lineHeight: 1 }}>認</span>
        </motion.div>

        {/* Sangrado de tinta: gemela difusa PRE-HORNEADA (text-shadow +
            box-shadow estáticos) que se desvanece en opacity mientras la
            nítida se asienta. Nunca filter. */}
        {landed && !reduced && (
          <motion.div
            aria-hidden="true"
            lang="ja"
            className="pointer-events-none absolute left-1/2 top-1/2 flex items-center justify-center rounded-xl"
            style={{
              width: SEAL,
              height: SEAL,
              x: '-50%',
              y: '-50%',
              rotate: -6,
              fontFamily: 'var(--font-kanji-serif)',
              boxShadow: '0 0 0 3px var(--color-hanko), 0 0 26px 8px var(--color-accent-soft)',
            }}
            initial={{ opacity: 0.9, scale: 1.16 }}
            animate={{ opacity: 0, scale: 1.02 }}
            transition={{ duration: 0.65, ease: 'easeOut' }}
          >
            <span
              className="font-bold"
              style={{
                fontSize: 60,
                lineHeight: 1,
                color: 'transparent',
                textShadow: '0 0 13px var(--color-hanko), 0 0 3px var(--color-hanko)',
              }}
            >
              認
            </span>
          </motion.div>
        )}
      </div>

      {/* Contenido: sube tras el impacto con la curva lift del sistema. */}
      <motion.div
        className="flex flex-col items-center gap-4"
        initial={reduced ? false : { opacity: 0, y: 10 }}
        animate={landed ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
        transition={{ duration: 0.32, ease: EASE_LIFT, delay: 0.18 }}
      >
        <h1 className="text-2xl font-bold text-fg-strong">¡Email verificado!</h1>
        <p className="text-fg-muted">
          Tu cuenta está activa. Ya puedes votar en los torneos.
        </p>
        <Link
          to="/torneos"
          className="mt-2 inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover"
        >
          Ver torneos
          <ArrowRight className="h-4 w-4" />
        </Link>
      </motion.div>
    </motion.div>
  )
}
