# auto-iter-7 Performance Plan

## Baseline
- Previous accepted report: `perf-results/graph-perf-2026-06-05T06-35-41-216Z.json`
- Previous failed experiment: `auto-iter-6` tried reusable proximity grid storage and was not merged.
- Target scenario: `desktop-overload-idle`
- Current bottleneck: `proximityEdges` p95 `1.0ms`.

## Optimization Target
Reduce hidden proximity traversal work while preserving the same rendered edge set:
- Node click card behavior must remain unchanged.
- Drag must remain 3D rotation.
- Proximity radius, eligibility rules, edge alpha, and edge geometry remain unchanged.

## Plan
- Keep the current grid cell size and 3x3 neighborhood.
- Build a list of occupied cells while constructing the proximity grid.
- Traverse each occupied cell pair only once, instead of visiting reverse cell pairs and skipping by node index.
- Keep `proximityChecks` counting unique candidate node pairs so perf reports remain comparable.

## Verification
- Run `npm test`.
- Run `npm run build`.
- Run `npm run test:e2e`.
- Run `npm run test:perf`.
- Significant improvement threshold: at least 5% improvement in `desktop-overload-idle` `proximityEdges` p95 or frame p95 versus `06-35-41`.
