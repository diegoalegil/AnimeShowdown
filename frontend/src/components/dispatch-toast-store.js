/**
 * Partes de combate — store de los toasts (sin React, sin framer).
 *
 * Núcleo del sustituto de sonner: un store de módulo (como el de sonner)
 * que `toast()` alimenta desde cualquier sitio y al que el viewport se
 * suscribe vía useSyncExternalStore. Vive en un .js puro a propósito:
 *  - cero dependencias de React/framer → no engorda el chunk eager que
 *    importan los 65 call-sites de `toast`.
 *  - DispatchToast.jsx (destino del alias `sonner`) re-exporta `toast`/
 *    `__timerCount` desde aquí y el viewport (DispatchToasterView.jsx) lee
 *    el snapshot y reenvía intenciones (descartar/pausar/retirar).
 *
 * SSR-safe: el cuerpo de módulo no toca window/document; `schedule()` y
 * compañía (que usan window.setTimeout/performance) solo corren cuando se
 * empuja un toast en cliente. Durante el prerender no se empuja ninguno.
 */

const TTL_BY_TYPE = { success: 5000, info: 5000, achievement: 6000, error: 7000 }

let idSeq = 1
let maxVisible = 3
let motionOff = false
let soundFn = null

let active = [] // tiras visibles (incluye salientes)
let queue = [] // FIFO en espera de hueco
// seq INDEPENDIENTE por región: si compartieran uno, disparar un toast polite
// mutaría el texto de la región assertive (paridad del padding) y el lector
// re-anunciaría el último error. Cada región solo cambia con su propio tipo.
let announce = { polite: '', assertive: '', politeSeq: 0, assertiveSeq: 0 }
let snapshot = null
const listeners = new Set()


function commit() {
  snapshot = {
    active: active.slice(),
    queue: queue.slice(),
    announce: { ...announce },
  }
  listeners.forEach((l) => {
    try {
      l()
    } catch {
      /* un listener roto no tumba el store */
    }
  })
}

/* ---- temporizadores pausables: ÚNICA puerta a setTimeout -------------
   timerCount() censa los timeouts vivos — la demo verifica que tras una
   ráfaga + clearAll el censo vuelve a 0 (cero fugas). */
const timers = new Map() // key -> { fn, remaining, startedAt, paused, handle }

function schedule(key, fn, ms) {
  clearKey(key)
  const rec = { fn, remaining: ms, startedAt: performance.now(), paused: false, handle: 0 }
  rec.handle = window.setTimeout(() => {
    timers.delete(key)
    fn()
  }, ms)
  timers.set(key, rec)
}
function pauseKey(key) {
  const rec = timers.get(key)
  if (!rec || rec.paused) return
  window.clearTimeout(rec.handle)
  rec.remaining -= performance.now() - rec.startedAt
  rec.paused = true
}
function resumeKey(key) {
  const rec = timers.get(key)
  if (!rec || !rec.paused) return
  rec.paused = false
  rec.startedAt = performance.now()
  rec.handle = window.setTimeout(() => {
    timers.delete(key)
    rec.fn()
  }, Math.max(0, rec.remaining))
}
function clearKey(key) {
  const rec = timers.get(key)
  if (!rec) return
  if (!rec.paused) window.clearTimeout(rec.handle)
  timers.delete(key)
}

/** Censo de timeouts vivos del sistema — solo para tests/demo. */
export function __timerCount() {
  return timers.size
}

/* La mecha arranca a +320ms (la tira ya aterrizó); el timer usa la misma
   guardia para que mecha y descarte mueran juntos. Reduced-motion: 0. */
const enterGuard = () => (motionOff ? 0 : 320)

function armEntry(t) {
  if (t.ttl > 0) schedule(`ttl:${t.id}`, () => dismiss(t.id, 'natural'), t.ttl + enterGuard())
  if (soundFn) {
    // El golpe (playAcunado) suena en el frame del impacto del sello.
    schedule(
      `snd:${t.id}`,
      () => {
        try {
          soundFn(t.type)
        } catch {
          /* audio nunca rompe UI */
        }
      },
      motionOff ? 30 : 200,
    )
  }
}

function resolveTtl(p, type) {
  const raw = p.ttl != null ? p.ttl : p.duration
  if (raw == null) return TTL_BY_TYPE[type] || 5000
  if (raw === 0 || raw === Infinity) return 0 // persistente: cierre solo manual
  return raw
}

function pushAnnounce(t) {
  const text = t.title + (t.data ? ` — ${t.data}` : '')
  if (t.type === 'error') {
    announce = { ...announce, assertive: text, assertiveSeq: announce.assertiveSeq + 1 }
  } else {
    announce = { ...announce, polite: text, politeSeq: announce.politeSeq + 1 }
  }
}

function push(p) {
  const type = p.type || 'info'
  const t = {
    id: p.id != null ? String(p.id) : `dt-${idSeq++}`,
    type,
    title: p.title || '',
    data: p.data || p.description || '',
    action: p.action || null,
    ttl: resolveTtl(p, type),
    held: false,
    leaving: null,
  }
  // Gatear con active.length (incluye las salientes), no countVisible: si un
  // toast entra durante la ventana de salida de otro, ambos coexistirían
  // visibles y se rompería el invariante ≤3. Esperan en cola FIFO hasta que la
  // saliente se retira de verdad (remove()).
  if (active.length < maxVisible) {
    active = active.concat(t)
    armEntry(t)
  } else {
    queue = queue.concat(t) // FIFO: jamás >3 pisándose
  }
  pushAnnounce(t)
  commit()
  return t.id
}

const find = (id) => active.find((x) => x.id === id) || null

/** hover/focus/drag: pausa mecha (CSS vía data-held) Y timer (aquí). */
export function hold(id, held) {
  const t = find(id)
  if (!t || t.leaving || t.held === held) return
  t.held = held
  active = active.slice()
  if (held) pauseKey(`ttl:${id}`)
  else resumeKey(`ttl:${id}`)
  commit()
}

export function dismiss(id, reason) {
  const qi = queue.findIndex((x) => x.id === id)
  if (qi >= 0) {
    queue = queue.slice(0, qi).concat(queue.slice(qi + 1))
    commit()
    return
  }
  const t = find(id)
  if (!t || t.leaving) return
  t.leaving = reason || 'natural'
  active = active.slice()
  clearKey(`ttl:${id}`)
  clearKey(`snd:${id}`)
  // Red de seguridad: si transitionend/onAnimationComplete no llega
  // (pestaña oculta), el reaper retira la tira. remove() es idempotente.
  schedule(`reap:${id}`, () => remove(id), motionOff ? 350 : 650)
  commit()
}

/* Al terminar la salida: retira y promociona la cola FIFO SOLO cuando el
   hueco existe de verdad (jamás 4 tiras visibles durante una salida). */
export function remove(id) {
  clearKey(`ttl:${id}`)
  clearKey(`snd:${id}`)
  clearKey(`reap:${id}`)
  const before = active.length
  active = active.filter((x) => x.id !== id)
  if (active.length === before) return
  while (queue.length > 0 && active.length < maxVisible) {
    const nxt = queue[0]
    queue = queue.slice(1)
    active = active.concat(nxt)
    armEntry(nxt)
  }
  commit()
}

function clearAll() {
  queue = []
  active.slice().forEach((t) => dismiss(t.id, 'natural'))
  commit()
}

export const subscribe = (fn) => {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
export const getSnapshot = () => snapshot
commit()

/* ---- config del modo que ajusta la vista (idempotente) -------------- */
export function setMotionOff(value) {
  motionOff = Boolean(value)
}
export function setMaxVisible(n) {
  maxVisible = Math.max(1, n | 0)
}
export function setSoundFn(fn) {
  soundFn = fn || null
}

/* ════════════════════════════════════════════════════════════════════
   API pública — compatible con las llamadas actuales (sonner).
   ════════════════════════════════════════════════════════════════════ */

const make =
  (type) =>
  /**
   * @param {string} title Título del parte (una línea).
   * @param {object} [opts]
   * @param {string} [opts.description] Cifras/datos — se tipografían en font-mono en la misma línea.
   * @param {number} [opts.duration] ttl en ms. 0 o Infinity → persistente (mecha apagada, cierre manual).
   * @param {{label: string, onClick: function}} [opts.action] Acción accionable (subrayado oro, button real).
   * @param {string|number} [opts.id] Id propio (dedupe externo).
   * @returns {string} id del parte.
   */
  (title, opts) =>
    push({ ...(opts || {}), type, title })

/**
 * Compat sonner: toast(título, opts) → 報; .success 成 · .error 否 (assertive)
 * · .info 報 · .achievement 章 (filo oro) · .dismiss(id?) — sin id, todos.
 */
export const toast = Object.assign(make('info'), {
  success: make('success'),
  error: make('error'),
  info: make('info'),
  // Compat sonner: toast.message es un toast neutro → mismo tipo que info (報).
  // Lo usa ComentariosPersonaje; sin él, toast.message lanzaba TypeError.
  message: make('info'),
  achievement: make('achievement'),
  dismiss: (id) => (id == null ? clearAll() : dismiss(id, 'natural')),
})
