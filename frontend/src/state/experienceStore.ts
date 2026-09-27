import { create } from 'zustand'
import type {
  CompareMode,
  DrawingAsset,
  ExperienceState,
  ModelResult,
  ProjectionMode,
  UploadError,
  ViewerTool,
} from '../types'
import { canTransition, nextState } from './machine'

interface ExperienceStore {
  /* ---------------------------------------------------------------- state */
  state: ExperienceState
  /** Set when the user (or a dev shortcut) jumped states, so animations snap. */
  jumped: boolean

  /* -------------------------------------------------------------- drawing */
  drawing: DrawingAsset | null
  uploadError: UploadError | null

  /* ---------------------------------------------------------------- model */
  model: ModelResult
  modelLoadError: string | null

  /* --------------------------------------------------------------- viewer */
  compareMode: CompareMode
  tool: ViewerTool
  projection: ProjectionMode
  wireframe: boolean
  grid: boolean

  /* -------------------------------------------------------------- prefs */
  reducedMotion: boolean

  /* ------------------------------------------------------------- actions */
  /** Move to `to` if the machine allows it. Returns whether it happened. */
  transition: (to: ExperienceState) => boolean
  /** Advance one step along the happy path. */
  advance: () => void
  /** Developer/debug jump — bypasses edge validation but keeps state coherent. */
  jumpTo: (to: ExperienceState) => void

  setDrawing: (drawing: DrawingAsset) => void
  setUploadError: (error: UploadError | null) => void
  setModel: (model: ModelResult) => void
  setModelLoadError: (message: string | null) => void

  setCompareMode: (mode: CompareMode) => void
  setTool: (tool: ViewerTool) => void
  setProjection: (projection: ProjectionMode) => void
  toggleWireframe: () => void
  toggleGrid: () => void

  setReducedMotion: (value: boolean) => void

  /** Full reset back to the opening scene, releasing object URLs. */
  reset: () => void
}

const INITIAL_MODEL: ModelResult = { status: 'idle' }

/** Release any object URL we minted so long sessions do not leak blobs. */
function releaseDrawing(drawing: DrawingAsset | null) {
  if (drawing && drawing.previewUrl.startsWith('blob:')) {
    URL.revokeObjectURL(drawing.previewUrl)
  }
}

export const useExperienceStore = create<ExperienceStore>((set, get) => ({
  state: 'idle',
  jumped: false,

  drawing: null,
  uploadError: null,

  model: INITIAL_MODEL,
  modelLoadError: null,

  compareMode: '3d',
  tool: 'rotate',
  projection: 'perspective',
  wireframe: false,
  grid: true,

  reducedMotion: false,

  transition: (to) => {
    const { state } = get()
    if (state === to) return false
    if (!canTransition(state, to)) {
      if (import.meta.env.DEV) {
        console.warn(`[experience] refused illegal transition ${state} -> ${to}`)
      }
      return false
    }
    set({ state: to, jumped: false })
    return true
  },

  advance: () => {
    const next = nextState(get().state)
    if (next) get().transition(next)
  },

  jumpTo: (to) => {
    set({ state: to, jumped: true })
  },

  setDrawing: (drawing) => {
    releaseDrawing(get().drawing)
    set({ drawing, uploadError: null })
  },

  setUploadError: (uploadError) => set({ uploadError }),

  setModel: (model) => set({ model, modelLoadError: null }),

  setModelLoadError: (modelLoadError) => set({ modelLoadError }),

  setCompareMode: (compareMode) => set({ compareMode }),
  setTool: (tool) => set({ tool }),
  setProjection: (projection) => set({ projection }),
  toggleWireframe: () => set((s) => ({ wireframe: !s.wireframe })),
  toggleGrid: () => set((s) => ({ grid: !s.grid })),

  setReducedMotion: (reducedMotion) => set({ reducedMotion }),

  reset: () => {
    releaseDrawing(get().drawing)
    set({
      state: 'idle',
      jumped: false,
      drawing: null,
      uploadError: null,
      model: INITIAL_MODEL,
      modelLoadError: null,
      compareMode: '3d',
      tool: 'rotate',
      wireframe: false,
    })
  },
}))

/* ---------------------------------------------------------------------- */
/* Selectors — kept as stable module-level fns so components subscribing to  */
/* one slice do not re-render on unrelated store writes.                     */
/* ---------------------------------------------------------------------- */

export const selectState = (s: ExperienceStore) => s.state
export const selectDrawing = (s: ExperienceStore) => s.drawing
export const selectModel = (s: ExperienceStore) => s.model
