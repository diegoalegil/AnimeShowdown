// V-8 onboarding: generador de sugerencias de username con sabor anime.
//
// Determinístico (hash de la base, sin Math.random) para que sea puro y
// estable entre renders — el React Compiler no tolera Math.random en hooks
// puros, y queremos que las mismas iniciales den siempre las mismas ideas.
// Combina la "base" del usuario (su username/email actual) con prefijos y
// sufijos de jerga otaku, respetando el formato del backend (3-30,
// [A-Za-z0-9_-]).

const PREFIJOS = [
  'Shadow',
  'Senpai',
  'Kage',
  'Ronin',
  'Otaku',
  'Sensei',
  'Hikari',
  'Kuro',
  'Akira',
  'Zenith',
]

const SUFIJOS = [
  'Hokage',
  'DelDojo',
  'noKami',
  'Senpai',
  'Ronin',
  'Sama',
  'Slayer',
  'Ascends',
  'Sensei',
  'Kaiju',
]

const NUMEROS = ['42', '07', '99', '21', '64', '13', '88']

const USERNAME_MAX = 30
const USERNAME_MIN = 3

function hashStr(s) {
  let h = 0
  for (let i = 0; i < s.length; i += 1) {
    h = (h << 5) - h + s.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h)
}

// Limpia la base a [A-Za-z0-9] (quita _- de los bordes, espacios, acentos
// raros) y capitaliza la primera letra para que "narutofan" -> "Narutofan".
function limpiarBase(raw) {
  const at = String(raw || '').indexOf('@')
  const local = at > 0 ? String(raw).slice(0, at) : String(raw || '')
  const limpio = local.replace(/[^A-Za-z0-9]/g, '')
  if (!limpio) return 'Otaku'
  return limpio.charAt(0).toUpperCase() + limpio.slice(1)
}

function recortar(candidato) {
  if (candidato.length <= USERNAME_MAX) return candidato
  return candidato.slice(0, USERNAME_MAX)
}

/**
 * Devuelve hasta `cantidad` sugerencias de username válidas y únicas a partir
 * de una base (username actual o parte local del email). Sin efectos, pura.
 */
export function generarSugerenciasUsername(base, cantidad = 4) {
  const limpia = limpiarBase(base)
  const semilla = hashStr(limpia || 'otaku')

  const pick = (arr, offset) => arr[(semilla + offset) % arr.length]

  const candidatos = [
    `${pick(PREFIJOS, 1)}${limpia}`,
    `${limpia}_${pick(SUFIJOS, 2)}`,
    `${pick(PREFIJOS, 5)}${pick(SUFIJOS, 3)}`,
    `${limpia}_${pick(NUMEROS, 4)}`,
    `${pick(PREFIJOS, 7)}${limpia}_${pick(NUMEROS, 6)}`,
  ]

  const vistos = new Set()
  const out = []
  for (const c of candidatos) {
    const valido = recortar(c)
    const key = valido.toLowerCase()
    if (valido.length < USERNAME_MIN || vistos.has(key)) continue
    vistos.add(key)
    out.push(valido)
    if (out.length >= cantidad) break
  }
  return out
}
