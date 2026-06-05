# auto-iter-1 Performance Plan

## Baseline
- Previous report: `perf-results/graph-perf-2026-06-05T05-51-36-423Z.json`
- Target scenario: `desktop-overload-idle`
- Current bottleneck: `proximityEdges` p95 `1.8ms`, with p95 `47524` candidate checks and p95 `5228` drawn ambient edges.

## Optimization Target
Reduce proximity edge draw overhead without changing graph interaction:
- Node click card behavior must remain unchanged.
- Drag must remain 3D rotation.
- The same proximity candidate logic should decide which ambient edges exist.

## Plan
- Keep the spatial grid candidate pass.
- Batch non-dashed proximity line segments into one Canvas path instead of calling `beginPath/stroke` per edge.
- Reuse the existing color, alpha, distance threshold, and hash filter.
- Preserve the performance counters for candidate checks and drawn edges.

## Verification
- Run `npm test`.
- Run `npm run build`.
- Run `npm run test:e2e` to prove current interactions are unchanged.
- Run `npm run test:perf` and compare with the previous report.
- Significant improvement threshold for this self-iteration: at least 5% p95 improvement in the targeted `proximityEdges` or frame p95 metric.
