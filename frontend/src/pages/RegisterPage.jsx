import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useReducedMotion } from 'framer-motion'
import { toast } from 'sonner'
import { useAuth } from '../contexts/AuthContext'
import { useSeo } from '../hooks/useSeo'
import { useSound } from '../contexts/SoundContext'
import { track, FUNNEL_EVENTS } from '../lib/analytics'
import RegisterRite from '../features/auth/RegisterRite'
// Import ESTÁTICO a propósito: el rito de iniciación es el primer
// momento-recompensa de la cuenta y los flujos de recompensa no van detrás
// de un import() dinámico (un chunk lento o caído lo rompería). Esta página
// ya es una ruta lazy.
import InitiationRite from '../components/InitiationRite'
import { markInitiationRiteSeen, shouldRunInitiationRite } from '../lib/initiationRite'

// El funnel puede llegar con ?next= (p.ej. desde una superficie que pide
// cuenta). Solo rutas relativas propias: mismo criterio que el next del
// flujo OAuth en AuthSocialButtons.
function sanitizeNext(next) {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/'
}

/**
 * /register — el rito de ingreso (RegisterRite): ceremonia por pasos con
 * cuerda shimenawa, tintero de fuerza y sello del juramento. La página es el
 * contenedor: conserva el flujo intacto (schema zod + registerUser, next
 * anti open-redirect, AuthSocialButtons/AuthLegalNote, acunando +
 * InitiationRite, toast de reduced-motion). La validación y el submit final
 * viven dentro de RegisterRite y producen el MISMO registerUser(data).
 */
function RegisterPage() {
  useSeo({
    title: 'Crear cuenta',
    description:
      'Crea tu cuenta gratuita en AnimeShowdown. Vota, predice torneos, crea tu propio bracket y construye tu perfil público.',
    noindex: true,
  })
  const prefersReducedMotion = useReducedMotion()
  const { register: registerUser } = useAuth()
  const { play } = useSound()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const refDeQuery = searchParams.get('ref') ?? ''
  const next = sanitizeNext(searchParams.get('next'))
  useEffect(() => {
    // Embudo: llegada con código de referido (entrada del loop viral, hoy
    // divorciada de los artefactos compartidos — la métrica lo hace medible).
    if (refDeQuery) track(FUNNEL_EVENTS.REFERRAL_LANDING)
  }, [refDeQuery])
  // Username recién registrado mientras corre el rito de acuñación; el
  // propio rito navega al terminar.
  const [acunando, setAcunando] = useState(null)

  // Punto de sonido del rito (lib/sounds.js bajo SoundContext + mute global).
  // El sello del juramento suena como el sello del veredicto; el alta como
  // magia. El resto de fases (envío/tremor/corte) quedan visuales.
  const onPhase = useCallback(
    (fase) => {
      if (fase === 'sello') play('playVerdictStamp')
      else if (fase === 'alta') play('playMagic')
    },
    [play],
  )

  // El registro real: RegisterRite valida con el schema zod (idéntico al de
  // antes) y llama aquí con los MISMOS campos. Si registerUser rechaza, el
  // error sube a RegisterRite que lo pinta (409 por campo / genérico / red).
  const onRegister = useCallback(
    (data) =>
      registerUser({
        username: data.username,
        email: data.email,
        password: data.password,
        referralCode: data.referralCode || undefined,
      }),
    [registerUser],
  )

  // Post-alta — exactamente como antes: rito de iniciación one-shot. Con
  // reduced-motion no se monta la ceremonia: bienvenida por toast y
  // navegación directa, cero animación.
  const onSuccess = useCallback(
    (username) => {
      if (prefersReducedMotion || !shouldRunInitiationRite()) {
        if (prefersReducedMotion) {
          markInitiationRiteSeen()
          toast.success(`Bienvenido, ${username}`, {
            description: 'Tu placa de luchador quedó acuñada.',
          })
        }
        navigate(next)
      } else {
        setAcunando(username)
      }
    },
    [prefersReducedMotion, navigate, next],
  )

  return (
    // Full-bleed con el arte premium del banco (mismo patrón que los juegos):
    // el rito vive centrado/izquierda sobre la zona oscura del altar dorado.
    <section className="as-stage as-stage-visual as-stage-auth-register flex min-h-[calc(100vh-6rem)] items-center px-5 py-12 sm:px-8">
      <div className="mx-auto flex w-full max-w-6xl justify-center lg:justify-start">
        <RegisterRite
          onRegister={onRegister}
          onSuccess={onSuccess}
          next={next}
          refCode={refDeQuery}
          onPhase={onPhase}
        />
      </div>

      {acunando && <InitiationRite username={acunando} to={next} />}
    </section>
  )
}

export default RegisterPage
