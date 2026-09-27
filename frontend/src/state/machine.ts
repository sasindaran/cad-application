import type { ExperienceState } from '../types'

/**
 * The cinematic sequence as an explicit state machine.
 *
 * `task.txt` asks for a real machine rather than scattered booleans, so the
 * legal edges live here as data and every transition goes through
 * `canTransition`. Illegal transitions are refused (and warned about in dev)
 * instead of silently corrupting the sequence.
 */

/** Ordered list of the states the happy path walks through. */
export const SEQUENCE: readonly ExperienceState[] = [
  'idle',
  'uploading',
  'uploaded',
  'bookOpening',
  'drawingReveal',
  'pageFlip',
  'bookFall',
  'bookOnGround',
  'handPickup',
  'modelReveal',
  'viewer',
] as const

/**
 * Allowed transitions. Every state may go to `error` (loader/WebGL failures)
 * and every state may go back to `idle` (the Reset / "start over" action).
 */
export const TRANSITIONS: Record<ExperienceState, readonly ExperienceState[]> = {
  idle: ['uploading', 'error'],
  uploading: ['uploaded', 'idle', 'error'],
  uploaded: ['bookOpening', 'idle', 'error'],
  bookOpening: ['drawingReveal', 'idle', 'error'],
  drawingReveal: ['pageFlip', 'idle', 'error'],
  pageFlip: ['bookFall', 'idle', 'error'],
  bookFall: ['bookOnGround', 'idle', 'error'],
  bookOnGround: ['handPickup', 'idle', 'error'],
  handPickup: ['modelReveal', 'idle', 'error'],
  modelReveal: ['viewer', 'idle', 'error'],
  viewer: ['idle', 'error'],
  error: ['idle'],
}

export function canTransition(from: ExperienceState, to: ExperienceState): boolean {
  return TRANSITIONS[from].includes(to)
}

/** The state that naturally follows `state` on the happy path, if any. */
export function nextState(state: ExperienceState): ExperienceState | null {
  const index = SEQUENCE.indexOf(state)
  if (index === -1 || index === SEQUENCE.length - 1) return null
  return SEQUENCE[index + 1]
}

/**
 * How long (ms) each state holds before the sequence director auto-advances.
 *
 * `null` means "this state does not auto-advance" — it waits for an external
 * trigger: `idle` waits for a file, `uploading` waits for the preview to be
 * decoded, `viewer`/`error` are terminal.
 *
 * These are the single source of truth for cinematic pacing. Camera moves and
 * GSAP tweens read the same numbers via `STATE_DURATIONS`, so changing a beat
 * here re-times the animation with it.
 */
export const STATE_DURATIONS: Record<ExperienceState, number | null> = {
  idle: null,
  uploading: null,
  uploaded: 900,
  bookOpening: 2600,
  drawingReveal: 2600,
  pageFlip: 2800,
  bookFall: 2200,
  bookOnGround: 1400,
  handPickup: 3000,
  modelReveal: 3400,
  viewer: null,
  error: null,
}

/**
 * Reduced-motion pacing. The logical sequence still runs end to end (as
 * `task.txt` requires) but each beat is collapsed to a short hold so the user
 * is not subjected to sweeping camera motion.
 */
export const REDUCED_MOTION_DURATION = 220

export function durationFor(state: ExperienceState, reducedMotion: boolean): number | null {
  const base = STATE_DURATIONS[state]
  if (base === null) return null
  return reducedMotion ? REDUCED_MOTION_DURATION : base
}

/** True once the cinematic is over and the professional viewer owns the screen. */
export function isViewerState(state: ExperienceState): boolean {
  return state === 'viewer'
}

/** True while the book is the subject of the shot. */
export function isCinematicState(state: ExperienceState): boolean {
  return state !== 'viewer' && state !== 'error'
}

/** Progress through the sequence, 0..1 — used by the cinematic progress bar. */
export function sequenceProgress(state: ExperienceState): number {
  const index = SEQUENCE.indexOf(state)
  if (index <= 0) return 0
  return index / (SEQUENCE.length - 1)
}
