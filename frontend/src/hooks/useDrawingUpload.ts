import { useCallback, useRef, useState } from 'react'
import { useExperienceStore } from '../state/experienceStore'
import { createDrawingAsset } from '../services/drawingPreview'
import { activeModelSource } from '../services/modelSource'
import type { UploadError } from '../types'

/**
 * The single entry point for getting a drawing into the experience.
 *
 * Everything upload-related is behind this hook so that Claude Account 2 can
 * make it talk to a real backend without touching a single cinematic
 * component. The cinematic scene only ever observes the store.
 *
 * Today `handleFiles` does: validate -> rasterise locally -> store ->
 * ask the ModelSource for a model -> start the cinematic.
 */
export function useDrawingUpload() {
  const transition = useExperienceStore((s) => s.transition)
  const setDrawing = useExperienceStore((s) => s.setDrawing)
  const setUploadError = useExperienceStore((s) => s.setUploadError)
  const setModel = useExperienceStore((s) => s.setModel)

  const [isDragging, setIsDragging] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  /** Drag events fire per-child; count them so leaving a child is not a leave. */
  const dragDepth = useRef(0)
  const abortRef = useRef<AbortController | null>(null)

  const handleFile = useCallback(
    async (file: File) => {
      setUploadError(null)
      setIsProcessing(true)

      // idle -> uploading. Refused if we are mid-sequence already.
      if (!transition('uploading')) {
        setIsProcessing(false)
        return
      }

      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      try {
        const drawing = await createDrawingAsset(file)
        if (controller.signal.aborted) return
        setDrawing(drawing)

        // Ask for the model now so it is decoded and ready long before the
        // hand lifts the book. Failures here must not break the cinematic:
        // the viewer falls back to inline geometry and surfaces the error.
        activeModelSource
          .requestModel(drawing, controller.signal)
          .then((result) => {
            if (!controller.signal.aborted) setModel(result)
          })
          .catch((error) => {
            if (controller.signal.aborted) return
            setModel({
              status: 'failed',
              error: error instanceof Error ? error.message : 'Model request failed.',
            })
          })

        // uploading -> uploaded kicks off the sequence director.
        transition('uploaded')
      } catch (error) {
        const uploadError = error as UploadError
        setUploadError(
          uploadError?.code
            ? uploadError
            : { code: 'preview-failed', message: 'That drawing could not be read.' },
        )
        // Back to the calm opening state so the user can try again.
        transition('idle')
      } finally {
        if (!controller.signal.aborted) setIsProcessing(false)
      }
    },
    [setDrawing, setModel, setUploadError, transition],
  )

  /** Accepts a FileList/array from either a drop or the file input. */
  const handleFiles = useCallback(
    (files: FileList | File[] | null) => {
      const first = files && files.length > 0 ? files[0] : null
      if (first) void handleFile(first)
    },
    [handleFile],
  )

  /* ------------------------------------------------------------ drag & drop */

  const onDragEnter = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    dragDepth.current += 1
    setIsDragging(true)
  }, [])

  const onDragOver = useCallback((event: React.DragEvent) => {
    // Required, otherwise the browser navigates to the dropped file.
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
  }, [])

  const onDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    dragDepth.current = Math.max(0, dragDepth.current - 1)
    if (dragDepth.current === 0) setIsDragging(false)
  }, [])

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()
      dragDepth.current = 0
      setIsDragging(false)
      handleFiles(event.dataTransfer.files)
    },
    [handleFiles],
  )

  const cancel = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setIsProcessing(false)
  }, [])

  return {
    isDragging,
    isProcessing,
    handleFiles,
    cancel,
    dropHandlers: { onDragEnter, onDragOver, onDragLeave, onDrop },
  }
}
