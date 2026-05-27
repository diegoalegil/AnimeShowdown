import { useEffect } from 'react'

export function useVoteKeyboardShortcuts({
  a,
  b,
  captchaChallenge,
  handleNext,
  handleVote,
  isAdvancing,
  isFetching,
  isFetchingDueloSugerido,
  isLoading,
  isVotePending,
  showAnonLimitModal,
  votedFor,
}) {
  useEffect(() => {
    if (
      isLoading ||
      !a ||
      !b ||
      isFetching ||
      isFetchingDueloSugerido ||
      isVotePending ||
      isAdvancing ||
      showAnonLimitModal ||
      captchaChallenge
    ) {
      return
    }
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return
      const tag = e.target?.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        handleVote(a)
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        handleVote(b)
      } else if (e.key.toLowerCase() === 's') {
        e.preventDefault()
        handleNext()
      } else if (e.key === ' ' && votedFor) {
        e.preventDefault()
        handleNext()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [
    isLoading,
    isFetching,
    isFetchingDueloSugerido,
    isVotePending,
    isAdvancing,
    showAnonLimitModal,
    captchaChallenge,
    a,
    b,
    handleVote,
    handleNext,
    votedFor,
  ])
}
