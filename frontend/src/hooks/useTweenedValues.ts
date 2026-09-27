import { useCallback, useEffect, useRef } from 'react'
import gsap from 'gsap'

/**
 * A mutable bag of numbers that GSAP tweens and the R3F render loop reads.
 *
 * This is the pattern the whole cinematic uses instead of putting animation
 * values in React state:
 *
 *   - GSAP mutates the plain object on its own ticker
 *   - `useFrame` copies the current numbers onto Object3Ds
 *   - React never re-renders during an animation
 *
 * It also makes interruption correct for free: starting a new tween on the
 * same property kills the previous one, so a debug jump mid-sequence does not
 * leave two tweens fighting over one value.
 */
export function useTweenedValues<T extends Record<string, number>>(initial: T) {
  const values = useRef<T>({ ...initial })

  /** Tween toward `to`. `duration: 0` snaps (used for jumps / reduced motion). */
  const tween = useCallback(
    (to: Partial<T>, options: { duration?: number; ease?: string; delay?: number } = {}) => {
      const { duration = 1, ease = 'power2.inOut', delay = 0 } = options
      if (duration <= 0) {
        Object.assign(values.current, to)
        gsap.killTweensOf(values.current)
        return
      }
      gsap.to(values.current, { ...to, duration, ease, delay, overwrite: 'auto' })
    },
    [],
  )

  /** Snap without tweening. */
  const set = useCallback((to: Partial<T>) => {
    gsap.killTweensOf(values.current)
    Object.assign(values.current, to)
  }, [])

  // Never leave tweens running against an unmounted component's object.
  useEffect(() => {
    const object = values.current
    return () => {
      gsap.killTweensOf(object)
    }
  }, [])

  return { values, tween, set }
}
