# PLAN-006: Touch combat, sound, friendly encounters and Operation Besties

- **Status:** Completed September 12, 2026; physical-device, listening and exact-art review remain separate.
- **Lead:** Astra max, `/home/dev/work/quest-playtest-feedback`, branch `agent/quest-playtest-feedback`, base `698c9c7`.
- **Owner feedback:** Real iPad/iPhone touch playtest became stuck at age four in the second chapter: the wand did not appear to work, enemies did not visibly attack, and the final dragon paced away. The game was silent and sparse. Tom requests combat repair, sounds, more foliage, Operation Besties, and the six existing creature assets as beneficial friendly characters whose harm carries a penalty.
- **Read with:** TEAM, DESIGN010/011/012, WO036, current handoff and the mandatory catalog maintenance procedure in docs/PROCESS.md.

## Required delivery

1. Reproduce the touch combat failures and correct targeting, attack feedback and enemy behavior based on actual findings. A child should understand how to use the wand, see hits and retaliation, and finish chapter two without test-only state edits.
2. Add gentle game sounds with first-gesture unlock, a functioning mute/volume choice and sensible pause/background behavior. Reuse existing audition assets when appropriate; record actual listening/technical limits and candidate integration honestly.
3. Enrich the world using existing tree/stone/world assets and inexpensive decorative foliage. Preserve readable paths, safe landing areas and mobile performance; visual clutter must not hide hazards or actors.
4. Adopt all six existing creature assets as friendly characters. They provide useful optional bonuses, can be harmed/defeated non-graphically, and impose a visible, recoverable penalty for doing so. No loss of recovered memories, age or earned equipment; friendly interactions must never block the campaign. Avoid accidental hostile auto-targeting of friends. Root ratifies durable action/state details before implementation.
5. Execute Operation Besties using the agreed alternating obby tricks and shared recovery window. Verify public Roblox-persona references and prepare one joint visual concept, respecting the earlier request to collaborate on appearance before expensive modeling. The new instruction authorizes progressing this feature; do not resume unrelated Nap/Diva/FNAF production. Each Blender task is fresh Astra max with an exclusive scene lease.
6. Update current catalog and documentation to present the six creatures as intentional friendly roles and remove mistake/rejected-enemy framing. Describe their current purpose positively; preserve exact artifact provenance and real decision history without asserting invented earlier approvals. Every changed/new asset has matching inspiration, model/audio preview, inventory and thumbnail navigation under the same-PR rule.
7. Test meaningful combat, friendly reward/penalty and save compatibility cases, actual touch journeys including the second boss, sound unlock/mute and desktop/phone catalog. Carry checked application and GitOps PRs through merge, isolated playtest release and live verification. Preserve existing saves and the normal demo. Do not restart dev-env or begin OAuth/family-photo setup.

## Initial lanes and ownership (historical)

- Native Sol `combat_feedback`: inspect/fix `src/game` combat/runtime targeting and meaningful tests, WO049; no UI copy or shared contracts without coordination.
- Native Sol `audio_feedback`: isolated browser audio module and focused tests, existing cue inventory, WO050; root owns event/UI wiring and direction.
- Native Sol `friendly_contract`: read-only persistence/asset audit; implementation awaits root contract ratification.
- Root: architecture, UI/copy, foliage composition, friendly/Besties design and integration, catalog writing, final verification/release.

No browser or authoring lease is held at plan creation. At plan creation, the legacy deployed review was b15bc98 at digest d7eddba and code main contained documentation-only PR31/32. The real user feedback supersedes earlier claims that automated playthroughs establish physical-touch quality.

## Delivery evidence

[WO057](../../work-orders/057-plan006-integration.md) records the integrated source, reviewed release and final live evidence. Application PR33 merged as `d932b484a32d80e4cf3ad2ece1e99d3620d4c55c`; operations PR2860 merged as `eed48853ae6d96c30f3f75515d7e81d20a0005f2`. The isolated playtest runs the published image digest `sha256:582737215e73ab34dc22445feac16f1773c20b91c27b4f82f3fdcec3ec077a27`. All 294 tests passed, including ten real PostgreSQL cases. Independent Fable review findings are resolved in WO061.

| Requirement        | Delivered evidence                                                                                                                                                                                                                                                                                            |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Touch combat       | Final focused browser run proves held-stick wand damage, visible feedback and nearby dragon retaliation; regression tests cover both arena-edge stalls.                                                                                                                                                       |
| Sound              | Four existing cues have gesture unlock, mute/volume, pause/background handling and bounded playback. Actual AudioContext/output controls passed; listening remains owner review.                                                                                                                              |
| World              | Existing trees, flowers and grass enrich both chapters while preserving paths and landing areas; the guide uses actual game captures.                                                                                                                                                                         |
| Friendly residents | All six models provide optional healing, explicit harm/defeat, recoverable penalties and making amends. Friendly targeting, owner/revision/idempotency/transaction behavior and save/reload are verified.                                                                                                     |
| Besties            | Tom approved the joint pink/black look; two eight-clip models implement alternating tricks, a missed high-five and shared dizzy opening. New compatible v3 journeys use the duo; old cast identities are preserved.                                                                                           |
| Catalog            | 36 entries, 53 thumbnails, 26 exact model deliveries, 27 review pages and inspiration/animation/audio review. Desktop/phone hosted checks passed with no unexpected delivery errors. The same-PR maintenance rule is mandatory.                                                                               |
| Release            | Checked application/image and image-only GitOps PRs merged. All 19 live infrastructure/isolation checks passed; normal demo and dev-env identities/restarts remain unchanged. Retained v2 save resumed successfully; a fresh v3 touch journey reached age four/Besties and saved/reopened on the final build. |

## Remaining review and future scope

Physical iPhone/iPad Safari touch/performance, listening and exact final model/audio approval remain owner review. They are not claimed by Chromium emulation or software audio checks. OAuth, real-photo access, parent/admin journey curation and the larger lifetime campaign remain separate future work under DESIGN012 and BL06. No new Nap/Diva/FNAF production, real-family-photo import or dev-env restart occurred. The shared Besties concept approval does not assert approval of the exported models.
