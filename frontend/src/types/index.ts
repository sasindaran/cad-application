/**
 * Shared type vocabulary for the cinematic drawing -> 3D experience.
 *
 * These types are the seam between the frontend (implemented now) and the
 * future backend/AI pipeline (Claude Account 2). Nothing in here imports from
 * a component, so the backend layer can depend on this file freely.
 */

/* -------------------------------------------------------------------------- */
/* Experience state machine                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Every state the cinematic experience can be in. The flow is strictly linear
 * (see `TRANSITIONS` in `state/machine.ts`) apart from error/reset edges.
 */
export type ExperienceState =
  | 'idle'
  | 'uploading'
  | 'uploaded'
  | 'bookOpening'
  | 'drawingReveal'
  | 'pageFlip'
  | 'bookFall'
  | 'bookOnGround'
  | 'handPickup'
  | 'modelReveal'
  | 'viewer'
  | 'error'

/* -------------------------------------------------------------------------- */
/* Drawing (the user's uploaded 2D engineering drawing)                        */
/* -------------------------------------------------------------------------- */

export type DrawingSourceKind = 'pdf' | 'image'

/**
 * A drawing that currently lives only in the browser.
 *
 * `previewUrl` is an object URL or a data URL pointing at a raster preview
 * suitable for use as a Three.js texture. For a PDF this is page 1 rasterised
 * by pdf.js; for an image it is the file itself.
 *
 * BACKEND: when a real pipeline exists, `previewUrl` may instead be a remote
 * `originalDrawingUrl`. Consumers must not assume it is an object URL.
 */
export interface DrawingAsset {
  /** The raw browser File. Never transmitted anywhere by this frontend. */
  file: File
  kind: DrawingSourceKind
  fileName: string
  /** Bytes. */
  fileSize: number
  /** Raster preview URL usable as a texture source. */
  previewUrl: string
  /** Pixel dimensions of the preview, used to keep the page aspect correct. */
  previewWidth: number
  previewHeight: number
  /** True when the preview is the generic fallback rather than real content. */
  isFallbackPreview: boolean
}

/* -------------------------------------------------------------------------- */
/* Model result — the future backend response shape                            */
/* -------------------------------------------------------------------------- */

export type ModelJobStatus = 'idle' | 'processing' | 'needs_input' | 'complete' | 'failed'

/**
 * The contract the frontend consumes to learn about a generated 3D model.
 *
 * Today this is produced by `services/modelSource.ts` from local constants.
 * Tomorrow it is produced by the backend adapter. The cinematic scene and the
 * viewer only ever read this shape, never a hard-coded model path.
 */
export interface ModelResult {
  jobId?: string
  status: ModelJobStatus
  /** URL of a .glb/.gltf. Absolute or root-relative. */
  modelUrl?: string
  /** URL of the original 2D drawing raster, for the Original/Split view modes. */
  originalDrawingUrl?: string
  /** Human-readable failure reason when `status === 'failed'`. */
  error?: string
  /**
   * Populated when `status === 'needs_input'` — the missing-dimension workflow.
   * NOT implemented by this frontend; typed so Account 2 has a landing spot.
   */
  questions?: ModelQuestion[]
}

/** A missing-information question the AI pipeline may ask the user. */
export interface ModelQuestion {
  id: string
  prompt: string
  unit?: string
  expects: 'number' | 'text' | 'choice'
  choices?: string[]
}

/**
 * The service interface the frontend depends on. Swap the implementation, keep
 * the cinematic experience untouched.
 */
export interface ModelSource {
  /**
   * Given the user's drawing, resolve a model to display.
   * The mock implementation ignores the drawing and returns the demo model.
   */
  requestModel(drawing: DrawingAsset, signal?: AbortSignal): Promise<ModelResult>
}

/* -------------------------------------------------------------------------- */
/* Viewer                                                                      */
/* -------------------------------------------------------------------------- */

/** The eight canonical camera positions offered by the viewer toolbar. */
export type StandardView =
  | 'front'
  | 'back'
  | 'left'
  | 'right'
  | 'top'
  | 'bottom'
  | 'iso'

export type ProjectionMode = 'perspective' | 'orthographic'

/** Which of the drawing / model panes the viewer is showing. */
export type CompareMode = '3d' | 'original' | 'split'

/** Active pointer tool in the viewer's left rail. */
export type ViewerTool = 'select' | 'rotate' | 'pan' | 'zoom'

/* -------------------------------------------------------------------------- */
/* Upload validation                                                           */
/* -------------------------------------------------------------------------- */

export type UploadErrorCode =
  | 'unsupported-type'
  | 'too-large'
  | 'empty-file'
  | 'preview-failed'

export interface UploadError {
  code: UploadErrorCode
  message: string
}
