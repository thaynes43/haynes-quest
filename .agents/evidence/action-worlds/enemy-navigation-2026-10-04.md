# Enemy navigation cost in the dense family worlds (2026-10-04)

Measured source: `e1cdd7a` (the source includes `src/game/enemy-navigation.ts` and the frozen slab fix). Node `v24.21.0` with `tsx`, on the shared dev pod. This is elapsed process time from `performance.now()`, not a browser frame-time or physical-device measurement. Concurrent pod work and JIT/GC can change individual samples.

For each A8/B7 chapter, resolve its checked-in authored course and construct `EnemyGroundNavigation` once. Query from `ordinary-1` to its same-deck pair `ordinary-5`, then to `ordinary-2` in the next encounter region. Warm each query 200 times; time 1,000 calls individually; report milliseconds per call. The same-deck query finds a route in all seven chapters; the next-region query correctly returns `null` because those decks are disconnected for ground pursuit.

| Chapter | Course platforms | Same-deck mean / p95 ms | Next-region mean / p95 ms |
| --- | ---: | ---: | ---: |
| A1 | 51 | 0.0174 / 0.0178 | 0.0021 / 0.0021 |
| A2 | 42 | 0.0187 / 0.0193 | 0.0019 / 0.0019 |
| A3 | 50 | 0.0183 / 0.0187 | 0.0022 / 0.0020 |
| A4 | 45 | 0.0218 / 0.0219 | 0.0016 / 0.0017 |
| B1 | 35 | 0.0115 / 0.0117 | 0.0016 / 0.0016 |
| B2 | 34 | 0.0137 / 0.0135 | 0.0328 / 0.0326 |
| B3 | 41 | 0.0194 / 0.0192 | 0.0016 / 0.0017 |

`EnemySimulation.sync()` constructs a graph when a save is applied (`src/game/createGame.ts` `applySave`); it does not run every frame. A per-frame ordinary calls `next()` only when its phase and leash range require a ground route. The 2.5 cm segment sampling still protects seams and gaps. These measured courses contain 34–51 platforms, not approximately 200; this evidence does not justify a new cache or geometry shortcut for the current release.
