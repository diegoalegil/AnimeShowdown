export const PERFIL_TABS = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'roster', label: 'Mi roster' },
  { id: 'logros', label: 'Logros' },
  { id: 'torneos', label: 'Mis torneos' },
  { id: 'ajustes', label: 'Ajustes' },
]

export function tabValida(id) {
  return PERFIL_TABS.some((t) => t.id === id) ? id : 'resumen'
}
