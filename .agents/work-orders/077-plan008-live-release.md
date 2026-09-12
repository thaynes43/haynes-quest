# WO077: PLAN008 release and hosted verification

Status: application merged; exact-image publication and private rollout pending, September 12, 2026. Root Astra max owns final release review. Source fixes and local acceptance are WO076; this work order closes the scoped deployment.

Application PR37 merged as `c5696e3b884059040bcf67d225697139979a3551` after final head `9ae5c8d05b535681eefee6dbf6ff1925784a8c94` passed application/database verification, documentation and container checks. The merge tree exactly matches the tested head. Main Application run `34705837653` and Documentation run `34705837648` must complete before resolving and pinning its registry image.

Local client `index-DGbCshsH.js` is 1,046,627 bytes, SHA256 `999cb163fc55304ced6f2f244d1b0dab8584d1c143ab0e62ee3a9f5c08535982`. The full route, touch smoke, scrolled Help sound failure/retry/repeat, held-wand landscape checks and catalog pass; 378 tests pass locally and 10 dedicated Postgres cases are exercised in CI. Separate API verification passes 53 assertions including ephemeral fresh starts, both chapter entries and all six exact fictional SVG bytes. The v004 local evidence records scope and limitations.

No PLAN008 deployment, registry publication, hosted behavior or physical speaker result is claimed at this checkpoint. Normal Quest, routing, policy and dev-env invariants remain required. Physical Safari and listening require device inspection; no host dependency or dev-env change is part of this release.
