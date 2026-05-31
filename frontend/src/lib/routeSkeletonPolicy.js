export function getRouteSkeletonReserve(pathname) {
  if (pathname === '/') return 'min-h-[5818px]'
  if (pathname === '/votar') return 'min-h-[1256px]'
  if (pathname === '/ranking') return 'min-h-[12233px]'
  if (pathname === '/fantasy') return 'min-h-[2100px]'
  if (pathname.startsWith('/personajes/')) return 'min-h-[4244px]'
  if (pathname.startsWith('/animes/') && pathname.endsWith('/ranking')) return 'min-h-[3200px]'
  if (pathname.startsWith('/animes/')) return 'min-h-[2200px]'
  if (pathname.startsWith('/torneos/')) return 'min-h-[3404px]'
  if (pathname === '/games') return 'min-h-[2167px]'
  return ''
}
