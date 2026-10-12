// Omikuji: la suerte del día. Todo lo que no es pantalla vive aquí: las
// cinco suertes con sus pesos tradicionales, la tirada determinista por día y
// por navegador (la «sal» que guarda cada visitante) y el personaje guardián.
import { crearAzar, elegirUno, enteroEntre } from '../comun/azar.js'
import { personajeAlAzar } from '../comun/cartas.js'

/**
 * Las cinco suertes en su orden tradicional, de mejor a peor. Los pesos son
 * los de Meiji-jingū (aprox.): 大吉 31 %, 中吉 17 %, 小吉 18 %, 末吉 17 %, 凶 17 %.
 * `tono` elige el color del papel: oro | cian | papel | tinta | carmesi.
 */
export const SUERTES = [
  {
    clave: 'daikichi',
    kanji: '大吉',
    romaji: 'daikichi',
    nombre: 'Gran fortuna',
    peso: 31,
    tono: 'oro',
    texto: 'El cosmos sonríe. Todo lo que toques hoy sale bien: abre, juega y reta sin miedo.',
    consejos: [
      'Día propicio para arriesgar: lánzate a los retos difíciles.',
      'Abre un sobre hoy: la fortuna está de tu parte.',
      'Todo cae de pie. Prueba el juego que peor se te da.',
    ],
  },
  {
    clave: 'chukichi',
    kanji: '中吉',
    romaji: 'chū-kichi',
    nombre: 'Fortuna media',
    peso: 17,
    tono: 'cian',
    texto: 'Vientos favorables. Tus elecciones serán acertadas si confías en tu instinto otaku.',
    consejos: [
      'Confía en tu instinto: hoy aciertas más de lo que crees.',
      'Una ronda más de la que tenías pensada: esa es la buena.',
      'El viento sopla a favor; no lo desaproveches quedándote quieto.',
    ],
  },
  {
    clave: 'shokichi',
    kanji: '小吉',
    romaji: 'shō-kichi',
    nombre: 'Pequeña fortuna',
    peso: 18,
    tono: 'papel',
    texto: 'Suerte discreta pero constante. Las pequeñas victorias de hoy plantan árboles mañana.',
    consejos: [
      'Las pequeñas victorias de hoy plantan la racha de mañana.',
      'Juega corto y seguro: hoy ganan los pacientes.',
      'Revisa tu álbum: hay una carta que te falta y no lo sabías.',
    ],
  },
  {
    clave: 'suekichi',
    kanji: '末吉',
    romaji: 'sue-kichi',
    nombre: 'Fortuna tardía',
    peso: 17,
    tono: 'tinta',
    texto: 'Empieza despacio, termina fuerte. Reserva tus mejores rondas para la tarde.',
    consejos: [
      'Empieza despacio: tu mejor momento llega al caer la tarde.',
      'Lo que no salga a la primera saldrá a la tercera.',
      'Guarda el sobre bueno para el final del día.',
    ],
  },
  {
    clave: 'kyo',
    kanji: '凶',
    romaji: 'kyō',
    nombre: 'Mala suerte',
    peso: 17,
    tono: 'carmesi',
    texto:
      'Las cosas se tuercen pero no se rompen. Por tradición, ata tu omikuji a un árbol y déjalo allí; mañana hay otra.',
    consejos: [
      'Las cosas se tuercen sin romperse: paso firme y sin prisa.',
      'Hoy no es día de rachas. Mira cartas, no las persigas.',
      'Ata el papel al pino y vuelve mañana con la mano limpia.',
    ],
  },
]

export const PESO_TOTAL = SUERTES.reduce((suma, s) => suma + s.peso, 0)

/** La clave de guardado de este juego: la sal del visitante y el día ya revelado. */
export const CLAVE_ALMACEN = 'animeshowdown:juegos:omikuji:v1'

/** Varillas numeradas del cilindro: 第 1 番 … 第 100 番. */
export const VARILLAS = 100

/** Una suerte por peso: `rng()` en [0, 1) recorre el acumulado en orden tradicional. */
export function elegirSuerte(rng = Math.random) {
  let resto = rng() * PESO_TOTAL
  for (const suerte of SUERTES) {
    resto -= suerte.peso
    if (resto < 0) return suerte
  }
  return SUERTES[SUERTES.length - 1]
}

/** Sal nueva para un navegador: un entero de 31 bits que se guarda una sola vez. */
export const nuevaSal = (rng = Math.random) => Math.floor(rng() * 0x7fffffff)

/** true si la sal leída del disco sirve (entero no negativo). */
export const esSal = (sal) => Number.isInteger(sal) && sal >= 0

/**
 * La fortuna de un día para una sal: la misma mientras no cambie ninguno de
 * los dos. Devuelve la suerte, el número de varilla, el consejo y el
 * personaje guardián del día.
 */
export function fortunaDelDia(dia, sal) {
  const rng = crearAzar(`omikuji:${dia}:${sal}`)
  const suerte = elegirSuerte(rng)
  const numero = enteroEntre(1, VARILLAS, rng)
  const consejo = elegirUno(suerte.consejos, rng)
  const guardian = personajeAlAzar(rng)
  return { dia, suerte, numero, consejo, guardian }
}

/** Texto para el portapapeles: «🎋 Omikuji — 2026-10-12 / 大吉 (daikichi) · Gran fortuna». */
export function textoCompartir({ dia, suerte, numero, guardian }) {
  const lineas = [`🎋 Omikuji — ${dia}`, `${suerte.kanji} (${suerte.romaji}) · ${suerte.nombre} · 第 ${numero} 番`]
  if (guardian) lineas.push(`Guardián del día: ${guardian.nombre} (${guardian.anime})`)
  return lineas.join('\n')
}

/** Porcentaje de una suerte, para la tabla de las cinco (31 % …). */
export const porcentaje = (suerte) => Math.round((suerte.peso / PESO_TOTAL) * 100)
