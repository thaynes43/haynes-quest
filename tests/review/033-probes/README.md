# WO-033 review probes

Numeric reproductions behind the findings in
`.agents/work-orders/033-parody-obby-review-results.md`. They are plain scripts, not
vitest cases, so they never gate CI; run one with

```bash
node_modules/.bin/tsx tests/review/033-probes/<name>.ts
```

| Probe | Shows |
| --- | --- |
| `coverage-by-birth-date.ts` | Level 1's parody period is keyed by the birth date, so a child born before 2020 is refused even when every photo is inside the curated windows (R-1). |
| `catalog-coupling.ts` | A stored v2 plan is re-checked against the live catalog table and version constant on every read, so any in-place catalog edit or version bump answers 503 for existing saves (R-4). |
| `checkpoint-arming.ts` | On `gentle-jump-v1` only lanes within 0.65 m of the centre line arm `first-clearing`; a wider lane that misses gap 2 is returned to the very start (R-6). |
| `reward-checkpoint-rearm.ts` | After boss defeat the reward checkpoint (z -23.5) is silently replaced by `boss-landing` (z -19) when the player walks back north (R-7). |
