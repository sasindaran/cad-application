import { useEffect, useMemo } from 'react'
import * as THREE from 'three'

/**
 * Procedural canvas textures for the cinematic set.
 *
 * The repository ships no art assets, and the reference imagery is all about
 * *material* - dark grained wood, aged parchment, worn leather - so flat colours
 * would have lost the entire look. Drawing them procedurally keeps the bundle
 * free of binaries while still giving the surfaces grain to catch the
 * candlelight.
 *
 * All textures are 512px and generated once, then shared and disposed together.
 */

/** Cheap deterministic hash noise - no dependency, stable between reloads. */
function noise2D(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
  return s - Math.floor(s)
}

function makeCanvas(size: number) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2D canvas context unavailable for texture generation.')
  return { canvas, ctx }
}

function finish(canvas: HTMLCanvasElement, repeat: number): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(repeat, repeat)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

/* -------------------------------------------------------------------- wood */

/** Dark walnut workbench: warped grain lines plus pore speckle. */
export function createWoodTexture(size = 512): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas(size)

  ctx.fillStyle = '#3a2314'
  ctx.fillRect(0, 0, size, size)

  // Long grain running along X, warped so it never reads as straight stripes.
  for (let i = 0; i < 160; i++) {
    const y = Math.random() * size
    const amplitude = 2 + Math.random() * 7
    const frequency = 0.004 + Math.random() * 0.012
    const phase = Math.random() * Math.PI * 2
    const dark = Math.random() > 0.35

    ctx.strokeStyle = dark
      ? `rgba(26, 14, 7, ${0.10 + Math.random() * 0.22})`
      : `rgba(122, 78, 42, ${0.05 + Math.random() * 0.13})`
    ctx.lineWidth = 0.8 + Math.random() * 2.6
    ctx.beginPath()
    for (let x = 0; x <= size; x += 4) {
      const wy = y + Math.sin(x * frequency + phase) * amplitude
      if (x === 0) ctx.moveTo(x, wy)
      else ctx.lineTo(x, wy)
    }
    ctx.stroke()
  }

  // A couple of knots.
  for (let k = 0; k < 3; k++) {
    const cx = Math.random() * size
    const cy = Math.random() * size
    for (let r = 26; r > 0; r -= 2.2) {
      ctx.strokeStyle = `rgba(22, 12, 6, ${0.05 + (26 - r) / 120})`
      ctx.lineWidth = 1.4
      ctx.beginPath()
      ctx.ellipse(cx, cy, r, r * 0.55, Math.random() * 0.5, 0, Math.PI * 2)
      ctx.stroke()
    }
  }

  // Pore speckle.
  const image = ctx.getImageData(0, 0, size, size)
  const { data } = image
  for (let i = 0; i < data.length; i += 4) {
    const px = (i / 4) % size
    const py = Math.floor(i / 4 / size)
    const n = (noise2D(px * 0.9, py * 0.9) - 0.5) * 22
    data[i] = Math.max(0, Math.min(255, data[i] + n))
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + n))
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + n))
  }
  ctx.putImageData(image, 0, 0)

  return finish(canvas, 2)
}

/* --------------------------------------------------------------- parchment */

/** Aged cream paper with foxing blotches and a darkened border. */
export function createParchmentTexture(size = 512): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas(size)

  ctx.fillStyle = '#e8d8b4'
  ctx.fillRect(0, 0, size, size)

  // Foxing / staining.
  for (let i = 0; i < 90; i++) {
    const x = Math.random() * size
    const y = Math.random() * size
    const r = 8 + Math.random() * 52
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, r)
    const warmth = Math.random()
    gradient.addColorStop(0, `rgba(${168 + warmth * 30}, ${128 + warmth * 26}, 78, 0.16)`)
    gradient.addColorStop(1, 'rgba(168, 128, 78, 0)')
    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }

  // Darker, handled edges.
  const edge = ctx.createLinearGradient(0, 0, 0, size)
  edge.addColorStop(0, 'rgba(120, 86, 44, 0.30)')
  edge.addColorStop(0.16, 'rgba(120, 86, 44, 0)')
  edge.addColorStop(0.84, 'rgba(120, 86, 44, 0)')
  edge.addColorStop(1, 'rgba(120, 86, 44, 0.30)')
  ctx.fillStyle = edge
  ctx.fillRect(0, 0, size, size)

  // Paper fibre.
  const image = ctx.getImageData(0, 0, size, size)
  const { data } = image
  for (let i = 0; i < data.length; i += 4) {
    const px = (i / 4) % size
    const py = Math.floor(i / 4 / size)
    const n = (noise2D(px * 2.3, py * 2.3) - 0.5) * 16
    data[i] = Math.max(0, Math.min(255, data[i] + n))
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + n))
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + n * 0.7))
  }
  ctx.putImageData(image, 0, 0)

  return finish(canvas, 1)
}

/* ------------------------------------------------------------------ leather */

/** Worn oxblood book leather: pebbled grain and scuffed highlights. */
export function createLeatherTexture(size = 512): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas(size)

  ctx.fillStyle = '#4a2a18'
  ctx.fillRect(0, 0, size, size)

  // Pebble grain.
  for (let i = 0; i < 2600; i++) {
    const x = Math.random() * size
    const y = Math.random() * size
    const r = 1 + Math.random() * 3.6
    const light = Math.random() > 0.5
    ctx.fillStyle = light
      ? `rgba(108, 66, 36, ${0.06 + Math.random() * 0.14})`
      : `rgba(28, 14, 7, ${0.06 + Math.random() * 0.16})`
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }

  // Scuffs along the edges where a book is handled.
  for (let i = 0; i < 26; i++) {
    const x = Math.random() * size
    const y = Math.random() * size
    ctx.strokeStyle = `rgba(132, 88, 48, ${0.05 + Math.random() * 0.12})`
    ctx.lineWidth = 1 + Math.random() * 3
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + (Math.random() - 0.5) * 70, y + (Math.random() - 0.5) * 70)
    ctx.stroke()
  }

  return finish(canvas, 1)
}

/* --------------------------------------------------------------- page edges */

/** Striped texture for the fore-edge of the page block, so it reads as leaves. */
export function createPageEdgeTexture(size = 256): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas(size)
  ctx.fillStyle = '#ddcaa2'
  ctx.fillRect(0, 0, size, size)
  for (let y = 0; y < size; y += 1) {
    const tone = 190 + Math.floor(noise2D(y * 3.7, 11) * 55)
    ctx.fillStyle = `rgb(${tone}, ${tone - 22}, ${tone - 62})`
    ctx.fillRect(0, y, size, 1)
  }
  return finish(canvas, 1)
}

/* -------------------------------------------------------------------- hook */

export interface SceneTextures {
  wood: THREE.CanvasTexture
  parchment: THREE.CanvasTexture
  leather: THREE.CanvasTexture
  pageEdge: THREE.CanvasTexture
}

/**
 * Builds the set once per mount and disposes every texture on unmount, so
 * toggling between the cinematic and the viewer does not leak GPU memory.
 */
export function useSceneTextures(): SceneTextures {
  const textures = useMemo<SceneTextures>(
    () => ({
      wood: createWoodTexture(),
      parchment: createParchmentTexture(),
      leather: createLeatherTexture(),
      pageEdge: createPageEdgeTexture(),
    }),
    [],
  )

  useEffect(() => {
    return () => {
      Object.values(textures).forEach((texture) => texture.dispose())
    }
  }, [textures])

  return textures
}
