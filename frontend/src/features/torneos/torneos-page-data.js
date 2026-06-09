function toArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : []
}

function numberFrom(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function timeFrom(value, fallback = 0) {
  if (!value) return fallback
  const time = new Date(value).getTime()
  return Number.isFinite(time) ? time : fallback
}

function compareLive(a, b) {
  return (
    numberFrom(b.votosUltimos7Dias) - numberFrom(a.votosUltimos7Dias) ||
    numberFrom(a.rondaActual) - numberFrom(b.rondaActual) ||
    timeFrom(b.fechaInicio || b.fechaCreacion) - timeFrom(a.fechaInicio || a.fechaCreacion)
  )
}

function compareScheduled(a, b) {
  return (
    timeFrom(a.fechaInicio, Number.POSITIVE_INFINITY) -
      timeFrom(b.fechaInicio, Number.POSITIVE_INFINITY) ||
    timeFrom(b.fechaCreacion) - timeFrom(a.fechaCreacion)
  )
}

function compareFinished(a, b) {
  return timeFrom(b.fechaFinalizacion || b.fechaCreacion) - timeFrom(a.fechaFinalizacion || a.fechaCreacion)
}

function pickDestacado(enCurso, proximos, historial) {
  if (enCurso.length > 0) return { torneo: enCurso[0], tipo: 'IN_PROGRESS' }
  if (proximos.length > 0) return { torneo: proximos[0], tipo: 'SCHEDULED' }
  if (historial.length > 0) return { torneo: historial[0], tipo: 'FINISHED' }
  return null
}

export function buildTorneosPageModel(torneos) {
  const items = toArray(torneos)
  const enCurso = items
    .filter((torneo) => torneo.estado === 'IN_PROGRESS')
    .sort(compareLive)
  const proximos = items
    .filter((torneo) => torneo.estado === 'SCHEDULED')
    .sort(compareScheduled)
  const historial = items
    .filter((torneo) => torneo.estado === 'FINISHED')
    .sort(compareFinished)

  return {
    total: items.length,
    enCurso,
    proximos,
    historial,
    votosUltimos7Dias: items.reduce(
      (total, torneo) => total + numberFrom(torneo.votosUltimos7Dias),
      0,
    ),
    participantes: items.reduce(
      (total, torneo) => total + numberFrom(torneo.numParticipantes),
      0,
    ),
    destacado: pickDestacado(enCurso, proximos, historial),
  }
}
