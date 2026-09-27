import * as pdfjs from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url'
import type { DrawingAsset, DrawingSourceKind, UploadError } from '../types'

/**
 * Turns a user-selected PDF or image into a raster preview that can be used as
 * a Three.js texture on the book page.
 *
 * Everything here is browser-local. No network request is made and the file is
 * never transmitted - see FRONTEND_INTEGRATION_CONTRACT.md.
 */

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

/* ------------------------------------------------------------------ limits */

/**
 * Prototype upload ceiling. Chosen because the whole file is held in memory,
 * rasterised on a canvas and uploaded to the GPU as a texture; beyond this the
 * tab starts to stutter on modest hardware. Documented in README and in the
 * integration contract.
 */
export const MAX_FILE_BYTES = 25 * 1024 * 1024 // 25 MB

/** Longest edge of the generated preview texture, in pixels. */
const MAX_PREVIEW_EDGE = 1600

export const ACCEPTED_MIME = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp']
export const ACCEPTED_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg', '.webp']

/** The accept attribute for the hidden file input. */
export const FILE_INPUT_ACCEPT = [...ACCEPTED_MIME, ...ACCEPTED_EXTENSIONS].join(',')

/* -------------------------------------------------------------- validation */

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot === -1 ? '' : name.slice(dot).toLowerCase()
}

export function classifyFile(file: File): DrawingSourceKind | null {
  const ext = extensionOf(file.name)
  if (file.type === 'application/pdf' || ext === '.pdf') return 'pdf'
  if (file.type.startsWith('image/') && ACCEPTED_MIME.includes(file.type)) return 'image'
  if (['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) return 'image'
  return null
}

/** Returns an UploadError when the file is unusable, otherwise null. */
export function validateFile(file: File): UploadError | null {
  if (file.size === 0) {
    return { code: 'empty-file', message: 'That file appears to be empty.' }
  }
  if (file.size > MAX_FILE_BYTES) {
    const limitMb = Math.round(MAX_FILE_BYTES / (1024 * 1024))
    return {
      code: 'too-large',
      message: 'That file is too large for this prototype. The limit is ' + limitMb + ' MB.',
    }
  }
  if (classifyFile(file) === null) {
    return {
      code: 'unsupported-type',
      message: 'Please upload a PDF or supported drawing image.',
    }
  }
  return null
}

/* ----------------------------------------------------------------- helpers */

function fitWithin(width: number, height: number, maxEdge: number) {
  const scale = Math.min(1, maxEdge / Math.max(width, height))
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    scale,
  }
}

function canvasToObjectUrl(canvas: HTMLCanvasElement): Promise<string> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Canvas could not be encoded.'))
        return
      }
      resolve(URL.createObjectURL(blob))
    }, 'image/png')
  })
}

/* --------------------------------------------------------------- PDF path */

async function renderPdfFirstPage(file: File) {
  const data = await file.arrayBuffer()
  const doc = await pdfjs.getDocument({ data }).promise
  try {
    const page = await doc.getPage(1)
    const base = page.getViewport({ scale: 1 })
    const { scale } = fitWithin(base.width, base.height, MAX_PREVIEW_EDGE)
    const viewport = page.getViewport({ scale })

    const canvas = document.createElement('canvas')
    canvas.width = Math.round(viewport.width)
    canvas.height = Math.round(viewport.height)
    const context = canvas.getContext('2d')
    if (!context) throw new Error('2D canvas context unavailable.')

    // pdf.js renders onto transparency; engineering drawings need to read as
    // ink on paper, so lay down white before compositing.
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)

    await page.render({ canvas, canvasContext: context, viewport }).promise

    const previewUrl = await canvasToObjectUrl(canvas)
    return { previewUrl, previewWidth: canvas.width, previewHeight: canvas.height }
  } finally {
    // Release the worker-side document regardless of outcome.
    void doc.destroy()
  }
}

/* ------------------------------------------------------------- image path */

function loadImageDimensions(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
    img.onerror = () => reject(new Error('Image could not be decoded.'))
    img.src = url
  })
}

/* ---------------------------------------------------------------- fallback */

/**
 * Drawn when rasterisation fails (encrypted PDF, exotic encoding, ...).
 * task.txt explicitly permits a graceful placeholder texture rather than
 * blocking the cinematic, so the sequence still runs and the page still reads
 * as a drawing that entered the book.
 */
function buildFallbackPreview(fileName: string) {
  const width = 1000
  const height = 1400
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2D canvas context unavailable.')

  ctx.fillStyle = '#f4ead6'
  ctx.fillRect(0, 0, width, height)

  // Drafting grid.
  ctx.strokeStyle = 'rgba(90, 62, 36, 0.13)'
  ctx.lineWidth = 1
  for (let x = 60; x < width; x += 60) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, height)
    ctx.stroke()
  }
  for (let y = 60; y < height; y += 60) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(width, y)
    ctx.stroke()
  }

  // Border + title block, so it reads as a technical sheet.
  ctx.strokeStyle = 'rgba(60, 38, 20, 0.75)'
  ctx.lineWidth = 4
  ctx.strokeRect(40, 40, width - 80, height - 80)
  ctx.strokeRect(width - 400, height - 200, 360, 160)

  ctx.fillStyle = 'rgba(52, 32, 16, 0.85)'
  ctx.font = '600 34px Georgia, serif'
  ctx.fillText('DRAWING PREVIEW UNAVAILABLE', 80, 140)
  ctx.font = '26px Georgia, serif'
  const shortName = fileName.length > 42 ? fileName.slice(0, 39) + '...' : fileName
  ctx.fillText(shortName, 80, 190)
  ctx.font = 'italic 24px Georgia, serif'
  ctx.fillText('The file was accepted and is held locally.', 80, 240)

  ctx.font = '22px Georgia, serif'
  ctx.fillText('SHEET 1 / 1', width - 380, height - 150)
  ctx.fillText('SCALE  1:1', width - 380, height - 110)
  ctx.fillText('REV  -', width - 380, height - 70)

  return { canvas, previewWidth: width, previewHeight: height }
}

/* ------------------------------------------------------------------ public */

/**
 * Validate + rasterise a file into a DrawingAsset.
 *
 * Throws (an UploadError) only for validation failures; rasterisation failures
 * degrade to the fallback preview with isFallbackPreview: true.
 */
export async function createDrawingAsset(file: File): Promise<DrawingAsset> {
  const validationError = validateFile(file)
  if (validationError) throw validationError

  const kind = classifyFile(file) as DrawingSourceKind

  if (kind === 'image') {
    const previewUrl = URL.createObjectURL(file)
    try {
      const { width, height } = await loadImageDimensions(previewUrl)
      return {
        file,
        kind,
        fileName: file.name,
        fileSize: file.size,
        previewUrl,
        previewWidth: width,
        previewHeight: height,
        isFallbackPreview: false,
      }
    } catch {
      URL.revokeObjectURL(previewUrl)
      // fall through to the shared fallback below
    }
  } else {
    try {
      const rendered = await renderPdfFirstPage(file)
      return {
        file,
        kind,
        fileName: file.name,
        fileSize: file.size,
        ...rendered,
        isFallbackPreview: false,
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn('[drawingPreview] PDF rasterisation failed, using fallback', error)
      }
    }
  }

  const { canvas, previewWidth, previewHeight } = buildFallbackPreview(file.name)
  const previewUrl = await canvasToObjectUrl(canvas)
  return {
    file,
    kind,
    fileName: file.name,
    fileSize: file.size,
    previewUrl,
    previewWidth,
    previewHeight,
    isFallbackPreview: true,
  }
}
