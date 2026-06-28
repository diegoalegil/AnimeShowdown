// Etiquetas derivadas del estado de la arena de votar: badge superior y
// descripción bajo el h1. Derivación pura de los flags de modo — los
// ternarios reproducen exactamente la precedencia histórica de la página.

export function getArenaStatusLabel({
  modoBackend,
  exactDuelActive,
  identitiesHidden,
  fixedPersonaje,
  fixedRival,
  hasFixedAnime,
  fixedAnime,
  modoSugerido,
  dueloSugerido,
}) {
  return modoBackend
    ? 'Duelo en juego · En vivo'
    : exactDuelActive
      ? identitiesHidden
        ? 'Duelo a ciegas'
        : `${fixedPersonaje.nombre} vs ${fixedRival.nombre}`
      : fixedPersonaje
        ? identitiesHidden
          ? 'Reto a ciegas'
          : `Retando a ${fixedPersonaje.nombre}`
        : hasFixedAnime
          ? identitiesHidden
            ? 'Duelo interno a ciegas'
            : `Duelo interno · ${fixedAnime}`
          : modoSugerido
            ? `Duelo ELO equilibrado${Number.isFinite(dueloSugerido?.eloDiff) ? ` · Δ ${dueloSugerido.eloDiff}` : ''}`
            : 'Enfrentamiento aleatorio'
}

export function getArenaDescription({
  modoBackend,
  votoInvitadoActivo,
  identitiesHidden,
  sinMatchesAbiertos,
  exactDuelActive,
  fixedPersonaje,
  fixedRival,
  hasFixedAnime,
  fixedAnime,
}) {
  return modoBackend
    ? votoInvitadoActivo
      ? 'Puedes votar 5 duelos como invitado; crea cuenta para guardar tu historial'
      : identitiesHidden
        ? 'Voto a ciegas activo: decide sin ver identidades o reparte medio voto'
        : 'Tu voto cuenta para el bracket en directo · puedes decidir o repartir medio voto'
    : sinMatchesAbiertos
      ? 'No hay torneos en juego — te proponemos pares de ELO similar'
      : exactDuelActive
        ? identitiesHidden
          ? 'Duelo fijado con identidades ocultas hasta votar'
          : `Duelo fijado desde una comparación: ${fixedPersonaje.nombre} vs ${fixedRival.nombre}`
        : fixedPersonaje
          ? identitiesHidden
            ? 'Duelo fijado desde ficha con identidad oculta'
            : `Duelo fijado desde la ficha de ${fixedPersonaje.nombre}`
          : hasFixedAnime
            ? identitiesHidden
              ? 'Solo personajes del mismo anime, ocultos hasta votar'
              : `Solo personajes de ${fixedAnime} en este duelo`
            : 'Elige quién gana este duelo y ayuda a mover el ranking competitivo'
}
