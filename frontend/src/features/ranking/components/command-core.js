// command-core.js — módulo hermano de ArenaCommandRoom (lógica pura, sin React).
//
// Toda la matemática de la Sala de Mando vive aquí para poder testearla sin
// montar componentes y para no romper react-refresh (este módulo NO exporta
// componentes). Funciones puras: ninguna lee Date.now()/Math.random() por su
// cuenta — el `now` se inyecta siempre desde el llamante (effect/handler), de
// modo que el render puede invocarlas sin violar las reglas del React Compiler.

/**
 * @typedef {Object} VotoGanador
 * @property {string} slug   Slug canónico del personaje ganador.
 * @property {string} nombre Nombre visible del ganador.
 * @property {string} anime  Nombre del anime (clave de territorio).
 */
/**
 * @typedef {Object} Voto  Forma EXACTA de /api/votos/recientes (VotoFeedItem).
 * @property {VotoGanador|null} ganador  null en items legacy/borde (se filtran).
 * @property {{ nombre: string }|null} rival  null en votos sueltos sin enfrentamiento.
 * @property {string|null} username  null = voto anónimo.
 * @property {string} fecha  ISO-8601.
 * @property {boolean} [empate]  true = empate (el backend lo entrega con
 *   ganador=personaje1); NO es victoria, no estampa gota ni cuenta en el tally.
 */
/**
 * @typedef {Object} AnimeCatalogo
 * @property {string} anime
 * @property {string} slug
 * @property {number} [total]  Nº de personajes (presencia en catálogo).
 * @property {Array<unknown>} [personajes]
 * @property {{ slug:string, nombre:string, elo:number }} [topElo]
 */

const HORA_MS = 3600000;
const DIEZ_MIN_MS = 600000;

/** Clave estable de un voto para diffs entre polls (sin depender del índice). */
export function claveVoto(v) {
  return `${v.fecha}|${v.ganador.slug}|${v.username ?? '∅'}`;
}

/**
 * Color de la gota: oro si el ganador está en el top-10 (topSlugs), carmesí en
 * cualquier otra victoria local. No inventa nada: si topSlugs viene vacío,
 * todas las gotas son carmesí.
 * @param {Voto} voto
 * @param {Set<string>|string[]} topSlugs
 * @returns {'oro'|'carmesi'}
 */
export function colorGota(voto, topSlugs) {
  const set = topSlugs instanceof Set ? topSlugs : new Set(topSlugs ?? []);
  return set.has(voto.ganador.slug) ? 'oro' : 'carmesi';
}

/**
 * Asignación voto→territorio. Los `maxTerritorios` universos con más presencia
 * en el catálogo son territorios propios; el resto se agrupa en "el confín".
 * @param {Voto[]} votos
 * @param {AnimeCatalogo[]} catalogo
 * @param {{ maxTerritorios?: number, topSlugs?: string[] }} [opts]
 * @returns {{ territorios: Array<{anime,slug,total,casa,topElo}>, confin: {total:number, animes:string[]} }}
 */
export function construirTerritorios(votos, catalogo, opts = {}) {
  const { maxTerritorios = 8, topSlugs = [] } = opts;
  const presencia = (a) => a.total ?? a.personajes?.length ?? 0;
  const ranked = [...(catalogo ?? [])].sort((a, b) => presencia(b) - presencia(a));
  const main = ranked.slice(0, maxTerritorios);
  const mainAnimes = new Set(main.map((a) => a.anime));
  const topSet = new Set(topSlugs);

  // Solo votos DECIDIDOS cuentan como marea: un empate no es victoria de nadie
  // (el backend lo entrega con ganador=personaje1 + empate=true), y un item sin
  // ganador es ruido legacy. Filtramos ambos antes de tallyar.
  const decididos = (votos ?? []).filter((v) => v && v.ganador && !v.empate);

  const tally = new Map();
  for (const v of decididos) {
    tally.set(v.ganador.anime, (tally.get(v.ganador.anime) ?? 0) + 1);
  }

  const territorios = main.map((a) => {
    const total = tally.get(a.anime) ?? 0;
    const huboOro = decididos.some(
      (v) => v.ganador.anime === a.anime && topSet.has(v.ganador.slug),
    );
    return {
      anime: a.anime,
      slug: a.slug,
      total,
      casa: huboOro ? 'oro' : 'carmesi', // tinte dominante del territorio
      topElo: a.topElo ?? null,
    };
  });

  const confinVotos = decididos.filter((v) => !mainAnimes.has(v.ganador.anime));
  return {
    territorios,
    confin: {
      total: confinVotos.length,
      animes: [...new Set(confinVotos.map((v) => v.ganador.anime))],
    },
  };
}

/** Etiqueta mono de un bucket: "14h" por hora, "14:30" en sub-hora. */
export function etiquetaBucket(startMs, sub) {
  const d = new Date(startMs);
  const hh = String(d.getHours()).padStart(2, '0');
  if (!sub) return `${hh}h`;
  return `${hh}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * Regleta de mareas: histograma SOLO con las fechas presentes en el feed
 * (ventana honesta). Si el feed cubre ≤1h, agrupa en tramos de 10 min y lo
 * declara; si cubre más, agrupa por hora (máx 12 barras = últimas 12h).
 * @param {Voto[]} votos
 * @param {{ now: number }} ctx  `now` inyectado (nunca Date.now() aquí dentro).
 * @returns {{ buckets: Array<{start,count,ratio,actual,label}>, windowLabel:string, empty:boolean, sub:boolean, max:number }}
 */
export function construirMareaHoraria(votos, ctx) {
  const now = ctx?.now ?? 0;
  const times = (votos ?? [])
    .map((v) => new Date(v.fecha).getTime())
    .filter((t) => !Number.isNaN(t));
  if (!times.length) {
    return { buckets: [], windowLabel: 'sin actividad', empty: true, sub: false, max: 0 };
  }
  const earliest = Math.min(...times);
  const latest = Math.max(...times);
  const span = now - earliest;
  const sub = span <= HORA_MS;
  const bucketMs = sub ? DIEZ_MIN_MS : HORA_MS;

  const startB = Math.floor(earliest / bucketMs);
  // `now` puede llegar a 0 en el primer render tras un remount con caché (el
  // reloj se siembra en un effect post-commit). Incluir SIEMPRE el último voto
  // real evita un rango vacío y muestra la actividad ya presente.
  const endB = Math.floor(Math.max(now, latest) / bucketMs);
  let buckets = [];
  for (let b = startB; b <= endB; b++) buckets.push({ start: b * bucketMs, count: 0 });
  if (buckets.length > 12) buckets = buckets.slice(-12);
  // Defensa en profundidad: nunca leemos buckets[0] sobre un array vacío.
  if (!buckets.length) {
    return { buckets: [], windowLabel: 'sin actividad', empty: true, sub, max: 0 };
  }

  const minStart = buckets[0].start;
  for (const t of times) {
    const s = Math.floor(t / bucketMs) * bucketMs;
    if (s < minStart) continue;
    const k = buckets.findIndex((x) => x.start === s);
    if (k >= 0) buckets[k].count++;
  }

  const curStart = endB * bucketMs;
  const max = Math.max(1, ...buckets.map((b) => b.count));
  const view = buckets.map((b) => ({
    start: b.start,
    count: b.count,
    ratio: b.count / max,
    actual: b.start === curStart,
    label: etiquetaBucket(b.start, sub),
  }));

  const mins = Math.max(10, Math.round(span / 60000));
  const windowLabel = sub ? `últimos ${mins} min` : `últimas ${buckets.length} h`;
  return { buckets: view, windowLabel, empty: false, sub, max };
}

/**
 * Coalescencia de ráfagas para el Libro de guardia. Agrupa votos consecutivos
 * (newest-first) cuyas fechas caen dentro de `burstWindowMs`; un grupo de
 * `minBurst`+ se colapsa en un asiento agregado "+N votos en la arena".
 * @param {Voto[]} votos
 * @param {{ burstWindowMs?: number, minBurst?: number, limit?: number }} [opts]
 * @returns {Array<{tipo:'voto', voto:Voto, fecha:string} | {tipo:'agregado', n:number, fecha:string, animes:string[]}>}
 */
export function coalescerGuardia(votos, opts = {}) {
  const { burstWindowMs = 2000, minBurst = 4, limit = 8 } = opts;
  const sorted = [...(votos ?? [])].sort(
    (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime(),
  );
  const grupos = [];
  let cur = [];
  for (const v of sorted) {
    if (!cur.length) {
      cur = [v];
      continue;
    }
    const dt = Math.abs(
      new Date(cur[cur.length - 1].fecha).getTime() - new Date(v.fecha).getTime(),
    );
    if (dt <= burstWindowMs) cur.push(v);
    else {
      grupos.push(cur);
      cur = [v];
    }
  }
  if (cur.length) grupos.push(cur);

  const entries = [];
  for (const g of grupos) {
    if (g.length >= minBurst) {
      entries.push({
        tipo: 'agregado',
        n: g.length,
        fecha: g[0].fecha,
        animes: [...new Set(g.map((v) => v.ganador.anime))],
      });
    } else {
      for (const v of g) entries.push({ tipo: 'voto', voto: v, fecha: v.fecha });
    }
  }
  return entries.slice(0, limit);
}

/**
 * Fecha relativa sobria. `now` inyectado.
 * @param {string} iso
 * @param {number} now
 */
export function fechaRelativa(iso, now) {
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return '';
  const min = Math.round((now - ts) / 60000);
  if (min < 1) return 'hace un instante';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? 'ayer' : `hace ${d} días`;
}

/**
 * Diff de dos feeds por clave: devuelve los votos nuevos (presentes en `next`
 * y ausentes en `prev`), en orden de llegada (más antiguo→más nuevo) para que
 * el llamante los anime en secuencia.
 * @param {Voto[]} prev
 * @param {Voto[]} next
 * @returns {Voto[]}
 */
export function votosNuevos(prev, next) {
  const vistos = new Set((prev ?? []).map(claveVoto));
  return (next ?? [])
    .filter((v) => !vistos.has(claveVoto(v)))
    .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
}
