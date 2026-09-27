/**
 * Dimensions of the procedural book, in scene units (1 unit ~ 1 metre).
 *
 * The book is built from primitives rather than loaded from a GLB because its
 * covers and pages have to ARTICULATE (hinge open, flip, tumble). Authoring
 * that as an R3F node hierarchy is far more controllable than driving skeletal
 * animation in an imported asset - and it means the experience has no binary
 * dependency to go missing.
 *
 * Hinge convention (important):
 *   Every cover / page is a group pivoted on the spine at local x = 0, whose
 *   child mesh is offset to +X by half its width. Rotating that group about Z
 *   therefore swings the leaf:
 *     rotation.z = 0   -> lies flat to the RIGHT
 *     rotation.z = PI/2 -> stands straight UP
 *     rotation.z = PI  -> lies flat to the LEFT (turned over)
 */
export const BOOK = {
  /** Half-width of the open book - i.e. the width of a single page. */
  pageWidth: 0.34,
  /** Front-to-back depth of a page. */
  pageDepth: 0.46,
  /** How far the cover proudly overhangs the page block on each free edge. */
  coverOverhang: 0.013,
  coverThickness: 0.015,
  /** Thickness of the whole stack of leaves. */
  blockThickness: 0.058,
  /** Thickness of one animated leaf. */
  leafThickness: 0.0016,
} as const

export const COVER_WIDTH = BOOK.pageWidth + BOOK.coverOverhang
export const COVER_DEPTH = BOOK.pageDepth + BOOK.coverOverhang * 2

/** Total thickness of the closed book, used to sit it on the desk. */
export const CLOSED_THICKNESS = BOOK.blockThickness + BOOK.coverThickness * 2

/** Height of the desk surface. The book rests here. */
export const DESK_TOP_Y = 0
/** Height of the floor the book falls to. */
export const FLOOR_Y = -0.9
/** Where the book comes to rest on the floor, and where the model is revealed. */
export const LANDING = { x: 0.05, z: 1.06 } as const

/** Number of individually animated leaves during the page-flip beat. */
export const FLIP_LEAF_COUNT = 6
