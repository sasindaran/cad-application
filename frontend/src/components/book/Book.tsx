import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useExperienceStore } from '../../state/experienceStore'
import { STATE_DURATIONS } from '../../state/machine'
import { useTweenedValues } from '../../hooks/useTweenedValues'
import type { SceneTextures } from '../cinematic/textures'
import {
  BOOK,
  CLOSED_THICKNESS,
  COVER_DEPTH,
  COVER_WIDTH,
  DESK_TOP_Y,
  FLIP_LEAF_COUNT,
  FLOOR_Y,
  LANDING,
} from './bookGeometry'
import { useDrawingTexture } from './useDrawingTexture'

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
const smoothstep = (t: number) => t * t * (3 - 2 * t)

/** Fraction of a leaf-flip that any single leaf occupies. */
const FLIP_SPAN = 0.5

function leafProgress(flip: number, index: number, count: number): number {
  const stagger = count > 1 ? (1 - FLIP_SPAN) / (count - 1) : 0
  return smoothstep(clamp01((flip - index * stagger) / FLIP_SPAN))
}

/**
 * Hand-authored fall arc, sampled by `fall` in 0..1.
 *
 * Physics simulation was considered and rejected: `task.txt` asks for physics
 * only where genuinely useful, and a solver would make the shot
 * non-deterministic - the book has to land on a known mark, because that mark
 * is where the architectural model is waiting.
 */
function fallPose(t: number) {
  const slide = clamp01(t / 0.28) // creeps to the desk edge
  const drop = clamp01((t - 0.22) / 0.78) // then goes over
  const gravity = drop * drop // quadratic, reads as acceleration

  return {
    x: LANDING.x * drop,
    y: DESK_TOP_Y + CLOSED_THICKNESS / 2 - gravity * (DESK_TOP_Y - FLOOR_Y + 0.045),
    z: 0.02 + slide * 0.58 + drop * (LANDING.z - 0.6),
    rotX: slide * 0.3 + drop * (Math.PI - 0.3), // half tumble, lands on its face
    rotZ: drop * 0.16,
  }
}

interface BookProps {
  textures: SceneTextures
}

export function Book({ textures }: BookProps) {
  const state = useExperienceStore((s) => s.state)
  const jumped = useExperienceStore((s) => s.jumped)
  const reducedMotion = useExperienceStore((s) => s.reducedMotion)
  const drawing = useExperienceStore((s) => s.drawing)

  const drawingTexture = useDrawingTexture(drawing)

  /* ------------------------------------------------------------------ refs */
  const rootRef = useRef<THREE.Group>(null)
  const centerRef = useRef<THREE.Group>(null)
  const frontCoverRef = useRef<THREE.Group>(null)
  const leftStackRef = useRef<THREE.Group>(null)
  const drawingPageRef = useRef<THREE.Group>(null)
  const drawingMatRef = useRef<THREE.MeshStandardMaterial>(null)
  const leafRefs = useRef<(THREE.Group | null)[]>([])

  /* ------------------------------------------------------------- animation */
  const { values, tween, set } = useTweenedValues({
    cover: 0, // 0 = closed, 1 = fully open
    drawing: 0, // drawing opacity on the page
    flip: 0, // page-flip progress
    fall: 0, // 0 = on the desk, 1 = on the floor
    lift: 0, // hand raising the book
    exit: 0, // book leaving frame after the reveal
  })

  useEffect(() => {
    // Beat length derived from the same table the sequence director uses, so
    // animation and pacing can never drift apart.
    const instant = reducedMotion || jumped
    const beat = (fraction = 0.85) =>
      instant ? 0 : ((STATE_DURATIONS[state] ?? 1000) * fraction) / 1000

    switch (state) {
      case 'idle':
      case 'uploading':
        set({ cover: 0, drawing: 0, flip: 0, fall: 0, lift: 0, exit: 0 })
        break

      case 'uploaded':
        // The book "reacts": the cover cracks open a few degrees.
        set({ drawing: 0, flip: 0, fall: 0, lift: 0, exit: 0 })
        tween({ cover: 0.05 }, { duration: beat(0.9), ease: 'power2.out' })
        break

      case 'bookOpening':
        set({ drawing: 0, flip: 0, fall: 0, lift: 0, exit: 0 })
        tween({ cover: 1 }, { duration: beat(0.92), ease: 'power3.inOut' })
        break

      case 'drawingReveal':
        set({ cover: 1, flip: 0, fall: 0, lift: 0, exit: 0 })
        tween({ drawing: 1 }, { duration: beat(0.62), ease: 'power2.out' })
        break

      case 'pageFlip':
        set({ cover: 1, drawing: 1, fall: 0, lift: 0, exit: 0 })
        tween({ flip: 1 }, { duration: beat(0.95), ease: 'none' })
        break

      case 'bookFall':
        set({ drawing: 1, flip: 1, lift: 0, exit: 0 })
        // The covers swing mostly shut as it goes over the edge.
        tween({ cover: 0.12 }, { duration: beat(0.45), ease: 'power2.in' })
        tween({ fall: 1 }, { duration: beat(1), ease: 'power2.in' })
        break

      case 'bookOnGround':
        set({ fall: 1, lift: 0, exit: 0 })
        tween({ cover: 0.04 }, { duration: beat(0.5), ease: 'power2.out' })
        break

      case 'handPickup':
        set({ fall: 1, exit: 0 })
        tween({ lift: 1 }, { duration: beat(0.95), ease: 'power2.inOut' })
        break

      case 'modelReveal':
        set({ fall: 1, lift: 1 })
        tween({ exit: 1 }, { duration: beat(0.7), ease: 'power2.in' })
        break

      default:
        break
    }
  }, [state, jumped, reducedMotion, set, tween])

  /* ----------------------------------------------------------------- frame */
  useFrame(() => {
    const v = values.current
    const root = rootRef.current
    if (!root) return

    const coverAngle = v.cover * Math.PI

    // --- world placement: desk -> fall -> hand lift -> exit
    const pose = fallPose(v.fall)
    const liftEase = smoothstep(clamp01((v.lift - 0.45) / 0.55))
    const exit = v.exit

    root.position.set(
      pose.x + liftEase * 0.3 + exit * 0.34,
      pose.y + liftEase * 0.62 + exit * 0.5,
      pose.z + liftEase * 0.1 + exit * 0.22,
    )
    root.rotation.set(
      pose.rotX - liftEase * 0.85,
      liftEase * 0.35 + exit * 0.5,
      pose.rotZ + liftEase * 0.2,
    )

    // --- centring: a closed book hinges open leftward, so the group slides
    //     from half-width-right to centred as the cover swings.
    const center = centerRef.current
    if (center) center.position.x = -COVER_WIDTH / 2 + (v.cover * COVER_WIDTH) / 2

    // --- front cover: swings to the left and drops to sit flat
    const frontCover = frontCoverRef.current
    if (frontCover) {
      frontCover.rotation.z = coverAngle
      frontCover.position.y = THREE.MathUtils.lerp(
        BOOK.blockThickness / 2 + BOOK.coverThickness / 2,
        -BOOK.blockThickness / 2 - BOOK.coverThickness / 2,
        v.cover,
      )
    }

    // --- left half of the page block: follows the cover
    const leftStack = leftStackRef.current
    if (leftStack) {
      leftStack.rotation.z = coverAngle
      leftStack.position.y = THREE.MathUtils.lerp(
        BOOK.blockThickness / 4,
        -BOOK.blockThickness / 4,
        v.cover,
      )
    }

    // --- loose leaves: pinned to the left half until the flip takes them right
    for (let i = 0; i < FLIP_LEAF_COUNT; i++) {
      const leaf = leafRefs.current[i]
      if (!leaf) continue
      const progress = leafProgress(v.flip, i, FLIP_LEAF_COUNT)
      leaf.rotation.z = coverAngle * (1 - progress)
      // Lift as it passes overhead so leaves arc rather than scrape.
      leaf.position.y = 0.002 + i * 0.0022 + Math.sin(progress * Math.PI) * 0.014
    }

    // --- the drawing itself
    const page = drawingPageRef.current
    if (page) page.visible = v.drawing > 0.01
    const mat = drawingMatRef.current
    if (mat) mat.opacity = v.drawing
  })

  /* ------------------------------------------------------------- materials */
  const leatherProps = useMemo(
    () => ({ map: textures.leather, roughness: 0.78, metalness: 0.04, color: '#8a5a34' }),
    [textures.leather],
  )
  const parchmentProps = useMemo(
    () => ({ map: textures.parchment, roughness: 0.95, metalness: 0 }),
    [textures.parchment],
  )

  /** Fit the drawing inside the page, preserving its aspect ratio. */
  const drawingSize = useMemo(() => {
    const maxW = BOOK.pageWidth * 0.84
    const maxH = BOOK.pageDepth * 0.86
    if (!drawing) return { w: maxW, h: maxH }
    const aspect = drawing.previewWidth / drawing.previewHeight
    return aspect > maxW / maxH
      ? { w: maxW, h: maxW / aspect }
      : { w: maxH * aspect, h: maxH }
  }, [drawing])

  const halfBlock = BOOK.blockThickness / 4
  const coverY = BOOK.blockThickness / 2 + BOOK.coverThickness / 2

  return (
    <group ref={rootRef} position={[0, DESK_TOP_Y + CLOSED_THICKNESS / 2, 0.02]}>
      <group ref={centerRef} position={[-COVER_WIDTH / 2, 0, 0]}>
        {/* Spine - sits at the left edge when closed, at the centre when open */}
        <mesh position={[-BOOK.coverThickness / 2, 0, 0]} castShadow receiveShadow>
          <boxGeometry
            args={[BOOK.coverThickness * 1.6, CLOSED_THICKNESS, COVER_DEPTH]}
          />
          <meshStandardMaterial {...leatherProps} color="#7a4c2b" />
        </mesh>

        {/* Back cover - static, the book always rests on it */}
        <group position={[0, -coverY, 0]}>
          <mesh position={[COVER_WIDTH / 2, 0, 0]} castShadow receiveShadow>
            <boxGeometry args={[COVER_WIDTH, BOOK.coverThickness, COVER_DEPTH]} />
            <meshStandardMaterial {...leatherProps} />
          </mesh>
        </group>

        {/* Front cover - hinged */}
        <group ref={frontCoverRef} position={[0, coverY, 0]}>
          <mesh position={[COVER_WIDTH / 2, 0, 0]} castShadow receiveShadow>
            <boxGeometry args={[COVER_WIDTH, BOOK.coverThickness, COVER_DEPTH]} />
            <meshStandardMaterial {...leatherProps} />
          </mesh>
          {/* Debossed frame, so the cover is not a plain slab */}
          <mesh position={[COVER_WIDTH / 2, BOOK.coverThickness / 2 + 0.0008, 0]}>
            <ringGeometry args={[BOOK.pageDepth * 0.3, BOOK.pageDepth * 0.33, 4, 1]} />
            <meshStandardMaterial
              color="#c99a5a"
              roughness={0.35}
              metalness={0.55}
              side={THREE.DoubleSide}
            />
          </mesh>
        </group>

        {/* Right half of the page block - static */}
        <group position={[0, -halfBlock, 0]}>
          <mesh position={[BOOK.pageWidth / 2, 0, 0]} castShadow receiveShadow>
            <boxGeometry args={[BOOK.pageWidth, BOOK.blockThickness / 2, BOOK.pageDepth]} />
            <meshStandardMaterial {...parchmentProps} />
          </mesh>
        </group>

        {/* Left half of the page block - hinged with the cover */}
        <group ref={leftStackRef} position={[0, halfBlock, 0]}>
          <mesh position={[BOOK.pageWidth / 2, 0, 0]} castShadow receiveShadow>
            <boxGeometry args={[BOOK.pageWidth, BOOK.blockThickness / 2, BOOK.pageDepth]} />
            <meshStandardMaterial {...parchmentProps} />
          </mesh>
        </group>

        {/* The uploaded drawing, sitting on the right-hand page */}
        <group ref={drawingPageRef} visible={false}>
          <mesh
            position={[BOOK.pageWidth / 2, 0.0016, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <planeGeometry args={[drawingSize.w, drawingSize.h]} />
            <meshStandardMaterial
              ref={drawingMatRef}
              map={drawingTexture}
              transparent
              opacity={0}
              roughness={0.92}
              metalness={0}
              // Multiplied against the warm key light so the ink sits IN the
              // page rather than glowing on top of it.
              color="#efe4cc"
              polygonOffset
              polygonOffsetFactor={-2}
            />
          </mesh>
        </group>

        {/* Loose leaves that turn toward the right during the flip beat */}
        {Array.from({ length: FLIP_LEAF_COUNT }, (_, i) => (
          <group
            key={i}
            ref={(node) => {
              leafRefs.current[i] = node
            }}
            position={[0, 0.002 + i * 0.0022, 0]}
          >
            <mesh position={[BOOK.pageWidth / 2, 0, 0]} castShadow>
              <boxGeometry
                args={[BOOK.pageWidth * 0.99, BOOK.leafThickness, BOOK.pageDepth * 0.99]}
              />
              <meshStandardMaterial
                {...parchmentProps}
                side={THREE.DoubleSide}
                color="#f0e2c0"
              />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  )
}
