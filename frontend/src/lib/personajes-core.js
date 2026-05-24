const IMAGE_CACHE_BUST_VERSION = '2026-05-21'
const IMAGE_CACHE_BUST_PREFIXES = [
  '/img/Erased/',
  '/img/Fullmetal_Alchemist/',
]

export const CATALOGO_PERSONAJES_STORAGE_KEY = 'animeshowdown.catalogo-personajes.v1'

export const personajes = []

export const PERSONAJE_SLUG_ALIASES = {
  L: 'l',
  all_might: 'allmight',
  monkey_d_luffy: 'luffy',
  roronoa_zoro: 'zoro',
  jiraiya: 'jiraya',
  hinata_hyuga: 'hinata',
  katsuki_bakugou: 'bakugo',
  yuji_itadori: 'itadori',
  shinobu_kocho: 'shinobu',
  boa_hancock_alt: 'boa_hancock',
}

export function canonicalPersonajeSlug(slug) {
  return PERSONAJE_SLUG_ALIASES[slug] ?? slug
}

function versionarImagenSiHaceFalta(src) {
  if (!src || !IMAGE_CACHE_BUST_PREFIXES.some((prefix) => src.startsWith(prefix))) {
    return src
  }
  return `${src}${src.includes('?') ? '&' : '?'}v=${IMAGE_CACHE_BUST_VERSION}`
}

export function normalizarPersonajeCatalogo(personaje) {
  if (!personaje) return null
  const imagen = personaje.imagenUrl ?? personaje.imagen ?? null
  return {
    ...personaje,
    slug: canonicalPersonajeSlug(personaje.slug),
    imagen,
    imagenUrl: imagen,
  }
}

export function normalizarCatalogoPersonajes(catalogo) {
  return Array.isArray(catalogo)
    ? catalogo.map(normalizarPersonajeCatalogo).filter(Boolean)
    : []
}

// Cuando syncCatalogoPersonajes recibe datos reales (catálogo hidratado
// desde el backend o localStorage), emitimos un evento global para que
// los <PersonajeImg> ya montados puedan rerendear y volver a evaluar
// imagenPersonaje(slug) — antes resolvía a `/img/_missing/...` (404) si
// el catálogo aún no estaba poblado, dejaba la card en estado errored
// permanente y mostraba PersonajePlaceholder aunque la imagen real
// existiera. Con el evento, cada PersonajeImg resetea su status local y
// vuelve a intentar el load del src correcto.
export const CATALOGO_PERSONAJES_HYDRATED_EVENT = 'animeshowdown:catalogo-personajes-hidratado'

export function syncCatalogoPersonajes(catalogo) {
  const normalizado = normalizarCatalogoPersonajes(catalogo)
  if (normalizado.length === 0) return personajes
  const cambiado =
    personajes.length !== normalizado.length ||
    personajes.some((p, i) => p.slug !== normalizado[i]?.slug || p.imagenUrl !== normalizado[i]?.imagenUrl)
  personajes.splice(0, personajes.length, ...normalizado)
  if (cambiado && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CATALOGO_PERSONAJES_HYDRATED_EVENT))
  }
  return personajes
}

export function readCatalogoPersonajesSnapshot() {
  if (personajes.length > 0) return personajes
  if (typeof localStorage === 'undefined') return personajes
  try {
    const raw = localStorage.getItem(CATALOGO_PERSONAJES_STORAGE_KEY)
    if (!raw) return personajes
    return syncCatalogoPersonajes(JSON.parse(raw))
  } catch {
    return personajes
  }
}

readCatalogoPersonajesSnapshot()

// Prefijo sentinel para señalar "catálogo no hidratado, slug no resuelve".
// Antes este path era /img/_missing/ pero generaba 404 → onError →
// errored=true → la card quedaba atrapada en PersonajePlaceholder aunque
// el catálogo llegara después. Ahora cualquier consumidor que quiera
// distinguir "esperando catálogo" puede comparar contra MISSING_IMAGE_PREFIX
// (lo hace PersonajeImg). Los callers legacy que ponen src={imagenPersonaje(...)}
// a un <img> seguirán viendo 404 — eso es comportamiento aceptable
// transitorio mientras hidrata.
export const MISSING_IMAGE_PREFIX = '/img/_missing/'

export function imagenPersonaje(slug) {
  const canonical = canonicalPersonajeSlug(slug)
  const fromCache = readCatalogoPersonajesSnapshot().find((p) => p.slug === canonical)
  return versionarImagenSiHaceFalta(fromCache?.imagenUrl ?? `${MISSING_IMAGE_PREFIX}${canonical}.webp`)
}

export function getPersonajeBySlug(slug) {
  const canonical = canonicalPersonajeSlug(slug)
  return readCatalogoPersonajesSnapshot().find((p) => p.slug === canonical) ?? null
}

export function getIndicePersonaje(slug) {
  const canonical = canonicalPersonajeSlug(slug)
  return readCatalogoPersonajesSnapshot().findIndex((p) => p.slug === canonical)
}

const POPULARIDAD = {
  luffy: 100, levi: 99, l: 98, zoro: 95, light_yagami: 93, naruto: 91,
  itachi: 88, gojo: 86, mikasa: 84, kaneki: 82, kakashi: 79, rem_and_ram: 76,
  megumin: 73,
  saber: 70, itadori: 68, sasuke: 67, sukuna: 65, frieren: 65, anya_forger: 65,
  denji: 65, ai_hoshino: 62, hinata: 62, madara: 62, makima: 62,
  rei: 60, ichigo: 60, yoriichi: 60, kaguya_shinomiya: 60, zerotwo: 60,
  asuka: 58, marin_kitagawa: 58, mai_sakurajima: 55, jiraya: 55, minato: 55,
  rengoku: 55, deku: 55, bakugo: 55, shoto_todoroki: 55, boa_hancock: 55,
  tatsumaki: 55, erza: 55, yor_forger: 55, yuta_okkotsu: 55, power: 55,
  nezuko: 52, kirito: 50, asuna: 50, allmight: 50, akaza: 50, muzan: 50,
  shinobu: 50, zenitsu_agatsuma: 50, hashirama: 50, tsunade: 50, sakura: 50,
  pain: 50, robin: 50, nami: 50, bulma: 50, miku: 50, emilia: 50,
  inosuke: 48, douma: 48, mitsuri_kanroji: 48, kanao_tsuyuri: 48, mahiru_shiina: 48,
  android_18: 45, kokushibo: 45, gyomei_himejima: 45, tokito: 45, tomioka: 45,
  nobara: 45, esdeath: 45, sanemi: 42, misa_amane: 42, momo: 42,
  toga: 50, lemillion: 38, senku_toji: 38, touka_kirishima: 38, orihime: 38,
  ochaco_uraraka: 38, ash_ketchum: 38, tomura_shigaraki: 38, reze: 40,
  obanai: 40, aqua: 40, kurumi: 40, yuno: 40, natsuki_subaru: 40,
  sasori: 35, all_for_one: 35, your_name: 35, kanade_tachibana: 35, sinon_asada: 35,
  shiro_nai: 35, kuroneko: 35, rias: 35, mashiro_shiina_sakurasou: 35,
  rikka_takanashi: 32, alisa_mikhailovna_kujou: 32, sora_nai: 32, froppy: 32,
  prision_school: 30, akeno_himejima: 30, albedo: 30, nejire_hado: 30,
  serena_pokemon: 28, kirino_kousaka: 28, umaru_doma: 28, yuri_nakamura: 28,
  rio_futaba: 25, tomoe_koga: 25, nao_tomori: 25, may_pokemon: 25, hana_midorikawa: 25,
  yu_takeyama: 25, toru_hagakure: 22, izuna_hatsuse: 22, ken_takakura: 22,
  himiko: 22, masami_iwasawa: 22, misa_kurobane: 18, aira_shitadori: 18,
  mazinkaiser: 15,
}

export function getPopularidad(slug) {
  return POPULARIDAD[canonicalPersonajeSlug(slug)] ?? 30
}

function hashSlug(slug) {
  let h = 0
  for (let i = 0; i < slug.length; i++) {
    h = (h << 5) - h + slug.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h)
}

/**
 * ⚠️  ESTADÍSTICAS SINTÉTICAS — NO SON DATOS REALES.
 *
 * <p>El ELO, wins y losses devueltos por esta función NO vienen del backend.
 * Se calculan determinísticamente a partir del slug del personaje y la tabla
 * {@link POPULARIDAD} hardcodeada. Misma entrada → mismo output, pero NO
 * reflejan votos reales de los usuarios.
 *
 * <p><b>Reglas de honestidad en UI</b>: cualquier consumer DEBE etiquetar visualmente el valor
 * como "base", "estimado", "·b" o equivalente, o redirigir al ranking
 * competitivo real (/ranking) que sí está ponderado por SUM(v.peso). Mostrar
 * "ELO 1850" sin contexto es engañoso para el usuario
 * porque sugiere que el número se mueve con sus votos — no lo hace.
 *
 * <p>El flag {@code _sintetico: true} en el retorno permite que un consumer
 * detecte programáticamente que el dato es estimado y aplique etiqueta sin
 * tener que recordar la convención de copy.
 *
 * <p>Por qué seguimos teniéndola: la UI necesitaba mostrar números antes de
 * que el backend tuviera suficientes votos como para calcular un ranking
 * real (cold start del producto). Era preferible mostrar valores razonables
 * que cards vacías a "ELO --". Con el backend ya devolviendo ranking real
 * por votos ponderados, esto es deuda técnica visible.
 *
 * <p><b>Migración pendiente:</b>
 * <ol>
 *   <li>Reemplazar todos los consumers (15+ sitios) por una query a
 *       {@code /api/votos/ranking/segmentado} que devuelve votos físicos
 *       + pesoVotos ponderado por slug, o exponer el campo {@code elo}
 *       calculado server-side desde el peso.</li>
 *   <li>Cuando el backend no tenga ELO para un slug (personaje nuevo sin
 *       votos), devolver {@code null} en vez de generar valor sintético —
 *       la UI puede mostrar "Sin partidas" en vez de un número engañoso.</li>
 *   <li>Borrar esta función + POPULARIDAD una vez los consumers migren.</li>
 * </ol>
 *
 * <p>Consumers actuales revisados (rg "getStatsPersonaje" frontend/src,
 * 2026-05-23, ~60 referencias en 15 archivos):
 * <ul>
 *   <li>{@code Hero.jsx} — "Top ELO base" stat ✅ etiquetado.</li>
 *   <li>{@code PersonajeCard.jsx} — badges con sufijo "·b"/"·e" ✅.</li>
 *   <li>{@code PersonajeDetailPage.jsx} — labels "ELO base", "Récord est." ✅.</li>
 *   <li>{@code SectionPulso.jsx} — usa fallback (CAMPEON_FALLBACK) cuando
 *       backend no tiene votos, eyebrow honesto ("Top del catálogo") ✅.</li>
 *   <li>{@code RankingPage.jsx}, {@code TorneosPage.jsx},
 *       {@code TvModePage.jsx}, {@code DueloVersusPage.jsx},
 *       {@code EventoDetailPage.jsx}, {@code AnidelPage.jsx},
 *       {@code HigherOrLowerPage.jsx} — pending de etiquetar o migrar.</li>
 *   <li>{@code CardMiRoster.jsx}, {@code PersonajesPage.jsx},
 *       {@code animes.js} — pending de etiquetar o migrar.</li>
 * </ul>
 *
 * @deprecated Migrar a ELO real del backend en {@code /api/votos/ranking/segmentado}.
 * @returns {{elo:number, wins:number, losses:number, _sintetico:true}}
 *   El flag _sintetico permite a los consumers detectar que el dato no
 *   viene de votos reales y aplicar el copy/etiqueta correspondiente.
 */
export function getStatsPersonaje(slug) {
  const popularidad = getPopularidad(slug)
  const h = hashSlug(slug)
  const variacion = h % 16 - 8
  const elo = 1500 + popularidad * 7 + variacion
  const wins = Math.round(5 + popularidad / 2 + (h % 8))
  const losses = Math.round(3 + (100 - popularidad) / 4 + (h % 5))
  return { elo, wins, losses, _sintetico: true }
}

/**
 * Variante explícita del nombre cuando el call site quiere SEÑALAR que sabe
 * que el dato es estimado. Funcionalmente equivalente a getStatsPersonaje;
 * útil durante la migración para grep distinguir qué consumers aún usan la
 * estimación vs cuáles pasaron a backend real.
 *
 * @deprecated Misma migración que getStatsPersonaje: usar backend real.
 */
export function getStatsPersonajeEstimado(slug) {
  return getStatsPersonaje(slug)
}
