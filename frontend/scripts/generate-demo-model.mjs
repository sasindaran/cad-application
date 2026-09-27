/**
 * Generates `public/models/demo.glb` - the placeholder architectural model
 * revealed when the hand lifts the book.
 *
 * Why a generator instead of a committed binary blob: this repository had no
 * art assets, and a procedurally written GLB keeps the asset reviewable in
 * source control while still exercising the REAL GLTF loading path in the
 * viewer (rather than quietly falling back to inline geometry).
 *
 * Run with:  npm run generate:model
 *
 * Claude Account 2: you do not need this script. Replace the model by having a
 * ModelSource return a different `modelUrl` - see src/services/modelSource.ts.
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const OUT = resolve(here, '../public/models/demo.glb')

/* ----------------------------------------------------------------- massing */

// A compact civic/office massing: podium, two towers, a link bridge, an
// entrance canopy and a little site context. Recognisably a building without
// pretending to be a real one.
const MATERIALS = [
  { name: 'Concrete', baseColorFactor: [0.80, 0.76, 0.70, 1], metallicFactor: 0.0, roughnessFactor: 0.85 },
  { name: 'Glazing', baseColorFactor: [0.22, 0.34, 0.42, 1], metallicFactor: 0.65, roughnessFactor: 0.18 },
  { name: 'Bronze', baseColorFactor: [0.46, 0.31, 0.16, 1], metallicFactor: 0.45, roughnessFactor: 0.45 },
  { name: 'Roofing', baseColorFactor: [0.27, 0.27, 0.29, 1], metallicFactor: 0.1, roughnessFactor: 0.9 },
]

const CONCRETE = 0
const GLAZING = 1
const BRONZE = 2
const ROOFING = 3

/** [centerX, centerY, centerZ, sizeX, sizeY, sizeZ, materialIndex] */
const BOXES = [
  // Site
  [0, -0.15, 0, 26, 0.3, 20, CONCRETE],
  [-10.5, 0.25, 0, 1, 0.5, 16, CONCRETE],
  [10.5, 0.25, 0, 1, 0.5, 16, CONCRETE],

  // Podium
  [0, 0.6, 0, 18, 1.2, 13, CONCRETE],

  // Entrance steps, stepping down toward +Z
  [0, 1.05, 7.0, 10, 0.3, 1.0, CONCRETE],
  [0, 0.75, 7.8, 10, 0.3, 1.0, CONCRETE],
  [0, 0.45, 8.6, 10, 0.3, 1.0, CONCRETE],
  [0, 0.15, 9.4, 10, 0.3, 1.0, CONCRETE],

  // Main tower
  [-4.5, 6.7, 0, 7, 11, 7, CONCRETE],
  [-4.5, 3.2, 0, 7.18, 0.9, 7.18, GLAZING],
  [-4.5, 5.6, 0, 7.18, 0.9, 7.18, GLAZING],
  [-4.5, 8.0, 0, 7.18, 0.9, 7.18, GLAZING],
  [-4.5, 10.4, 0, 7.18, 0.9, 7.18, GLAZING],
  [-4.5, 12.35, 0, 7.6, 0.5, 7.6, ROOFING],
  [-4.5, 13.2, 0, 3, 1.2, 3, CONCRETE],
  [-4.5, 15.3, 0, 0.18, 3, 0.18, BRONZE],

  // Secondary wing
  [4.8, 4.2, -0.5, 6, 6, 9, CONCRETE],
  [4.8, 2.6, -0.5, 6.18, 0.8, 9.18, GLAZING],
  [4.8, 4.4, -0.5, 6.18, 0.8, 9.18, GLAZING],
  [4.8, 6.2, -0.5, 6.18, 0.8, 9.18, GLAZING],
  [4.8, 7.4, -0.5, 6.6, 0.4, 9.6, ROOFING],

  // Link bridge
  [0.2, 5.2, 0, 3.6, 1.4, 3.2, GLAZING],
  [0.2, 4.4, 0, 3.8, 0.25, 3.4, BRONZE],

  // Entrance canopy
  [0, 2.45, 7.3, 8, 0.3, 2.6, BRONZE],
  [-3.4, 1.75, 8.2, 0.3, 1.1, 0.3, BRONZE],
  [3.4, 1.75, 8.2, 0.3, 1.1, 0.3, BRONZE],
]

/* ------------------------------------------------------------ box geometry */

// Unit cube faces: [normal, four corner offsets in CCW winding]
const FACES = [
  { n: [0, 0, 1], c: [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]] },
  { n: [0, 0, -1], c: [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]] },
  { n: [1, 0, 0], c: [[1, -1, 1], [1, -1, -1], [1, 1, -1], [1, 1, 1]] },
  { n: [-1, 0, 0], c: [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]] },
  { n: [0, 1, 0], c: [[-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1]] },
  { n: [0, -1, 0], c: [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]] },
]

/** Accumulates boxes belonging to one material into flat vertex arrays. */
function buildGroup(boxes) {
  const positions = []
  const normals = []
  const indices = []

  for (const [cx, cy, cz, sx, sy, sz] of boxes) {
    const hx = sx / 2
    const hy = sy / 2
    const hz = sz / 2
    for (const face of FACES) {
      const base = positions.length / 3
      for (const [ox, oy, oz] of face.c) {
        positions.push(cx + ox * hx, cy + oy * hy, cz + oz * hz)
        normals.push(face.n[0], face.n[1], face.n[2])
      }
      indices.push(base, base + 1, base + 2, base, base + 2, base + 3)
    }
  }

  return { positions, normals, indices }
}

/* ---------------------------------------------------------- binary packing */

const chunks = []
let byteOffset = 0

/** Appends `data` to the BIN chunk, 4-byte aligned, returning its bufferView. */
function pushView(data, target) {
  const padding = (4 - (byteOffset % 4)) % 4
  if (padding) {
    chunks.push(Buffer.alloc(padding))
    byteOffset += padding
  }
  const buffer = Buffer.from(data.buffer, data.byteOffset, data.byteLength)
  chunks.push(buffer)
  const view = { buffer: 0, byteOffset, byteLength: data.byteLength }
  if (target !== undefined) view.target = target
  byteOffset += data.byteLength
  return view
}

const ARRAY_BUFFER = 34962
const ELEMENT_ARRAY_BUFFER = 34963

const bufferViews = []
const accessors = []
const primitives = []

for (let materialIndex = 0; materialIndex < MATERIALS.length; materialIndex++) {
  const boxes = BOXES.filter((b) => b[6] === materialIndex)
  if (boxes.length === 0) continue

  const { positions, normals, indices } = buildGroup(boxes)

  const posArray = new Float32Array(positions)
  const nrmArray = new Float32Array(normals)
  // 24 verts per box; comfortably inside uint16 for this massing.
  const idxArray = new Uint16Array(indices)

  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  for (let i = 0; i < posArray.length; i += 3) {
    for (let a = 0; a < 3; a++) {
      const v = posArray[i + a]
      if (v < min[a]) min[a] = v
      if (v > max[a]) max[a] = v
    }
  }

  bufferViews.push(pushView(posArray, ARRAY_BUFFER))
  const positionAccessor = accessors.length
  accessors.push({
    bufferView: bufferViews.length - 1,
    componentType: 5126, // FLOAT
    count: posArray.length / 3,
    type: 'VEC3',
    min,
    max,
  })

  bufferViews.push(pushView(nrmArray, ARRAY_BUFFER))
  const normalAccessor = accessors.length
  accessors.push({
    bufferView: bufferViews.length - 1,
    componentType: 5126,
    count: nrmArray.length / 3,
    type: 'VEC3',
  })

  bufferViews.push(pushView(idxArray, ELEMENT_ARRAY_BUFFER))
  const indexAccessor = accessors.length
  accessors.push({
    bufferView: bufferViews.length - 1,
    componentType: 5123, // UNSIGNED_SHORT
    count: idxArray.length,
    type: 'SCALAR',
  })

  primitives.push({
    attributes: { POSITION: positionAccessor, NORMAL: normalAccessor },
    indices: indexAccessor,
    material: materialIndex,
    mode: 4, // TRIANGLES
  })
}

const binary = Buffer.concat(chunks)

const gltf = {
  asset: {
    version: '2.0',
    generator: 'cad-application demo massing generator (scripts/generate-demo-model.mjs)',
  },
  scene: 0,
  scenes: [{ name: 'DemoBuilding', nodes: [0] }],
  nodes: [{ name: 'DemoBuilding', mesh: 0 }],
  meshes: [{ name: 'DemoBuilding', primitives }],
  materials: MATERIALS.map((m) => ({
    name: m.name,
    doubleSided: false,
    pbrMetallicRoughness: {
      baseColorFactor: m.baseColorFactor,
      metallicFactor: m.metallicFactor,
      roughnessFactor: m.roughnessFactor,
    },
  })),
  accessors,
  bufferViews,
  buffers: [{ byteLength: binary.byteLength }],
}

/* ------------------------------------------------------------ GLB container */

function padTo4(buffer, padByte) {
  const remainder = buffer.byteLength % 4
  if (remainder === 0) return buffer
  return Buffer.concat([buffer, Buffer.alloc(4 - remainder, padByte)])
}

const jsonChunk = padTo4(Buffer.from(JSON.stringify(gltf), 'utf8'), 0x20) // pad with spaces
const binChunk = padTo4(binary, 0x00)

const header = Buffer.alloc(12)
header.writeUInt32LE(0x46546c67, 0) // 'glTF'
header.writeUInt32LE(2, 4) // version
header.writeUInt32LE(12 + 8 + jsonChunk.byteLength + 8 + binChunk.byteLength, 8)

const jsonHeader = Buffer.alloc(8)
jsonHeader.writeUInt32LE(jsonChunk.byteLength, 0)
jsonHeader.writeUInt32LE(0x4e4f534a, 4) // 'JSON'

const binHeader = Buffer.alloc(8)
binHeader.writeUInt32LE(binChunk.byteLength, 0)
binHeader.writeUInt32LE(0x004e4942, 4) // 'BIN\0'

const glb = Buffer.concat([header, jsonHeader, jsonChunk, binHeader, binChunk])

mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, glb)

const triangles = primitives.reduce((sum, p) => sum + accessors[p.indices].count / 3, 0)
console.log(
  `Wrote ${OUT}\n  ${glb.byteLength} bytes, ${primitives.length} primitives, ${triangles} triangles`,
)
