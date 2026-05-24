import { useCallback, useRef } from 'react'
import { useSound } from '../contexts/SoundContext'

/**
 * Nota de rendimiento: muchos CTAs disparaban sonido en
 * onClick — click se emite cuando se SUELTA el botón, no cuando se
 * presiona. En móvil o con click mantenido, el sonido suena tarde y
 * se percibe como lag aunque el AudioContext esté running.
 *
 * <p>Este hook resuelve dos cosas a la vez:
 *
 * <ol>
 *   <li>Dispara el sonido en {@code onPointerDown}: ratón, dedo y
 *       lápiz lo emiten en el INICIO de la pulsación — feedback
 *       inmediato, perceptible como "instantáneo".</li>
 *   <li>Sin duplicar con teclado: si el botón se activa con Space/Enter,
 *       el browser dispara {@code click} (no pointerdown). Capturamos
 *       el segundo evento dentro de la misma interacción con una ref
 *       que se limpia tras 250ms — si el pointerdown sonó hace menos
 *       de eso, el onClick lo ignora. Si el botón se activa solo por
 *       teclado, el onClick sí suena.</li>
 * </ol>
 *
 * <p>Uso:
 * <pre>{@code
 *   const { onPointerDown, onClick } = useInstantSoundPress('playClick')
 *   <button onPointerDown={onPointerDown} onClick={(e) => { onClick(e); ... }}>
 * }</pre>
 *
 * <p>Tanto onPointerDown como onClick reciben el evento como primer
 * argumento — si el caller no lo necesita, lo ignora.
 */
export function useInstantSoundPress(soundName = 'playClick') {
  const { play } = useSound()
  const lastPlayedAtRef = useRef(0)

  const onPointerDown = useCallback(() => {
    play(soundName)
    lastPlayedAtRef.current = Date.now()
  }, [play, soundName])

  const onClick = useCallback(() => {
    // Si el pointerdown ya sonó hace <250ms, no duplicamos. Solo dejamos
    // pasar onClick puro (sin pointerdown) que viene de teclado.
    if (Date.now() - lastPlayedAtRef.current > 250) {
      play(soundName)
    }
  }, [play, soundName])

  return { onPointerDown, onClick }
}
