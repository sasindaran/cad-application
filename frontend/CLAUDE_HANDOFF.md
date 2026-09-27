# CLAUDE HANDOFF LOG

Append-oriented engineering log written by **Claude Account 1 (frontend)** for
**Claude Account 2 (backend / AI / n8n / Faber / Gemini / Grok integration)**.

> **Rule:** never erase previous entries. Append new entries at the bottom.

Companion document: [`FRONTEND_INTEGRATION_CONTRACT.md`](./FRONTEND_INTEGRATION_CONTRACT.md)

---

## 2026-09-27 — Entry 001 — Repository inspection (pre-flight)

### Operation
Inspected the repository before writing any code, as required by `task.txt`.

### Files affected
None (read-only inspection).

### What changed
Nothing yet.

### Why
`task.txt` mandates inspecting existing infrastructure and not destroying
existing work before implementing.

### Important implementation details
Findings at the start of the session:

- Repo root: `E:\coding\cad application\cad-application`
- Git repo: **yes**, branch `main`, **zero commits** (`No commits yet`)
- Working tree: clean / empty — only a `.git` directory existed
- Remote `origin`: `https://github.com/sasindaran/cad-application.git` (fetch + push)
- **No existing frontend, no package.json, no source of any kind**
- Toolchain: Node `v24.13.1`, npm `11.8.0`, git `2.53.0.windows.1`

### Backend integration notes
The repository is a blank slate. `frontend/` is the only directory created by
this task, so Claude Account 2 is free to create `backend/`, `n8n/`,
`infra/`, etc. at the root without any collision.

### Git commit/hash if applicable
N/A — no commits existed at inspection time.

---

## 2026-09-27 — Entry 002 — Project scaffold + dependency install

### Operation
Scaffolded a Vite + React + TypeScript application and installed the 3D /
animation dependency set.

### Files affected
- `frontend/` (created, whole tree)
- `frontend/package.json`, `frontend/package-lock.json`
- `frontend/tsconfig*.json`, `frontend/vite.config.ts`, `frontend/index.html`
- `frontend/.gitignore`, `frontend/.oxlintrc.json`

### What changed
Ran `npm create vite@latest frontend -- --template react-ts --yes`, then
installed runtime and dev dependencies.

### Why
`task.txt` names React + TypeScript + Vite + React Three Fiber + Three.js +
drei + GSAP as the preferred stack. Nothing pre-existed, so a clean scaffold
was the correct starting point rather than retrofitting.

### Important implementation details
Dependency versions actually installed (pinned by `package-lock.json`):

| Package | Version | Purpose |
| --- | --- | --- |
| `react` / `react-dom` | 19.2.8 | UI runtime |
| `three` | 0.186.1 | 3D engine |
| `@react-three/fiber` | 9.8.1 | React renderer for Three.js (v9 = React 19 compatible) |
| `@react-three/drei` | 10.7.9 | R3F helpers |
| `gsap` | 3.15.0 | Cinematic timeline |
| `zustand` | 5.0.15 | State-machine store |
| `pdfjs-dist` | 6.3.289 | Local, in-browser PDF first-page rasterisation |
| `lucide-react` | 1.48.0 | Icon set for the viewer UI |
| `@types/three` | 0.186.0 (dev) | Three.js types |
| `typescript` | ~6.0.2 (dev) | Type checking |
| `vite` | 8.3.0 (dev) | Build tool / dev server |
| `oxlint` | 1.81.0 (dev) | Linter shipped by the Vite template |

Deliberately **not** installed: Tailwind (the repo had no existing CSS
convention and plain CSS keeps the cinematic styling self-contained and
dependency-light), any physics engine (`task.txt` says use physics only if
genuinely useful — the book fall is a hand-authored GSAP arc, which is more
art-directable and far cheaper), and any HTTP client (no backend in scope).

`npm audit` reported **0 vulnerabilities**.

### Backend integration notes
`pdfjs-dist` is used **entirely client-side** — no PDF is ever transmitted.
When Claude Account 2 adds real upload, the PDF `File` object is already held
in the store and can be posted directly; see `useDrawingUpload` in the
integration contract.

No HTTP client is installed. Claude Account 2 should add one (or use `fetch`)
inside `src/services/` only, and must not reach into the cinematic components.

### Git commit/hash if applicable
Not yet committed at time of this entry.

---

## 2026-09-27 — Entry 003 — Core architecture: types, state machine, services

### Operation
Established the architectural spine before writing any 3D component, so the
cinematic layer could be built on top of stable contracts.

### Files affected
- `src/types/index.ts` (created)
- `src/state/machine.ts` (created)
- `src/state/experienceStore.ts` (created)
- `src/services/drawingPreview.ts` (created)
- `src/services/modelSource.ts` (created)
- `src/` subtree reorganised: removed the Vite template's `App.tsx`,
  `App.css`, `index.css`, `assets/`

### What changed
Four load-bearing decisions:

1. **`src/types/index.ts` is the shared vocabulary.** It imports nothing from
   components, so the future backend layer can depend on it freely.
   `ModelResult` / `ModelSource` / `ModelQuestion` are defined here.

2. **`src/state/machine.ts` holds the machine as data, not as code.**
   `TRANSITIONS` is a `Record<ExperienceState, ExperienceState[]>` and every
   move goes through `canTransition`. Illegal transitions are refused and
   warned about in dev rather than silently corrupting the sequence.
   `STATE_DURATIONS` is the single source of truth for cinematic pacing.

3. **`src/state/experienceStore.ts` is a Zustand store.** Chosen over Context
   because the R3F render loop reads this state every frame; Zustand lets
   components subscribe to one slice without re-rendering the whole Canvas
   subtree on unrelated writes. `transition()` validates; `jumpTo()` is the
   debug escape hatch that bypasses edge validation.

4. **`src/services/modelSource.ts` is THE backend seam.** See below.

### Why
`task.txt` requires an explicit state machine rather than scattered booleans,
and requires that Account 2 be able to swap in a real pipeline without
redesigning the frontend. Putting the contracts in first made that structural
rather than aspirational.

### Important implementation details
- `ExperienceState` includes an `error` state beyond the list in `task.txt`,
  because WebGL/model/preview failures need somewhere to land.
- `durationFor(state, reducedMotion)` collapses every beat to 220 ms under
  `prefers-reduced-motion`. The logical sequence still runs to completion, as
  `task.txt` requires — only the drama is removed.
- `drawingPreview.ts` limits: **25 MB**, accepts `.pdf .png .jpg .jpeg .webp`,
  preview texture capped at **1600 px** on the long edge.
- PDF page 1 is rasterised with pdf.js onto a canvas that is **filled white
  first**, because pdf.js composites onto transparency and an engineering
  drawing has to read as ink on paper.
- If rasterisation fails (encrypted/exotic PDF), `createDrawingAsset` degrades
  to a hand-drawn "drafting sheet" fallback canvas with
  `isFallbackPreview: true` instead of throwing. `task.txt` explicitly permits
  a graceful placeholder, and this keeps the cinematic from dead-ending.
- Object URLs are revoked in `experienceStore.releaseDrawing()` on both
  `setDrawing` (replacement) and `reset`, so long sessions do not leak blobs.

### Backend integration notes
**This is the most important entry for Account 2.**

`src/services/modelSource.ts` exports `activeModelSource: ModelSource`.
No component anywhere imports `DEMO_MODEL_URL`. The cinematic scene and the
viewer both read `ModelResult` out of the store.

To go live: implement `HttpModelSource` (a commented sketch is already in the
file) and change the single binding at the bottom of that file. Nothing else
needs to change.

`ModelResult.status` already types `'needs_input'` with a `questions[]` array
for the missing-dimension workflow. No UI is rendered for that case — the
natural place to add it is a new state between `uploaded` and `bookOpening`
in `state/machine.ts`.

### Git commit/hash if applicable
Not yet committed at time of this entry.

---

## 2026-09-27 — Entry 004 — Demo architectural model (`/models/demo.glb`)

### Operation
Wrote a generator that produces the placeholder architectural GLB, and
verified the output against Three.js's real `GLTFLoader`.

### Files affected
- `scripts/generate-demo-model.mjs` (created)
- `public/models/demo.glb` (generated, 20 076 bytes)

### What changed
`scripts/generate-demo-model.mjs` writes a valid glTF 2.0 binary container by
hand: box massing → merged vertex/normal/index arrays per material → JSON +
BIN chunks → GLB header.

### Why
The repository had zero art assets. Two options existed: (a) always render
inline React geometry for the "model", or (b) produce a real GLB.

I chose (b) deliberately. `task.txt` requires that `/models/demo.glb` be
replaceable by a backend-returned URL. If the demo model were inline geometry,
the GLTF loading path would never execute during development and would be
**unverified** the first time Account 2 points it at a real URL. Generating a
real GLB means the loader, the bounding-box auto-fit, the material handling
and the disposal path are all exercised today.

Keeping it as a *generator* rather than a committed opaque binary also keeps
the asset reviewable in source control.

### Important implementation details
- Massing: site slab, podium, entrance steps, an 11 m main tower with glazing
  bands, a 6 m secondary wing, a link bridge, an entrance canopy, site walls.
- 4 PBR materials: Concrete, Glazing (metallic 0.65 / rough 0.18), Bronze,
  Roofing.
- **312 triangles, 4 primitives, 20 KB** — deliberately tiny, because
  `task.txt` calls out mobile GPU limits.
- Model bounds verified: `26.00 x 17.10 x 20.00`, centred at `(0, 8.25, 0)`.
  The viewer does **not** assume these numbers — it auto-fits from the loaded
  bounding box, so a replacement model of any size frames correctly.
- Indices are `UNSIGNED_SHORT`; the massing is far inside the 65 535 limit.
- npm script `generate:model` added.

### Problem encountered and solved
Verifying the GLB from a script in the system temp directory failed with
`ERR_MODULE_NOT_FOUND: Cannot find package 'three'` — Node resolves
`node_modules` from the *script's* location, not the cwd. Re-ran the
verification from a throwaway file inside `frontend/` (since deleted).

Verification result: `PARSE OK — meshes: 4, triangles: 312`, all four
materials present with correct metalness/roughness.

### Backend integration notes
Do not repoint `DEMO_MODEL_URL` at a backend URL — it is also the offline
fallback used when a backend model fails to load. Return a different
`modelUrl` from your `ModelSource` instead.

### Git commit/hash if applicable
Not yet committed at time of this entry.
