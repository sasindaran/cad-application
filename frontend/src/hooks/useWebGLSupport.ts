import { useState } from 'react'

/**
 * Detects WebGL availability once, before the R3F Canvas mounts.
 *
 * `task.txt` requires a useful fallback rather than a blank page when WebGL is
 * unavailable, and a failed Canvas mount is much harder to recover from than a
 * pre-flight check.
 */
function detectWebGL(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const canvas = document.createElement('canvas')
    const context =
      canvas.getContext('webgl2') ??
      canvas.getContext('webgl') ??
      canvas.getContext('experimental-webgl')
    if (!context) return false
    // Release the probe context immediately; browsers cap concurrent contexts.
    const lose = (context as WebGLRenderingContext).getExtension('WEBGL_lose_context')
    lose?.loseContext()
    return true
  } catch {
    return false
  }
}

export function useWebGLSupport(): boolean {
  const [supported] = useState(detectWebGL)
  return supported
}
