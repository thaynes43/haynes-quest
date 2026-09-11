# WO-026: Equipment game intake browser audit

- **Status:** Complete; browser intake passed and ready for coordinator review
- **Model / dispatch:** Native GPT-5.6 Sol, `xhigh`, fresh context
- **Worktree / branch / base:** `/home/dev/work/quest-equipment-game-intake`; `agent/quest-equipment-game-intake`; `769b3d557e3b8a0ec2b82523eeae305e14fcc931`
- **Source under test:** Root-owned local fixture harness at `http://127.0.0.1:4390`; fixture memory backend and site catalog; hosted bundle `index-D5ZBrG7T.js`
- **Owned paths:** This work order and ignored `test-results/` evidence only; a bounded existing-test correction is allowed only if a demonstrated test defect blocks the audit
- **Excluded scope:** Root sources, server, UI, copy, assets, game commands, Blender, real photos, authentication, database, deployment, pull request, art selection and final game acceptance

## Outcome and scope

Run the existing browser journeys sequentially in independent browser contexts: keyboard, touch and media. Verify the current reusable gear/media intake through both era transitions, including retained inventory, upgraded equipment, actual traveler/environment/equipment model delivery, and absence of unexpected texture/bitmap errors. Capture safe current-game evidence for the coordinator's art judgment, including infant equipment, retained and upgraded child equipment, and combat poses where practical.

The six authored creature studies remain rejected as enemies and are not an acceptance target. Enemies in this fixture may remain procedural. Obby/controller work is a separate active lane, so this audit does not establish obby acceptance or final game acceptance. Visual findings must be limited to evidenced clipping or intersection; all art judgment remains with the coordinator.

## Deliverables and verification

Record the exact served bundle, commands, browser/runtime results, model requests or scene inspection evidence, inventory state through both transitions, unexpected console/page/request failures, safe screenshot paths, and the limits of browser emulation. Do not expose private data, credentials, save identifiers or query strings.

## Result

The existing keyboard, touch and media scripts passed sequentially in separate Chromium processes against the stable root fixture. Chromium was `153.0.8010.12`; keyboard used a 1440 × 1000 viewport, touch used an emulated 844 × 390 mobile viewport, and both runs also checked the 390 × 844 home view for horizontal overflow.

- Keyboard completed both era battles through UI controls, including equipment collection, attack, guard, boss gating, memory reveal, `0 → 4 → 7` age progression, and save/leave/resume. Its forced same-origin memory-art failure displayed recovery states and recovered through retry. Page errors were empty.
- Touch completed both eras with emulated touch joystick movement, equipment use, attack, guard, jump and pointer cancellation. Page errors were empty.
- Media decoded all three preview images; issued nine fixture actions to release the first bundle; delivered two released images through both scene canvases and saved-game `<img>` elements; observed two canvas texture uploads; performed four automatic scene retries, one manual image retry and one coalesced avatar retry. The script classified its eight deliberately injected request failures and eleven associated/Three.js console messages as expected. Its `unexpected` array was empty.

The exact served JavaScript was `/assets/index-D5ZBrG7T.js`, 968,518 bytes with SHA-256 `5f71c2f50878abbdce94bcaa519c27a4dd840e146eca32bcc5d2f684e341ef80`. A separate evidence context observed these actual game model responses; every response was HTTP 200 with `model/gltf-binary` and nonzero bytes:

| Model            | Response bytes |
| ---------------- | -------------: |
| Traveler infant  |        448,656 |
| Traveler child   |        460,616 |
| Clearing tree    |         71,316 |
| Clearing stone   |         41,284 |
| Path tile        |         30,084 |
| Memory keepsake  |        116,304 |
| Arrival landmark |        118,348 |
| Spark mallet     |        161,872 |
| Acorn shield     |        184,460 |
| Prism wand       |        143,444 |
| Ribbon shield    |        197,244 |

The React game-handle inspection reported `mediaLoading: 0` and `mediaFailed: 0` at infant start, infant equipped, child with retained equipment, and child with upgraded equipment. No media warning was visible. The evidence context had zero unexpected page errors, console warnings/errors or failed requests. Its only console entries were four known Three.js `PCFSoftShadowMap` removal notices, one for each deliberately reopened renderer. There was no texture or `ImageBitmap` warning/error. The bundle has no GLB reference for Blockling, Signal Moth, Buffer Baron, Loop Dancer, Prism Mimic or Trendweaver; the visible encounters remained procedural runtime studies.

The inventory was the equipped tier-1 attack tool plus tier-1 guard tool at age zero. The exact pair remained after the first level completed and the child/2024 level loaded. After collecting the second-level pair, all four records remained, the tier-2 attack tool became equipped, and the stronger tier-2 guard tool was available. The same four-record inventory and equipped tier-2 attack tool remained after the second level completed at age seven.

Seven 1440 × 1000 safe fixture screenshots are retained under `/home/dev/work/quest-equipment-game-intake/test-results/equipment-intake/`:

- `infant-mallet-acorn-idle.png`
- `infant-mallet-acorn-guard.png`
- `infant-mallet-acorn-attack.png`
- `child-retained-mallet-acorn.png`
- `child-wand-ribbon-idle.png`
- `child-wand-ribbon-guard.png`
- `child-wand-ribbon-attack.png`

All four equipment models are visibly carried by the requested traveler stage in those views. Visual inspection found no clear, reproducible body/tool clipping or intersection. The close-range attack views contain ordinary weapon, traveler and enemy occlusion and are not a scene-graph parenting measurement. Art judgment remains with the coordinator.

Commands, run in this order:

```bash
QUEST_E2E_URL=http://127.0.0.1:4390 QUEST_E2E_MODE=keyboard QUEST_E2E_STORAGE='fixture memory harness' node tests/e2e/journey.mjs
QUEST_E2E_URL=http://127.0.0.1:4390 QUEST_E2E_MODE=touch QUEST_E2E_STORAGE='fixture memory harness' node tests/e2e/journey.mjs
QUEST_E2E_URL=http://127.0.0.1:4390 node tests/e2e/media.mjs
QUEST_E2E_URL=http://127.0.0.1:4390 node test-results/equipment-intake/capture.mjs
```

The compact ignored evidence report is `/home/dev/work/quest-equipment-game-intake/test-results/equipment-intake/report.json`, 5,906 bytes with SHA-256 `e13e4d048689298cd013ceae61196058d729cb47b7aa7c5143ec29fffc36fc6a`. It contains public asset paths and summarized fixture inventory only; it excludes save IDs and private inputs.

## Handoff and recovery

This is reusable equipment/media intake, not final game acceptance. The six authored creature studies were not integrated or accepted as enemies. Obby/controller work was outside this audit. Browser touch emulation is not physical iPhone/iPad Safari evidence, and SwiftShader is not device GPU or performance certification. The visual staging pass used direct same-origin fixture actions to reach exact inventory checkpoints; keyboard and touch play claims come only from the separate unmodified journey runs. No source, test, server, UI, copy, asset, game-command, Blender, real-photo, authentication, database, deployment or pull-request change was made. The temporary dependency link was removed after verification; the root fixture was left running and untouched.
