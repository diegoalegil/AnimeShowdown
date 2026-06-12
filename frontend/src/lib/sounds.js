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

function makeNoise(ctx, duration) {
  const length = Math.floor(ctx.sampleRate * duration)
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < length; i++) {
    const t = i / Math.max(1, length - 1)
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 1.25)
  }
  return buffer
}

function scheduleTone(ctx, {
  freq,
  duration,
  type = 'sine',
  volume = 0.12,
  when = 0,
  rampTo = null,
}) {
  const now = ctx.currentTime + when
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, now)
  if (rampTo) {
    osc.frequency.exponentialRampToValueAtTime(rampTo, now + duration)
  }
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(volume, now + 0.015)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(now)
  osc.stop(now + duration + 0.03)
}

export async function playPackCharge() {
  const ctx = await ensureRunning()
  if (!ctx) return
  const now = ctx.currentTime
  const duration = 1.25
  const src = ctx.createBufferSource()
  src.buffer = makeNoise(ctx, duration)
  const filter = ctx.createBiquadFilter()
  filter.type = 'bandpass'
  filter.Q.value = 1.2
  filter.frequency.setValueAtTime(280, now)
  filter.frequency.exponentialRampToValueAtTime(6200, now + duration)
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(0.2, now + duration * 0.82)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration + 0.05)
  src.connect(filter)
  filter.connect(gain)
  gain.connect(ctx.destination)
  src.start(now)
  src.stop(now + duration + 0.08)

  ;[0, 4, 7].forEach((semi, index) => {
    const f0 = 196 * Math.pow(2, semi / 12)
    scheduleTone(ctx, {
      freq: f0,
      rampTo: f0 * 3.8,
      duration,
      type: 'sine',
      volume: 0.045,
      when: index * 0.015,
    })
  })
}

export async function playPackTear() {
  const ctx = await ensureRunning()
  if (!ctx) return
  const now = ctx.currentTime

  scheduleTone(ctx, {
    freq: 150,
    rampTo: 42,
    duration: 0.48,
    type: 'sine',
    volume: 0.34,
  })

  const burst = ctx.createBufferSource()
  burst.buffer = makeNoise(ctx, 0.46)
  const hp = ctx.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.setValueAtTime(2200, now)
  const peak = ctx.createBiquadFilter()
  peak.type = 'peaking'
  peak.frequency.value = 5400
  peak.Q.value = 4
  peak.gain.value = 11
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(0.26, now + 0.012)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.46)
  burst.connect(hp)
  hp.connect(peak)
  peak.connect(gain)
  gain.connect(ctx.destination)
  burst.start(now)
  burst.stop(now + 0.5)

  const bells = [1568, 2093, 2637, 3136, 3520, 2349, 1760]
  for (let i = 0; i < 9; i++) {
    scheduleTone(ctx, {
      freq: bells[i % bells.length],
      duration: 0.42,
      type: 'sine',
      volume: 0.045,
      when: 0.06 + i * 0.065,
    })
  }

  for (let i = 0; i < 8; i++) {
    const when = 0.02 + i * 0.055
    const src = ctx.createBufferSource()
    src.buffer = makeNoise(ctx, 0.035)
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 2200 + i * 310
    bp.Q.value = 2.4
    const cg = ctx.createGain()
    const t = now + when
    cg.gain.setValueAtTime(0.0001, t)
    cg.gain.exponentialRampToValueAtTime(0.045, t + 0.004)
    cg.gain.exponentialRampToValueAtTime(0.0001, t + 0.035)
    src.connect(bp)
    bp.connect(cg)
    cg.connect(ctx.destination)
    src.start(t)
    src.stop(t + 0.055)
  }
}

export async function playPackFlip() {
  const ctx = await ensureRunning()
  if (!ctx) return
  scheduleTone(ctx, {
    freq: 660,
    rampTo: 980,
    duration: 0.075,
    type: 'square',
    volume: 0.08,
  })
}

export async function playPackCollect() {
  const ctx = await ensureRunning()
  if (!ctx) return
  scheduleTone(ctx, {
    freq: 880,
    rampTo: 1320,
    duration: 0.08,
    type: 'sine',
    volume: 0.1,
  })
}

export async function playPackRevealNormal() {
  const ctx = await ensureRunning()
  if (!ctx) return
  ;[523.25, 659.25, 783.99].forEach((freq, index) => {
    scheduleTone(ctx, {
      freq,
      duration: 0.32,
      type: 'triangle',
      volume: 0.07,
      when: index * 0.055,
    })
  })
}

export async function playPackRevealTop() {
  const ctx = await ensureRunning()
  if (!ctx) return
  const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5]
  notes.forEach((freq, index) => {
    scheduleTone(ctx, {
      freq,
      duration: 0.52,
      type: 'sine',
      volume: 0.105,
      when: index * 0.075,
    })
    scheduleTone(ctx, {
      freq: freq * 1.5,
      duration: 0.42,
      type: 'sine',
      volume: 0.026,
      when: index * 0.075 + 0.01,
    })
  })

  const padStart = ctx.currentTime + notes.length * 0.075
  ;[261.63, 327.03, 392, 523.25].forEach((freq, index) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    osc.detune.value = (index - 1.5) * 4
    gain.gain.setValueAtTime(0.0001, padStart)
    gain.gain.exponentialRampToValueAtTime(0.045, padStart + 0.2)
    gain.gain.exponentialRampToValueAtTime(0.0001, padStart + 1.15)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(padStart)
    osc.stop(padStart + 1.25)
  })
}

export async function playPackRevealSpecial() {
  const ctx = await ensureRunning()
  if (!ctx) return
  const now = ctx.currentTime
  scheduleTone(ctx, {
    freq: 130,
    rampTo: 38,
    duration: 0.62,
    type: 'sine',
    volume: 0.24,
  })

  const duration = 0.9
  const src = ctx.createBufferSource()
  src.buffer = makeNoise(ctx, duration)
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.Q.value = 1.45
  bp.frequency.setValueAtTime(680, now)
  bp.frequency.exponentialRampToValueAtTime(8200, now + duration)
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(0.14, now + duration - 0.06)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration + 0.05)
  src.connect(bp)
  bp.connect(gain)
  gain.connect(ctx.destination)
  src.start(now)
  src.stop(now + duration + 0.08)

  const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98, 2093]
  notes.forEach((freq, index) => {
    scheduleTone(ctx, {
      freq,
      duration: 0.58,
      type: 'sine',
      volume: 0.12,
      when: index * 0.082,
    })
    scheduleTone(ctx, {
      freq: freq * 1.5,
      duration: 0.48,
      type: 'sine',
      volume: 0.035,
      when: index * 0.082 + 0.012,
    })
  })

  const padStart = now + notes.length * 0.082
  ;[261.63, 327.03, 392, 523.25, 659.25].forEach((freq, index) => {
    const osc = ctx.createOscillator()
    const gainNode = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    osc.detune.value = (index - 2) * 5
    gainNode.gain.setValueAtTime(0.0001, padStart)
    gainNode.gain.exponentialRampToValueAtTime(0.055, padStart + 0.24)
    gainNode.gain.exponentialRampToValueAtTime(0.0001, padStart + 1.8)
    osc.connect(gainNode)
    gainNode.connect(ctx.destination)
    osc.start(padStart)
    osc.stop(padStart + 1.95)
  })

  scheduleTone(ctx, {
    freq: 3135.96,
    duration: 1.35,
    type: 'sine',
    volume: 0.08,
    when: 0.62,
  })
  scheduleTone(ctx, {
    freq: 4186,
    duration: 1.05,
    type: 'sine',
    volume: 0.045,
    when: 0.7,
  })
}

// Acuñado del hanko (rito de iniciación) — golpe sub con el peso del sello,
// crack metálico del impacto y un ring de moneda recién acuñada que decae.
export async function playAcunado() {
  const ctx = await ensureRunning()
  if (!ctx) return
  const now = ctx.currentTime
  // Golpe sub (el peso del sello)
  const sub = ctx.createOscillator()
  const subGain = ctx.createGain()
  sub.type = 'sine'
  sub.frequency.setValueAtTime(170, now)
  sub.frequency.exponentialRampToValueAtTime(46, now + 0.2)
  subGain.gain.setValueAtTime(0, now)
  subGain.gain.linearRampToValueAtTime(0.3, now + 0.006)
  subGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24)
  sub.connect(subGain)
  subGain.connect(ctx.destination)
  sub.start(now)
  sub.stop(now + 0.26)
  // Crack del impacto
  const crack = ctx.createBufferSource()
  crack.buffer = getNoiseBuffer(ctx, 0.12)
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.setValueAtTime(1500, now)
  bp.Q.value = 3
  const crackGain = ctx.createGain()
  crackGain.gain.setValueAtTime(0.16, now)
  crackGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.11)
  crack.connect(bp)
  bp.connect(crackGain)
  crackGain.connect(ctx.destination)
  crack.start(now)
  // Ring metálico (la moneda recién acuñada)
  ;[2093, 3135.96].forEach((freq, i) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(freq, now + 0.015)
    gain.gain.setValueAtTime(0, now + 0.015)
    gain.gain.linearRampToValueAtTime(i === 0 ? 0.05 : 0.028, now + 0.03)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.6)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(now + 0.015)
    osc.stop(now + 0.65)
  })
}

// Lavado grave — la aguada avanzando (t0→t+600). Ruido pasabajos que cae
// de 420→110Hz: agua y tinta, sin brillo metálico.
export async function playVerdictWash() {
  const ctx = await ensureRunning()
  if (!ctx) return
  const now = ctx.currentTime
  const dur = 0.6
  const src = ctx.createBufferSource()
  src.buffer = getNoiseBuffer(ctx, 0.25)
  src.loop = true
  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.Q.value = 0.8
  filter.frequency.setValueAtTime(420, now)
  filter.frequency.exponentialRampToValueAtTime(110, now + dur)
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(0.11, now + 0.07)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + dur)
  src.connect(filter)
  filter.connect(gain)
  gain.connect(ctx.destination)
  src.start(now)
  src.stop(now + dur + 0.03)
}

// Tick de odómetro — cada ~8% del lado líder (ODOMETER_TICK_EVERY_PCT).
// Blip mínimo de 28ms; el caller no necesita pasar el paso: la alternancia
// interna evita la fatiga de un mismo tono repetido ~12 veces.
let _verdictTickFlip = false
export async function playVerdictTick() {
  const ctx = await ensureRunning()
  if (!ctx) return
  const now = ctx.currentTime
  _verdictTickFlip = !_verdictTickFlip
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'square'
  osc.frequency.setValueAtTime(_verdictTickFlip ? 1320 : 1480, now)
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(0.035, now + 0.004)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.028)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(now)
  osc.stop(now + 0.04)
}

// Golpe seco del sello 票 — variante corta y seca del acuñado: sub con el
// peso del hanko + crack filtrado, sin ring metálico (esto es papel).
export async function playVerdictStamp() {
  const ctx = await ensureRunning()
  if (!ctx) return
  const now = ctx.currentTime
  const sub = ctx.createOscillator()
  const subGain = ctx.createGain()
  sub.type = 'sine'
  sub.frequency.setValueAtTime(165, now)
  sub.frequency.exponentialRampToValueAtTime(48, now + 0.16)
  subGain.gain.setValueAtTime(0, now)
  subGain.gain.linearRampToValueAtTime(0.28, now + 0.005)
  subGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2)
  sub.connect(subGain)
  subGain.connect(ctx.destination)
  sub.start(now)
  sub.stop(now + 0.22)
  const crack = ctx.createBufferSource()
  crack.buffer = getNoiseBuffer(ctx, 0.12)
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.setValueAtTime(1350, now)
  bp.Q.value = 3
  const crackGain = ctx.createGain()
  crackGain.gain.setValueAtTime(0.14, now)
  crackGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1)
  crack.connect(bp)
  bp.connect(crackGain)
  crackGain.connect(ctx.destination)
  crack.start(now)
}
// Hito de racha — tick seco (hyōshigi) + campanilla grave que decae.
// Federación sobria: nada de arpegio arcade.
export async function playStreakHito() {
  const ctx = await ensureRunning()
  if (!ctx) return
  const now = ctx.currentTime
  // Tick seco
  const tick = ctx.createOscillator()
  const tickGain = ctx.createGain()
  tick.type = 'triangle'
  tick.frequency.setValueAtTime(1320, now)
  tick.frequency.exponentialRampToValueAtTime(740, now + 0.03)
  tickGain.gain.setValueAtTime(0, now)
  tickGain.gain.linearRampToValueAtTime(0.09, now + 0.004)
  tickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.07)
  tick.connect(tickGain)
  tickGain.connect(ctx.destination)
  tick.start(now)
  tick.stop(now + 0.09)
  // Campanilla grave (bonshō pequeña): fundamental G3 + parciales suaves
  ;[
    [196, 0.07],
    [294, 0.028],
    [392, 0.016],
  ].forEach(([freq, vol]) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(freq, now + 0.05)
    gain.gain.setValueAtTime(0, now + 0.05)
    gain.gain.linearRampToValueAtTime(vol, now + 0.07)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.15)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(now + 0.05)
    osc.stop(now + 1.2)
  })
}

/**
 * Obturador de cámara (export de tier list): clic del espejo + clac de la
 * cortinilla — dos ráfagas de ruido filtrado en bandpass, sintetizadas.
 */
export async function playShutter() {
  const ctx = await ensureRunning()
  if (!ctx) return
  const click = (t0, freq, dur, vol) => {
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < d.length; i++) {
      d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 2.4
    }
    const src = ctx.createBufferSource()
    src.buffer = buf
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = freq
    bp.Q.value = 1.1
    const g = ctx.createGain()
    g.gain.value = vol
    src.connect(bp)
    bp.connect(g)
    g.connect(ctx.destination)
    src.start(t0)
  }
  const now = ctx.currentTime + 0.01
  click(now, 2600, 0.03, 0.5)
  click(now + 0.07, 1450, 0.05, 0.38)
}
