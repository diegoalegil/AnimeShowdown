#!/usr/bin/env node
// Enriquece el catálogo (src/data/*.json) con datos públicos de AniList
// (https://graphql.anilist.co, sin clave) para los minijuegos:
//
// - personajes: `genero` ('F' | 'M' | null), `favs` (favoritos en AniList) y
//   `cumple` ('MM-DD', solo si se conocen mes y día);
// - animes: `anio` de estreno, `generos`, `episodios` y `favs`.
//
// Salvo `genero`, un campo sin dato se omite en vez de guardarse como null.
// Conserva el formato del catálogo (una entrada por línea) y el resto de campos.
//
// Cómo empareja, de más a menos fiable:
//
// 1. busca cada serie por título y se queda con el candidato cuyo título
//    japonés coincide con nuestro `nativo` (o el primero que no sea música);
//    las series ambiguas se fijan a mano en SERIES_FIJADAS;
// 2. recorre los personajes de esa serie (de más a menos favoritos) y los
//    casa por nombre japonés; si no, por nombre latino normalizado (sin
//    tildes, en cualquier orden, también los nombres alternativos);
// 3. los que quedan se buscan uno a uno por nombre, exigiendo que el
//    personaje aparezca en la serie o en sus secuelas (o que su nombre
//    japonés coincida exactamente);
// 4. como último recurso, un mapeo antiguo por id (--antiguo=<ruta.json>,
//    objeto { id: { genero, favourites, anilistName } }), solo si el nombre
//    que encontró se parece al nuestro;
// 5. los personajes que ninguna búsqueda resuelve se fijan a mano por su id
//    de AniList en PERSONAJES_FIJADOS.
//
// La API admite ~30 peticiones por minuto: el script se ciñe a la cabecera
// X-RateLimit-Remaining y a Retry-After, y guarda el progreso en una caché
// (--cache=<ruta>, por defecto en el directorio temporal del sistema) para
// poder cortarlo y reanudarlo. Tarda unos 15-20 minutos de cero.
//
//   node scripts/anilist.mjs [--series] [--cache=<ruta>] [--antiguo=<ruta>] [--informe]
//
//   --series   solo resuelve las series (para revisar las ambiguas antes de
//              gastar peticiones en sus personajes)
//   --informe  no toca la API: imprime la cobertura y los ids sin emparejar
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')
const API = 'https://graphql.anilist.co'
const POR_PAGINA = 25 // máximo que admite la conexión de personajes
const MAX_PAGINAS = 12 // 300 personajes por serie; el resto se busca uno a uno

// Series cuyo título devuelve otra cosa (o nada útil) en la búsqueda: id de
// AniList a usar, o null si no existe como anime (sus personajes se buscan
// uno a uno igualmente).
const SERIES_FIJADAS = {
  'dragon-ball': 813, // Dragon Ball Z: el plantel es de Z y Super
  'fate-grand-order': 103275, // Babylonia (la serie de TV; la búsqueda da los especiales)
  'fullmetal-alchemist': 5114, // Brotherhood
  hellsing: 777, // Hellsing Ultimate
  'hunter-x-hunter': 11061, // la versión de 2011, con todo el plantel
  'monogatari-series': 5081, // Bakemonogatari (la búsqueda da la segunda temporada)
  pokemon: 527, // Pocket Monsters (1997); la búsqueda da una ONA
  vocaloid: null,
}

// Personajes cuya búsqueda por nombre no da con ellos (apodos, títulos,
// variantes): id del personaje en AniList.
const PERSONAJES_FIJADOS = {}

const argumentos = new Map(
  process.argv.slice(2).map((a) => {
    const [clave, valor = true] = a.replace(/^--/, '').split('=')
    return [clave, valor]
  }),
)
const rutaCache = argumentos.get('cache') ?? join(tmpdir(), 'animeshowdown-anilist.json')
const rutaAntiguo = argumentos.get('antiguo')

const leer = (nombre) => JSON.parse(readFileSync(join(raiz, 'src/data', nombre), 'utf8'))
const personajes = leer('personajes.json')
const animes = leer('animes.json')
const antiguo = rutaAntiguo ? JSON.parse(readFileSync(rutaAntiguo, 'utf8')) : {}

// Caché reanudable: { series: { [animeId]: {...} }, personajes: { [id]: {...} } }
const cache = existsSync(rutaCache) ? JSON.parse(readFileSync(rutaCache, 'utf8')) : { series: {}, personajes: {} }
const guardarCache = () => writeFileSync(rutaCache, JSON.stringify(cache))

// ---- Peticiones -----------------------------------------------------------

const dormir = (ms) => new Promise((r) => setTimeout(r, ms))
let proximaPeticion = 0
let peticiones = 0

async function consultar(query, variables) {
  for (let intento = 0; intento < 6; intento++) {
    const espera = proximaPeticion - Date.now()
    if (espera > 0) await dormir(espera)
    proximaPeticion = Date.now() + 2100 // ~28 por minuto aunque la cabecera falte
    peticiones++
    let respuesta
    try {
      respuesta = await fetch(API, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ query, variables }),
      })
    } catch (err) {
      console.warn(`anilist: red (${err.message}); reintento en 10 s`)
      await dormir(10_000)
      continue
    }
    const restantes = Number(respuesta.headers.get('x-ratelimit-remaining'))
    if (Number.isFinite(restantes) && restantes <= 1) proximaPeticion = Date.now() + 61_000
    if (respuesta.status === 429) {
      const segundos = Number(respuesta.headers.get('retry-after')) || 60
      console.warn(`anilist: límite alcanzado; espero ${segundos} s`)
      await dormir(segundos * 1000)
      continue
    }
    if (respuesta.status >= 500) {
      console.warn(`anilist: HTTP ${respuesta.status}; reintento en 15 s`)
      await dormir(15_000)
      continue
    }
    const json = await respuesta.json()
    if (json.errors?.some((e) => e.status !== 404)) throw new Error(json.errors.map((e) => e.message).join('; '))
    return json.data
  }
  throw new Error('anilist: demasiados reintentos')
}

const CAMPOS_PERSONAJE = 'id name { full native alternative } gender favourites dateOfBirth { month day }'

const CONSULTA_SERIES = `query ($busqueda: String) {
  Page(page: 1, perPage: 6) {
    media(search: $busqueda, type: ANIME, sort: [SEARCH_MATCH]) {
      id format seasonYear episodes favourites genres
      title { romaji english native }
      startDate { year }
    }
  }
}`

const CONSULTA_SERIE = `query ($id: Int) {
  Media(id: $id) {
    id format seasonYear episodes favourites genres
    title { romaji english native }
    startDate { year }
  }
}`

const CONSULTA_PERSONAJES_SERIE = `query ($id: Int, $pagina: Int) {
  Media(id: $id) {
    characters(page: $pagina, perPage: ${POR_PAGINA}, sort: [FAVOURITES_DESC]) {
      pageInfo { hasNextPage }
      nodes { ${CAMPOS_PERSONAJE} }
    }
  }
}`

const CONSULTA_PERSONAJE_ID = `query ($id: Int) { Character(id: $id) { ${CAMPOS_PERSONAJE} } }`

const CONSULTA_PERSONAJE = `query ($busqueda: String) {
  Page(page: 1, perPage: 8) {
    characters(search: $busqueda) {
      ${CAMPOS_PERSONAJE}
      media(perPage: 25, type: ANIME, sort: [POPULARITY_DESC]) { nodes { id title { romaji } } }
    }
  }
}`

// ---- Normalización de nombres --------------------------------------------

// Nombre latino: minúsculas, sin tildes ni signos; devuelve también la clave
// con las palabras ordenadas, para casar «Nouzen Shinei» con «Shinei Nouzen».
function clavesLatinas(texto) {
  const limpio = (texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
  if (!limpio) return []
  const palabras = limpio.split(' ')
  return [palabras.join(''), [...palabras].sort().join('|')]
}

// Nombre japonés: sin espacios ni separadores (・＝), con los alfanuméricos
// de ancho completo pasados a ASCII.
function claveNativa(texto) {
  const limpio = (texto ?? '')
    .normalize('NFKC')
    .replace(/[（(].*?[)）]/g, '')
    .replace(/[\s・･=＝·.,、。「」『』]/g, '')
    .toLowerCase()
  return limpio || null
}

function clavesNativas(texto) {
  const clave = claveNativa(texto)
  if (!clave) return []
  // Admite también el orden invertido de un «apellido・nombre» con separador.
  const partes = (texto ?? '').normalize('NFKC').split(/[・･=＝\s]+/).filter(Boolean)
  return partes.length === 2 ? [clave, claveNativa(partes[1] + partes[0])] : [clave]
}

const aGenero = (g) => (g === 'Female' ? 'F' : g === 'Male' ? 'M' : null)
const aCumple = (f) => (f?.month && f?.day ? `${String(f.month).padStart(2, '0')}-${String(f.day).padStart(2, '0')}` : undefined)

function datosPersonaje(nodo, origen) {
  return {
    anilistId: nodo.id,
    anilistNombre: nodo.name.full,
    genero: aGenero(nodo.gender),
    favs: nodo.favourites ?? 0,
    cumple: aCumple(nodo.dateOfBirth),
    origen,
  }
}

// ---- Fase 1: series --------------------------------------------------------

function elegirCandidato(anime, candidatos) {
  const nativa = claveNativa(anime.nativo)
  const porNativo = candidatos.find((m) => nativa && claveNativa(m.title.native) === nativa)
  if (porNativo) return porNativo
  const [latina] = clavesLatinas(anime.titulo)
  const porTitulo = candidatos.find((m) =>
    [m.title.romaji, m.title.english].some((t) => clavesLatinas(t)[0] === latina) && m.format !== 'MUSIC',
  )
  return porTitulo ?? candidatos.find((m) => m.format !== 'MUSIC') ?? null
}

function datosSerie(m) {
  return {
    anilistId: m.id,
    titulo: m.title.english ?? m.title.romaji,
    romaji: m.title.romaji,
    nativo: m.title.native,
    formato: m.format,
    anio: m.seasonYear ?? m.startDate?.year ?? undefined,
    generos: m.genres?.length ? m.genres : undefined,
    episodios: Number.isInteger(m.episodes) ? m.episodes : undefined,
    favs: m.favourites ?? 0,
  }
}

async function resolverSerie(anime) {
  const previa = cache.series[anime.id]
  if (previa && previa.anilistId !== undefined) return previa
  let resultado
  if (anime.id in SERIES_FIJADAS) {
    const id = SERIES_FIJADAS[anime.id]
    resultado = id === null ? { anilistId: null, fijada: true } : { ...datosSerie((await consultar(CONSULTA_SERIE, { id })).Media), fijada: true }
  } else {
    const candidatos = (await consultar(CONSULTA_SERIES, { busqueda: anime.titulo })).Page.media
    const elegido = elegirCandidato(anime, candidatos)
    resultado = elegido ? datosSerie(elegido) : { anilistId: null }
    resultado.porNativo = Boolean(elegido && claveNativa(elegido.title.native) === claveNativa(anime.nativo))
    resultado.candidatos = candidatos.map((m) => `${m.id} ${m.title.romaji} [${m.format} ${m.seasonYear ?? '?'}]`)
  }
  resultado.paginas = 0
  resultado.agotada = false
  cache.series[anime.id] = resultado
  guardarCache()
  return resultado
}

// ---- Fase 2: personajes de cada serie -------------------------------------

function indexar(nodos) {
  const porNativo = new Map()
  const porLatino = new Map()
  const anotar = (mapa, clave, nodo) => {
    if (!clave) return
    // Una clave compartida por dos personajes distintos no sirve para casar
    // (queda anulada, y anulada se queda).
    if (!mapa.has(clave)) mapa.set(clave, nodo)
    else if (mapa.get(clave)?.id !== nodo.id) mapa.set(clave, null)
  }
  for (const nodo of nodos) {
    for (const clave of clavesNativas(nodo.name.native)) anotar(porNativo, clave, nodo)
    for (const texto of [nodo.name.full, ...(nodo.name.alternative ?? [])]) {
      for (const clave of clavesLatinas(texto)) anotar(porLatino, clave, nodo)
    }
  }
  return { porNativo, porLatino }
}

function casar(personaje, { porNativo, porLatino }) {
  for (const clave of clavesNativas(personaje.nativo)) {
    const nodo = porNativo.get(clave)
    if (nodo) return [nodo, 'nativo']
  }
  for (const clave of clavesLatinas(personaje.nombre)) {
    const nodo = porLatino.get(clave)
    if (nodo) return [nodo, 'nombre']
  }
  return [null]
}

async function emparejarSerie(anime, serie, pendientes) {
  if (serie.anilistId === null || serie.agotada) return
  const vistos = []
  let pagina = serie.paginas
  while (pendientes.length && pagina < MAX_PAGINAS) {
    pagina++
    const datos = await consultar(CONSULTA_PERSONAJES_SERIE, { id: serie.anilistId, pagina })
    const conexion = datos.Media?.characters
    if (!conexion) break
    vistos.push(...conexion.nodes)
    const indice = indexar(vistos)
    for (let i = pendientes.length - 1; i >= 0; i--) {
      const [nodo, origen] = casar(pendientes[i], indice)
      if (!nodo) continue
      cache.personajes[pendientes[i].id] = datosPersonaje(nodo, `serie:${origen}`)
      pendientes.splice(i, 1)
    }
    serie.paginas = pagina
    if (!conexion.pageInfo.hasNextPage) break
    guardarCache()
  }
  serie.agotada = true
  guardarCache()
}

// ---- Fase 3: búsqueda individual -------------------------------------------

// Secuelas y películas incluidas: su título empieza por el de la serie
// («NARUTO: Shippuuden», «Shingeki no Kyojin Season 2»).
function enFranquicia(serie, nodo) {
  if (serie.anilistId === null) return false
  const prefijo = serie.romaji?.toLowerCase()
  return nodo.media.nodes.some((m) => m.id === serie.anilistId || (prefijo && m.title.romaji?.toLowerCase().startsWith(prefijo)))
}

async function buscarPersonaje(personaje, serie) {
  if (personaje.id in PERSONAJES_FIJADOS) {
    const nodo = (await consultar(CONSULTA_PERSONAJE_ID, { id: PERSONAJES_FIJADOS[personaje.id] })).Character
    return nodo ? datosPersonaje(nodo, 'fijado') : null
  }
  // Nombre completo, nombre japonés y, si no, solo el nombre de pila.
  const [pila] = personaje.nombre.split(/[\s,]+/)
  const consultas = [personaje.nombre, personaje.nativo, pila.length >= 3 && pila !== personaje.nombre ? pila : null]
  for (const busqueda of consultas.filter(Boolean)) {
    const candidatos = (await consultar(CONSULTA_PERSONAJE, { busqueda })).Page.characters
    if (!candidatos.length) continue
    // Dentro de la franquicia basta con que case el nombre; si solo hay un
    // candidato de ella, es él aunque el nombre cambie (apodos, alias).
    const propios = candidatos.filter((c) => enFranquicia(serie, c))
    const [nodo, origen] = casar(personaje, indexar(propios))
    if (nodo) return datosPersonaje(nodo, `busqueda:${origen}`)
    if (propios.length === 1) return datosPersonaje(propios[0], 'busqueda:serie')
    // Fuera de ella solo nos fiamos del nombre japonés (rara vez se repite).
    const [suelto, origenSuelto] = casar(personaje, indexar(candidatos))
    if (suelto && (origenSuelto === 'nativo' || serie.anilistId === null)) return datosPersonaje(suelto, `busqueda:${origenSuelto}`)
  }
  return null
}

// El mapeo antiguo se hizo buscando por nombre sin comprobar nada, así que
// solo vale si el nombre que encontró comparte alguna palabra con el nuestro.
function desdeAntiguo(personaje) {
  const dato = antiguo[personaje.id]
  if (!dato?.animeMatch || (!dato.genero && !dato.favourites)) return null
  const nuestras = new Set((clavesLatinas(personaje.nombre)[1] ?? '').split('|'))
  if (!(clavesLatinas(dato.anilistName)[1] ?? '').split('|').some((p) => p.length > 1 && nuestras.has(p))) return null
  return {
    anilistNombre: dato.anilistName,
    genero: dato.genero === 'F' || dato.genero === 'M' ? dato.genero : null,
    favs: dato.favourites ?? 0,
    origen: 'antiguo',
  }
}

// ---- Escritura --------------------------------------------------------------

const escribir = (nombre, lista) =>
  writeFileSync(join(raiz, 'src/data', nombre), `[\n${lista.map((c) => `  ${JSON.stringify(c)}`).join(',\n')}\n]\n`)

function aplicar() {
  const sinDatos = []
  const nuevosPersonajes = personajes.map((p) => {
    const { genero: _g, favs: _f, cumple: _c, ...resto } = p
    const dato = cache.personajes[p.id]
    if (!dato) {
      sinDatos.push(p.id)
      return { ...resto, genero: null }
    }
    const salida = { ...resto, genero: dato.genero ?? null }
    if (Number.isInteger(dato.favs)) salida.favs = dato.favs
    if (dato.cumple) salida.cumple = dato.cumple
    return salida
  })
  const nuevosAnimes = animes.map((a) => {
    const { anio: _a, generos: _ge, episodios: _e, favs: _f, ...resto } = a
    const serie = cache.series[a.id]
    if (!serie || serie.anilistId === null) return resto
    const salida = { ...resto }
    if (Number.isInteger(serie.anio)) salida.anio = serie.anio
    if (serie.generos?.length) salida.generos = serie.generos
    if (Number.isInteger(serie.episodios)) salida.episodios = serie.episodios
    if (Number.isInteger(serie.favs)) salida.favs = serie.favs
    return salida
  })
  escribir('personajes.json', nuevosPersonajes)
  escribir('animes.json', nuevosAnimes)
  return sinDatos
}

function informe() {
  const cuenta = (lista, f) => lista.filter(f).length
  const datos = personajes.map((p) => cache.personajes[p.id])
  const origenes = {}
  for (const d of datos) if (d) origenes[d.origen] = (origenes[d.origen] ?? 0) + 1
  console.log(
    `anilist: personajes ${cuenta(datos, Boolean)}/${personajes.length} emparejados ` +
      `(genero ${cuenta(datos, (d) => d?.genero)}, favs ${cuenta(datos, (d) => Number.isInteger(d?.favs))}, ` +
      `cumple ${cuenta(datos, (d) => d?.cumple)}); origen ${JSON.stringify(origenes)}`,
  )
  const series = animes.map((a) => cache.series[a.id])
  console.log(
    `anilist: series ${cuenta(series, (s) => s?.anilistId)}/${animes.length} emparejadas ` +
      `(anio ${cuenta(series, (s) => s?.anio)}, generos ${cuenta(series, (s) => s?.generos)}, ` +
      `episodios ${cuenta(series, (s) => Number.isInteger(s?.episodios))}, favs ${cuenta(series, (s) => Number.isInteger(s?.favs))})`,
  )
  for (const a of animes) {
    const s = cache.series[a.id]
    if (!s) continue
    const marca = s.fijada ? 'fijada' : s.porNativo ? 'nativo' : 'TÍTULO (revisar)'
    console.log(`  ${a.id.padEnd(34)} → ${String(s.anilistId).padEnd(7)} ${s.titulo ?? '(sin serie)'} [${s.formato ?? '-'} ${s.anio ?? '?'}] ${marca}`)
  }
  const sinDatos = personajes.filter((p) => !cache.personajes[p.id]).map((p) => `${p.id} (${p.anime})`)
  if (sinDatos.length) console.log(`anilist: ${sinDatos.length} sin emparejar:\n  ${sinDatos.join('\n  ')}`)
}

// ---- Programa ---------------------------------------------------------------

if (argumentos.has('informe')) {
  informe()
  process.exit(0)
}

for (const anime of animes) {
  const serie = await resolverSerie(anime)
  if (argumentos.has('series')) continue
  // Un null en la caché es un personaje ya buscado sin éxito: no se repite.
  const pendientes = personajes.filter((p) => p.animeId === anime.id && !(p.id in cache.personajes))
  await emparejarSerie(anime, serie, pendientes)
  for (const personaje of pendientes) {
    if (personaje.id in cache.personajes) continue
    cache.personajes[personaje.id] = (await buscarPersonaje(personaje, serie)) ?? desdeAntiguo(personaje)
    guardarCache()
  }
  const casados = personajes.filter((p) => p.animeId === anime.id && cache.personajes[p.id]).length
  console.log(`${anime.titulo}: ${casados}/${anime.count} personajes (${peticiones} peticiones)`)
}

if (argumentos.has('series')) {
  informe()
} else {
  const sinDatos = aplicar()
  informe()
  console.log(`anilist: catálogo actualizado con ${peticiones} peticiones; ${sinDatos.length} personajes sin datos`)
}
