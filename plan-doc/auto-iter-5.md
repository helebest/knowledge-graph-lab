# auto-iter-5 Performance Plan

## Baseline
- Previous accepted report: `perf-results/graph-perf-2026-06-05T06-31-54-098Z.json`
- Target scenario: `desktop-overload-idle`
- Current bottleneck: `nodeDraw` p95 `0.5ms`, after `proximityEdges` p95 `1.0ms`.

## Optimization Target
Reduce node drawing overhead without changing interaction or visible geometry:
- Node click card behavior must remain unchanged.
- Drag must remain 3D rotation.
- Node radius, halo, highlight, depth fade, and draw order remain unchanged.

## Plan
- Replace per-node dynamic `rgba(...)` string construction with fixed colors plus `globalAlpha`.
- Keep the same alpha math and fill order.
- Reset Canvas alpha after each node draw.

## Verification
- Run `npm test`.
- Run `npm run build`.
- Run `npm run test:e2e`.
- Run `npm run test:perf`.
- Significant improvement threshold: at least 5% improvement in `desktop-overload-idle` `nodeDraw` p95 or frame p95 versus `06-31-54`.
