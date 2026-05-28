let audioContext = null
let resumePromise = null

function getCtx() {
  if (!audioContext) {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return null
    // latencyHint:'interactive' pide al navegador el buffer de salida más
    // pequeño posible. Con 'playback' (default en algunos UA) el output
    // latency puede subir a 100ms+, que se percibe como sonido tardío.
    audioContext = new Ctx({ latencyHint: 'interactive' })
  }
  return audioContext
}

/**
 * Espera (si es necesario) a que el contexto esté en estado "running"
 * antes de programar nada. Las funciones playXxx la llaman al principio
 * para evitar el bug donde {@code ctx.currentTime} estaba "atrasado"
 * porque el resume era asíncrono y el osc.start(now) caía en el pasado,
 * arrancando con lag perceptible.
 *
 * <p>Nota de rendimiento: cachea la promesa del resume en
 * curso. Antes, cada playXxx llamaba `ctx.resume()` sin await — si dos
 * sonidos disparaban en paralelo durante el primer gesture, ambos
 * arrancaban con el ctx aún suspendido. Ahora todas las llamadas
 * esperan al MISMO resumePromise; el segundo play no dispara su propio
 * resume.
 */
async function ensureRunning() {
  const ctx = getCtx()
  if (!ctx) return null
  if (ctx.state === 'running') return ctx
  if (!resumePromise) {
    resumePromise = ctx
      .resume()
      .catch(() => {
        /* iOS Safari puede rechazar si no hay user gesture activo */
      })
      .finally(() => {
        resumePromise = null
      })
  }
  await resumePromise
  return ctx
}

// Warm-up: lo llama SoundProvider al primer gesture del usuario para que el
// AudioContext esté en estado "running" antes del primer play() y no haya lag
// ni primer-sonido-mudo por la política de autoplay del navegador.
//
// async. Antes era sync sin await; el primer click
// caía sobre un ctx aún suspendido aunque __warm() acabara de ser
// invocado en el mismo tick.
export async function __warm() {
  await ensureRunning()
}

// Nota de rendimiento: cachéa buffers de ruido. Antes
// playWhoosh y playImpact generaban un Float32Array entero con
// Math.random() en cada click — en móviles bajos era un coste medible
// (~2-4ms para 0.25s @ 48kHz = 12k samples). Ahora 1 buffer por
// duración, generado a demanda, reutilizado para siempre.
let _noiseShort = null // 0.12s (impact)
let _noiseLong = null // 0.25s (whoosh)

function getNoiseBuffer(ctx, duration) {
  const wantLong = duration >= 0.2
  const slot = wantLong ? _noiseLong : _noiseShort
  // Si el sampleRate del ctx cambió (raro: solo si el browser recrea el
  // device de audio), invalidamos y regeneramos.
  if (slot && slot.sampleRate === ctx.sampleRate) return slot
  const length = Math.floor(ctx.sampleRate * duration)
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < length; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / length)
  }
  if (wantLong) _noiseLong = buffer
  else _noiseShort = buffer
  return buffer
}

export async function playClick() {
  const ctx = await ensureRunning()
  if (!ctx) return
  const now = ctx.currentTime
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'triangle'
  osc.frequency.setValueAtTime(1400, now)
  osc.frequency.exponentialRampToValueAtTime(600, now + 0.05)
  gain.gain.setValueAtTime(0, now)
  gain.gain.linearRampToValueAtTime(0.12, now + 0.005)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(now)
  osc.stop(now + 0.1)
}

export async function playVote() {
  const ctx = await ensureRunning()
  if (!ctx) return
  const now = ctx.currentTime
  const notes = [
    { freq: 523.25, time: 0 },
    { freq: 659.25, time: 0.06 },
    { freq: 783.99, time: 0.12 },
    { freq: 1046.5, time: 0.22 },
  ]
  notes.forEach(({ freq, time }) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(freq, now + time)
    gain.gain.setValueAtTime(0, now + time)
    gain.gain.linearRampToValueAtTime(0.13, now + time + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + time + 0.45)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(now + time)
    osc.stop(now + time + 0.5)
  })
  const sparkle = ctx.createOscillator()
  const sparkleGain = ctx.createGain()
  sparkle.type = 'sine'
  sparkle.frequency.setValueAtTime(2093, now + 0.22)
  sparkleGain.gain.setValueAtTime(0, now + 0.22)
  sparkleGain.gain.linearRampToValueAtTime(0.06, now + 0.24)
  sparkleGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.6)
  sparkle.connect(sparkleGain)
  sparkleGain.connect(ctx.destination)
  sparkle.start(now + 0.22)
  sparkle.stop(now + 0.65)
}

// Sword whoosh — bandpass-swept noise (transición/menu open)
export async function playWhoosh() {
  const ctx = await ensureRunning()
  if (!ctx) return
  const now = ctx.currentTime
  const src = ctx.createBufferSource()
  src.buffer = getNoiseBuffer(ctx, 0.25)
  const filter = ctx.createBiquadFilter()
  filter.type = 'bandpass'
  filter.Q.value = 6
  filter.frequency.setValueAtTime(2400, now)
  filter.frequency.exponentialRampToValueAtTime(500, now + 0.22)
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.12, now)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25)
  src.connect(filter)
  filter.connect(gain)
  gain.connect(ctx.destination)
  src.start(now)
}

// Magic sparkle — 6 sines high-freq apilados aleatoriamente (login/register success)
export async function playMagic() {
  const ctx = await ensureRunning()
  if (!ctx) return
  const now = ctx.currentTime
  const baseFreqs = [1568, 1760, 2093, 2349, 2637, 3136]
  baseFreqs.forEach((freq, i) => {
    const t = now + i * 0.04 + Math.random() * 0.03
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(freq, t)
    gain.gain.setValueAtTime(0, t)
    gain.gain.linearRampToValueAtTime(0.05, t + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.4)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(t)
    osc.stop(t + 0.45)
  })
}

// Impact — sub-bass thump + filtered noise (kapow al votar contundente o VS reveal)
export async function playImpact() {
  const ctx = await ensureRunning()
  if (!ctx) return
  const now = ctx.currentTime
  // Sub-bass thump
  const osc = ctx.createOscillator()
  const oscGain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(180, now)
  osc.frequency.exponentialRampToValueAtTime(60, now + 0.15)
  oscGain.gain.setValueAtTime(0, now)
  oscGain.gain.linearRampToValueAtTime(0.25, now + 0.005)
  oscGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2)
  osc.connect(oscGain)
  oscGain.connect(ctx.destination)
  osc.start(now)
  osc.stop(now + 0.22)
  // Crack noise
  const src = ctx.createBufferSource()
  src.buffer = getNoiseBuffer(ctx, 0.12)
  const filter = ctx.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.setValueAtTime(1800, now)
  filter.Q.value = 4
  const noiseGain = ctx.createGain()
  noiseGain.gain.setValueAtTime(0.15, now)
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12)
  src.connect(filter)
  filter.connect(noiseGain)
  noiseGain.connect(ctx.destination)
  src.start(now)
}

// Level up / power up — fanfare ascendente largo (achievement)
export async function playLevelUp() {
  const ctx = await ensureRunning()
  if (!ctx) return
  const now = ctx.currentTime
  // Arpegio mayor mas rápido y más alto
  const notes = [
    { freq: 392.0, time: 0 },
    { freq: 523.25, time: 0.08 },
    { freq: 659.25, time: 0.16 },
    { freq: 783.99, time: 0.24 },
    { freq: 1046.5, time: 0.32 },
    { freq: 1318.51, time: 0.42 },
  ]
  notes.forEach(({ freq, time }) => {
    const t = now + time
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(freq, t)
    gain.gain.setValueAtTime(0, t)
    gain.gain.linearRampToValueAtTime(0.1, t + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.5)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(t)
    osc.stop(t + 0.55)
  })
  // Sparkle final largo
  const sparkle = ctx.createOscillator()
  const sparkleGain = ctx.createGain()
  sparkle.type = 'sine'
  sparkle.frequency.setValueAtTime(2637, now + 0.42)
  sparkleGain.gain.setValueAtTime(0, now + 0.42)
  sparkleGain.gain.linearRampToValueAtTime(0.08, now + 0.45)
  sparkleGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.0)
  sparkle.connect(sparkleGain)
  sparkleGain.connect(ctx.destination)
  sparkle.start(now + 0.42)
  sparkle.stop(now + 1.05)
}
