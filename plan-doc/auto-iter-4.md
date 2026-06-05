# auto-iter-4 Performance Plan

## Baseline
- Previous accepted report: `perf-results/graph-perf-2026-06-05T06-28-09-880Z.json`
- Target scenario: `desktop-overload-idle`
- Current bottleneck: `proximityEdges` p95 `1.2ms`.

## Optimization Target
Reduce overhead inside proximity grid traversal without changing interaction or edge selection:
- Node click card behavior must remain unchanged.
- Drag must remain 3D rotation.
- Existing proximity radius, grid size, and eligibility matrix stay unchanged.

## Plan
- Replace string grid keys like `"x:y"` with numeric cell keys.
- Keep the same buckets and neighbor scan range.
- Preserve candidate checks, drawn edge counters, and batched path rendering.

## Verification
- Run `npm test`.
- Run `npm run build`.
- Run `npm run test:e2e`.
- Run `npm run test:perf`.
- Significant improvement threshold: at least 5% improvement in target `desktop-overload-idle` `proximityEdges` p95 or frame p95 versus `06-28-09`.
