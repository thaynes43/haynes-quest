# PLAN007: Fresh playtests, direct controls and route memories

Status: completed for the private playtest, September 12, 2026; physical-device feel, listening and final-art review remain owner inspection. Lead Astra max in `/home/dev/work/quest-playtest-reset`, base `ed7ae72963d9d9902cb42f1fec545d15e659fe25`.

Tom's actual iPad/iPhone feedback supersedes prior automated acceptance: the artwork-update/save/resume loop blocks Besties, grass is not apparent, sound is inaudible, controls are confusing and movement/actions feel sluggish. Do not treat PLAN006's passing tests as evidence these complaints are resolved.

## Required outcome

- Disable persistent progress and save/resume UI for the isolated playtest. Each new test starts fresh; existing persisted records are left alone. Fix the underlying artwork gate/loading failure so the complete route remains playable without saving/leaving.
- Jump is a baseline action at every age, including zero. Space jumps on keyboard; a deliberate world tap jumps on touch. Joystick, menu and attack contacts must not trigger unintended jumps; dragging the camera is distinct from tapping.
- Walking into equipment, memories and friendly interactions triggers appropriate behavior. Remove dedicated jump/interact/remember buttons. Minor pickups must not repeatedly reopen dialogs or block movement.
- A large labeled Attack action and smaller Secondary action offset above/right form the touch action cluster. Replace blocking with a useful second attack using current equipment; dual-wield/combination content is future extensibility, not new asset production.
- Improve motion response and visible attack/interaction animation with existing assets and runtime animation. Make real grass visible in the traveled scene and make sound perceptible on the actual mobile browser path. Distinguish audibility from merely observing an AudioContext.
- Each chapter has three memories: two minor pickups along the route, then a major memory after the boss. Minor memories do not age the player; the post-boss major completes the chapter and advances age. Photo category curation is later; use six distinct fictional pictures for the two test chapters.
- Fable5.1 researches mobile game controls from primary sources and proposes a minimal layout. Lead ratifies the design. No new Blender/image/audio generation, OAuth, private photos, normal-demo changes or dev-env restart.
- Validate actual full routes, touch control conflicts, WebKit where available, fresh reload behavior, missing-art recovery, audio output and visible foliage. Keep the catalog/guide synchronized. Carry checked app and scoped GitOps PRs through merge and private deployment, then verify the hosted result. Clearly state physical-device limits.

Design contract: [DESIGN015](../../../docs/designs/015-fresh-playtest-controls.md).

## Lanes

WO062: separate Fable5.1 xhigh mobile UX research and diagnosis, reporting through its own worktree/PVC. Native Sol lanes: isolated ephemeral session backend (WO063), memory/progression contracts (WO064), sound investigation/module fixes (WO065). Root owns architecture, UI/copy, input/runtime integration, visual design/foliage, review, documentation and delivery. Scope shared-file ownership explicitly before implementation.

## Delivered and verified

Application [PR35](https://github.com/thaynes43/haynes-quest/pull/35) merged as `b66b8ee2723480c6c1e0226af9018109489a1817`; operations [PR2862](https://github.com/thaynes43/haynes-ops/pull/2862) merged as `6b39ea6cb74880be0e274a5501ad5c067bab8d93`. The private host runs the independently matched published image digest `eb685f46f8682e2b73505e02e0a52e738879d4c142b42c6af83fe7d2ec858cdc`, with ephemeral playtest mode enabled. All 350 application tests and all nine operations checks passed.

The fresh route completed age 0 → 4 → 7 with two minors before each boss and a major afterward, using keyboard movement and touch combat. Separate real touch checks prove held-stick jumping, wand damage, cancellation, fresh reloads, sound output/mute/volume and portrait/landscape controls. The hosted image repeated the controls, Besties shortcut/held wand, exact Pink fallback/retry, six fictional image delivery and desktop/phone catalog checks. The full boss route was verified locally on the exact same client; it was not replayed in full on the hosted release.

The catalog contains 37 entries, 54 thumbnails and 26 exact model deliveries. New fixture illustrations, revised audio-use notes and actual game captures are in the same application release. All 23 live rollout/isolation checks passed. Normal Quest and dev-env retained their original UIDs/images and zero restart counts. Activity `act-033848-289886` ended, owned fixture 4397 stopped, unrelated 4392 stayed untouched, and all browser/authoring leases are released.

[WO070](../../work-orders/070-plan007-live-release.md) records release evidence and limits. SwiftShader measured 9–10 fps; physical iPhone/iPad Safari performance and speaker audibility remain unverified. Cached WebKit lacks required host libraries. Exact final artwork/audio review, OAuth, real photos, parent curation and the lifetime campaign remain separate owner inspection/backlog work. No new model/audio generation or dev-env restart occurred.
