# auto-iter-3 Performance Plan

## Baseline
- Last accepted report: `perf-results/graph-perf-2026-06-05T06-19-37-165Z.json`
- Previous experimental report: `perf-results/graph-perf-2026-06-05T06-23-44-768Z.json`
- Target scenario: `desktop-overload-idle`
- Current accepted bottleneck: `proximityEdges` p95 `1.5ms`, with p95 `47524` candidate checks and p95 `5228` drawn ambient edges.

## Optimization Target
Reduce per-candidate CPU work in proximity edge selection without changing interaction:
- Node click card behavior must remain unchanged.
- Drag must remain 3D rotation.
- Edge eligibility must use the same deterministic hash rule as before.

## Plan
- Keep the accepted grid size from `main`.
- Precompute the deterministic proximity hash eligibility matrix for each scale profile.
- Replace per-frame `hash01(one.index * 17 + two.index * 23)` calls with a typed-array lookup.
- Preserve distance filtering, edge counts, and batched stroke behavior.

## Verification
- Run `npm test`.
- Run `npm run build`.
- Run `npm run test:e2e`.
- Run `npm run test:perf`.
- Significant improvement threshold: at least 5% improvement over the accepted report in target `desktop-overload-idle` `proximityEdges` p95 or frame p95, without interaction regressions.
