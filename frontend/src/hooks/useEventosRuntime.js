import { useQuery } from '@tanstack/react-query'
import { EVENTOS } from '../data/eventos'
import { endpoints } from '../lib/api'

const EVENTOS_STALE_MS = 60_000

export function useEventosRuntime() {
  const query = useQuery({
    queryKey: ['eventos-tematicos'],
    queryFn: endpoints.eventos,
    initialData: EVENTOS,
    initialDataUpdatedAt: 0,
    staleTime: EVENTOS_STALE_MS,
    retry: 1,
  })

  return {
    ...query,
    eventos: normalizarEventos(query.data),
  }
}

function normalizarEventos(data) {
  if (!Array.isArray(data)) return EVENTOS
  const normalizados = data
    .map(normalizarEvento)
    .filter(Boolean)
  return normalizados.length > 0 ? normalizados : EVENTOS
}

function normalizarEvento(evento) {
  if (!evento || typeof evento !== 'object') return null
  const tipo = normalizarTipo(evento.tipo)
  if (!evento.slug || !evento.titulo || !tipo) return null
  return {
    slug: String(evento.slug),
    titulo: String(evento.titulo),
    descripcionCorta: String(evento.descripcionCorta ?? ''),
    tipo,
    inicioISO: String(evento.inicioISO),
    finISO: String(evento.finISO),
    color: String(evento.color ?? 'amber'),
    emoji: String(evento.emoji ?? '✨'),
    cup: evento.cup ?? null,
  }
}

function normalizarTipo(tipo) {
  if (!tipo || typeof tipo !== 'object') return null
  const kind = String(tipo.kind ?? '')
  if (!['anime', 'animes', 'slugs', 'categoria'].includes(kind)) return null
  const valor = Array.isArray(tipo.valor)
    ? tipo.valor.map(String).filter(Boolean)
    : String(tipo.valor ?? '')
  if (Array.isArray(valor) ? valor.length === 0 : !valor) return null
  return { kind, valor }
}
