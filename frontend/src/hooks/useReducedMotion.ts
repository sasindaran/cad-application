import { useEffect } from 'react'
import { useExperienceStore } from '../state/experienceStore'

/**
 * Mirrors the OS `prefers-reduced-motion` setting into the store.
 *
 * The experience honours it by collapsing every cinematic beat to a short hold
 * (see `durationFor` in state/machine.ts) and by snapping camera moves instead
 * of tweening them. The logical sequence still completes end to end.
 */
export function useReducedMotionSync() {
  const setReducedMotion = useExperienceStore((s) => s.setReducedMotion)

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(query.matches)

    const onChange = (event: MediaQueryListEvent) => setReducedMotion(event.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [setReducedMotion])
}
