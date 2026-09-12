# WO062 results: Fable 5.1 mobile-controls research and review

- **Status:** CHECKPOINT (in progress). Observations recorded; source list and layout recommendation follow in the next revision of this file.
- **Model / dispatch:** `claude-fable-5-1`, effort `xhigh`, via `agent-run` (task `haynes-quest-0911-204632`). Research fan-out to three native Opus 5 subagents (Apple/WebKit sources, Roblox/accessibility sources, code diagnosis); Fable owns the recommendations.
- **Worktree / branch / base:** `/home/dev/work/haynes-quest-0911-204632`, `agent/haynes-quest-0911-204632`, from `origin/main` `ed7ae72`.
- **Scope kept:** no game source, cluster, asset, lead-tree or deployed-data change; no PR; no Blender/audio generation; no paid API keys.
- **Browser lease:** HELD by this task (Playwright MCP, shared cluster Chromium) until the final revision of this file says released.
- **Evidence (ignored paths):** `test-results/wo062/*.png` screenshots of the live fixture; subagent reports under `/tmp/wo062-*/report.md`.

## Live fixture observed (Chromium 153 headless, SwiftShader, no touch emulation)

Bundle under test: `assets/index-D3lvcZ1s.js` (matches the HANDOFF hash name). Fresh session, new Demo Adventurer journey, all three fictional pictures, chapter one, age 0.

| Viewport (CSS px) | Joystick | Action cluster (2x2 grid) | Per-button | Header buttons |
| --- | --- | --- | --- | --- |
| 390x844 phone portrait | 116 at (17,683) | 131x131 at (242,668) | 62x62, label 9px | 37x37 (Mute, Memories, Help); Save & leave 42x37 |
| 844x390 phone landscape | 99 (scaled 0.85) at (25,266) | 109x109 at (710,256) | 52x52, label 8px | 43x43 |
| 1180x820 iPad landscape | 116 at (25,659) | 149x149 at (1006,626) | 70x70, label 10px | 43x43 |
| 820x1180 iPad portrait | 116 at (25,1019) | 149x149 at (646,986) | 70x70 | 43x43 |

All four action buttons (Guard, Jump, Attack, Remember) render disabled at age 0 before the mallet is found. Headless SwiftShader frame timing during the sample was ~7.5 fps (median 133 ms); this number is not device evidence, it only shows the delta-clamp mechanism described below is reachable.

Cue files fetch live with `redirect: "error"`: `/studio/assets/media/ui-confirmed/v001/cue.wav` and `/studio/assets/media/movement-landed/v001/cue.wav` both return 200 `audio/wav`, not redirected. No `quest-audio` preference stored in a fresh session. Console: only a favicon 404 and WebGL ReadPixels performance warnings.

## Code-confirmed facts (HEAD ed7ae72)

- `src/game/input.ts` `bindBrowserInput`: a touch `pointerdown` on the left half of the canvas is ignored; on the right half it becomes a camera-drag pointer immediately. There is no tap-versus-drag distinction and no world-tap jump path.
- `src/client/GameScreen.tsx`: Jump button is disabled until `save.abilities` contains `jump`; Space is only honoured through the same `canJump` gate in `createGame.ts`.
- `src/game/controller.ts` and `src/game/createGame.ts` clamp the simulation step to 0.05 s; below 20 fps the world runs in slow motion (30 fps: 1.0x, 20 fps: 1.0x, 15 fps: 0.75x, 10 fps: 0.5x).
- `src/client/GameScreen.tsx`: audio `start()` is wired to pointerdown, pointerup, touchend, click and keydown in capture phase; `activeModal === "artwork-update"` comes from `status.mediaReloadRequired`, produced in `src/game/scene.ts` when `unsupportedContentCount > 0`.

## Pending in the next revision

Primary-source list with links; one portrait+landscape layout; target sizes and safe areas; tap-vs-drag rule; simultaneous stick+action rules; primary/secondary mappings; feedback/animation; no forced save/leave flow; diagnosis of the artwork gate and inaudible sound; browser lease release.
