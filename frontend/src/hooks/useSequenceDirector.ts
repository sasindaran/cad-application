import { useEffect } from 'react'
import { useExperienceStore } from '../state/experienceStore'
import { durationFor } from '../state/machine'

/**
 * Drives the cinematic forward.
 *
 * Each state declares its own hold time in `STATE_DURATIONS`. When a state has
 * a duration, the director schedules the next transition; when it is `null`
 * the state is waiting on something external (a file, or the user) and the
 * director stays out of the way.
 *
 * Deliberately the ONLY thing that auto-advances the machine, so the sequence
 * has exactly one clock rather than timers scattered across components.
 */
export function useSequenceDirector() {
  const state = useExperienceStore((s) => s.state)
  const reducedMotion = useExperienceStore((s) => s.reducedMotion)
  const advance = useExperienceStore((s) => s.advance)

  useEffect(() => {
    const hold = durationFor(state, reducedMotion)
    if (hold === null) return

    const id = window.setTimeout(advance, hold)
    return () => window.clearTimeout(id)
  }, [state, reducedMotion, advance])
}
