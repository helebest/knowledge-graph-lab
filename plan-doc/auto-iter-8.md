# auto-iter-8 Performance Plan

## Baseline
- Previous accepted report: `perf-results/graph-perf-2026-06-05T06-44-02-887Z.json`
- Target scenario: `desktop-overload-idle`
- Current bottleneck: `proximityEdges` p95 `0.8ms`, followed by `backgroundDust` p95 `0.4ms`.

## Optimization Target
Reduce proximity candidate math while preserving the exact same rendered edge set:
- Node click card behavior must remain unchanged.
- Drag must remain 3D rotation.
- Proximity radius, eligibility rules, edge alpha, and edge geometry remain unchanged.

## Plan
- Keep the cell-pair traversal from iter 7.
- Check the precomputed proximity eligibility matrix before distance math.
- Skip `dx`, `dy`, `Math.abs`, and squared-distance work for ineligible candidate pairs.
- Keep `proximityChecks` counting all unique candidate pairs so reports remain comparable.

## Verification
- Run `npm test`.
- Run `npm run build`.
- Run `npm run test:e2e`.
- Run `npm run test:perf`.
- Significant improvement threshold: at least 5% improvement in `desktop-overload-idle` `proximityEdges` p95 or frame p95 versus `06-44-02`.
