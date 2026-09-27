import { useEffect, useState } from 'react'
import * as THREE from 'three'
import type { DrawingAsset } from '../../types'

/**
 * Loads the drawing preview as a Three.js texture for the book page.
 *
 * Deliberately NOT drei's `useTexture`: that suspends, and suspending inside
 * the cinematic would blank the whole scene mid-sequence. Here the texture
 * arrives asynchronously and the page simply fades in once it is ready.
 *
 * The source URL is an object URL today and may be a backend
 * `originalDrawingUrl` later - nothing here assumes which.
 */
export function useDrawingTexture(drawing: DrawingAsset | null): THREE.Texture | null {
  const [texture, setTexture] = useState<THREE.Texture | null>(null)

  useEffect(() => {
    if (!drawing) {
      setTexture(null)
      return
    }

    let cancelled = false
    let loaded: THREE.Texture | null = null

    new THREE.TextureLoader().load(
      drawing.previewUrl,
      (result) => {
        if (cancelled) {
          result.dispose()
          return
        }
        result.colorSpace = THREE.SRGBColorSpace
        result.anisotropy = 8
        // Drawings are sheets, not tiles - clamping avoids edge bleed.
        result.wrapS = THREE.ClampToEdgeWrapping
        result.wrapT = THREE.ClampToEdgeWrapping
        loaded = result
        setTexture(result)
      },
      undefined,
      () => {
        if (!cancelled) setTexture(null)
      },
    )

    return () => {
      cancelled = true
      loaded?.dispose()
      setTexture(null)
    }
  }, [drawing])

  return texture
}
