# Three.js Renderer Experiment

## Goal
Try a Three.js renderer on a separate branch while preserving the current graph interaction contract:
- Clicking a node opens the detail card.
- Dragging rotates the graph in 3D.
- Existing perf and E2E hooks keep working through `canvas.graph-canvas`, `window.__COZY_GRAPH_TEST_STATE__`, and `window.__COZY_GRAPH_PERF__`.

## Implementation
- Replaced the Canvas 2D graph render loop with a Three.js `WebGLRenderer` mounted on the same canvas element.
- Rendered nodes with `InstancedMesh`, dust with `Points`, labels with `Sprite` textures, and graph edges with dynamic `LineSegments` buffers.
- Kept the existing graph data, formation generation, drag rotation, hit testing, card UI, and perf collector.
- Kept proximity edge selection on the existing screen-space grid so ambient edge counts remain comparable to the Canvas version.

## Verification
- `npm test`: passed.
- `npm run build`: passed, with a Vite chunk-size warning because Three.js increases the main bundle.
- `npm run test:e2e`: passed.
- `npm run test:perf`: passed.
- Visual QA: desktop and mobile screenshots saved under `perf-results/three-desktop.png` and `perf-results/three-mobile.png`; WebGL canvas context and drag movement checks passed.

## Performance Result
Compared against Canvas report `perf-results/graph-perf-2026-06-05T06-46-58-488Z.json`.

Final Three.js report: `perf-results/graph-perf-2026-06-05T07-31-04-067Z.json`.

Key results:
- `desktop-overload-idle` frame p95: `1.6ms -> 1.3ms`.
- `desktop-overload-idle` frame p99: `1.7ms -> 1.4ms`.
- `desktop-stress-idle` frame p95: `0.8ms -> 0.7ms`.
- `desktop-baseline-drag` frame p95: `0.6ms -> 0.4ms`.
- `desktop-baseline-click-card` click p95: `0.8ms -> 0.7ms`.

## Tradeoff
The main bundle increased from roughly `229KB` minified to roughly `746KB` minified. This branch is performance-viable, but shipping it should account for the larger initial JS payload or add code splitting.

## Billboard Node Follow-up
- Replaced low-segment `SphereGeometry(1, 8, 6)` nodes with instanced `PlaneGeometry` circle billboards.
- Added canvas-generated circle alpha textures for node discs and soft halo discs.
- Applied the inverse graph rotation to node instance matrices so discs keep facing the camera while the graph rotates in 3D.
- Visual QA screenshots: `perf-results/three-billboard-desktop.png` and `perf-results/three-billboard-mobile.png`.
- Verification after the change: `npm test`, `npm run build`, `npm run test:e2e`, and `npm run test:perf` passed.
- Perf report: `perf-results/graph-perf-2026-06-05T07-44-41-700Z.json`.

Compared with the Canvas mainline report `06-46-58`, the billboard version still improves `desktop-overload-idle` frame p95 (`1.6ms -> 1.4ms`) and keeps dropped frame ratio at `0`, but this single run regressed overload frame p99 (`1.7ms -> 1.9ms`) and click-card p95 (`0.8ms -> 1.0ms`). Treat it as visually fixed but not yet a strict no-regression merge candidate.
