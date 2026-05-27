export function buildDuelVoteUrl(a, b) {
  const slugA = a?.slug
  const slugB = b?.slug
  if (!slugA || !slugB) return '/votar'
  return `/votar?personaje=${encodeURIComponent(slugA)}&rival=${encodeURIComponent(slugB)}`
}
