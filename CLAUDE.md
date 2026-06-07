# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Vite + React 19 single-page app (package name `cool-graph`, product name "Cozy") that renders an animated, 3D-rotatable knowledge-graph / portfolio "constellation" on a WebGL `<canvas>`. Rendering uses **Three.js** (`WebGLRenderer`): nodes and halos are `InstancedMesh` billboards, edges are dynamic `LineSegments` buffers, dust is a `Points` cloud, and labels are canvas-texture `Sprite`s. (The git history also contains the original hand-rolled Canvas 2D renderer this replaced; Three.js won every perf-benchmark scenario — see `plan-doc/three-renderer-experiment.md`.)

## Commands

```bash
npm run dev          # Vite dev server on 127.0.0.1 (default :5173)
npm run build        # production build
npm run preview      # serve the production build (used by perf tests)

npm test             # unit tests:  node --test test/*.test.mjs
npm run test:e2e     # browser E2E: node --test test/e2e/*.test.mjs   (needs Chrome)
npm run test:perf    # build, then: node --test test/perf/*.test.mjs  (needs Chrome)
npm run test:all     # unit + e2e
```

Run a single unit test file or a test by name (uses Node's built-in `node:test`):

```bash
node --test test/graphData.test.mjs
node --test --test-name-pattern "graph edges" test/graphData.test.mjs
```

- E2E and perf tests use `playwright-core` and launch installed Chrome (channel `chrome`); override with `PLAYWRIGHT_CHROME_CHANNEL`. They spawn their own Vite dev/preview server on a free port — do not start one yourself.
- Perf tests write JSON reports (and failure screenshots/traces) to `perf-results/`.
- There is **no linter or type checker** configured. Match existing style by hand.
- The Three.js renderer makes the production bundle large (~745 kB min / ~204 kB gzip, vs ~229/73 for the old Canvas build), so `npm run build` prints a chunk-size warning. This larger initial JS is the renderer's main trade-off; it is not measured by the perf benchmark (which times runtime frames).

## Architecture

Five source files under `src/`, with a deliberate separation between pure logic (unit-tested) and the Three.js render loop (E2E/perf-tested):

- **`graphData.js`** — the single source of truth for content. `graphNodes` (card data, ~18 real entries), `graphEdges` (derived purely from each node's `parentId`), `formations`, `graphScaleProfiles`, and helpers (`getNodeContent`, `getConnectionCount`, `getGraphScaleProfile`). Static ES module, fully reviewable and testable. The visual node count (`visualNodeCount` = 54, or larger scale profiles) exceeds real content; extra visual nodes cycle through content via `getNodeContent` (modulo).

- **`graphInteraction.js`** — pure, DOM-free math/interaction helpers. The live renderer uses its drag state (`beginDrag`/`updateDragRotation`/`endDrag`) and screen-space hit-testing (`findHitNode`/`hitRadiusForNode`). It also still exports the Canvas-era 3D rotation/projection helpers (`rotatePoint3d`/`projectNode`/`advanceNodePosition`); the Three.js path projects through camera matrices instead, but these stay pure and unit-tested. Keep this DOM-free so it stays testable.

- **`graphPerf.js`** — opt-in performance instrumentation. Disabled by default; enabled by `?perf=1` query param or `VITE_PERF=1`. When enabled it installs a global collector at `window.__COZY_GRAPH_PERF__` that records per-frame and per-stage timings, Long Tasks, heap, and drag/click latency.

- **`App.jsx`** — all UI plus the render loop. Components: `CozyGraph` (the canvas), `Waveform`, `NodeCard`, `App`. Most logic lives in the `CozyGraph` `useEffect`.

- **`main.jsx`** — React entry; mounts `<App>` into `#root` under `StrictMode`.

### The render loop (most important thing to understand)

`CozyGraph` runs a single `requestAnimationFrame` loop inside one `useEffect`. **Node positions are stored in refs (`nodesRef`), not React state** — this is intentional, so per-frame motion never triggers a React re-render. Only `formation`, `theme`, `selectedNode`, and `playing` are React state.

Each frame executes a fixed pipeline, and each stage is timed via `frameRecorder.stage(name)`:

```
backgroundDust → projection → explicitEdges → anchorEdges → proximityEdges → depthSort → nodeDraw → labelDraw
```

These stage names are mirrored in `STAGE_NAMES` in `graphPerf.js`. **If you add, remove, or rename a render stage in `App.jsx`, update `STAGE_NAMES` to match**, or perf reporting silently drifts.

### Cross-cutting conventions to respect

- **Test/observability hooks on `window`.** In DEV (or when perf is enabled), `exposeGraphTestState` publishes `window.__COZY_GRAPH_TEST_STATE__` (node ids, screen positions, rotation). The E2E and perf tests read node coordinates from this global to drive canvas clicks/drags — if you change its shape, those tests break.
- **Formations** ("Design" default, "Engineering", "Product") are three distinct layout branches inside `makeNode` in `App.jsx`. Adding a formation means adding both a `formations` entry (`graphData.js`) and a layout branch.
- **Never put `formation` in the render `useEffect`'s dependency array.** The Three.js scene (renderer, geometry, ~20 canvas textures, shaders) is expensive to build, so a formation change must not tear it down. `formation` is kept in a ref (written during render) and a separate small effect calls `retarget()` to move node targets in place; the render loop then eases nodes to the new layout. Reintroducing `formation` as a dep brings back a ~32ms formation-switch frame spike (the e2e `switching formation…` test and the perf `formation-switch` budget guard this).
- **Proximity edges** use a spatial grid (`buildProximityGrid`) plus a precomputed eligibility matrix (`makeProximityEligibility`) instead of all-pairs scanning — this is a hot path that has been optimized across several iterations. Preserve the grid/eligibility approach when touching it; the perf budgets in `test/perf/graphPerf.test.mjs` enforce it.
- **Scale profiles** (`baseline` 54 / `medium` 150 / `stress` 300 / `overload` 600 nodes) are selected via `?scale=` and only honored when perf is enabled. Used to stress-test the render path.

## Working agreement

`AGENTS.md` is the project's standing instruction file. Key points: bias toward caution, build only what's requested (no speculative abstraction), make surgical changes that touch only required files, and for visual/frontend work verify with `npm run build` plus browser screenshots. The `design-qa.md` file is a QA/fidelity log against the original cozy.im design — useful background, not a spec to re-run.
