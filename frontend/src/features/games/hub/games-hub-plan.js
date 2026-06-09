function isGameCompletedToday(game, estadosJuegos) {
  return Boolean(estadosJuegos?.[game.to]?.completadoHoy)
}

function byOriginalOrder(a, b) {
  return a.index - b.index
}

export function buildGamesHubPlan(games, estadosJuegos = {}) {
  const indexed = games.map((game, index) => ({
    game,
    index,
    completedToday: isGameCompletedToday(game, estadosJuegos),
  }))

  const pendingDaily = indexed
    .filter((item) => !item.game.endless && !item.completedToday)
    .sort(byOriginalOrder)
  const completedDaily = indexed
    .filter((item) => !item.game.endless && item.completedToday)
    .sort(byOriginalOrder)
  const endless = indexed
    .filter((item) => item.game.endless)
    .sort(byOriginalOrder)

  const featured =
    pendingDaily.find((item) => item.game.destacado)?.game ??
    pendingDaily[0]?.game ??
    endless[0]?.game ??
    completedDaily.find((item) => item.game.destacado)?.game ??
    completedDaily[0]?.game ??
    indexed[0]?.game ??
    null

  const ordered = [...pendingDaily, ...endless, ...completedDaily]
    .map((item) => item.game)
    .filter((game) => game.to !== featured?.to)

  return {
    destacado: featured,
    otros: ordered,
    pendingDailyCount: pendingDaily.length,
    completedDailyCount: completedDaily.length,
  }
}

export function shouldShowDailyHistory(streak, completadosHoy) {
  return (
    Number(completadosHoy) > 0 ||
    Number(streak?.current) > 0 ||
    Number(streak?.longest) > 0
  )
}
