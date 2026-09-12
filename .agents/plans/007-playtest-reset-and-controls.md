# PLAN007: Fresh playtests, direct controls and route memories

Status: active, September 12, 2026. Lead Astra max in `/home/dev/work/quest-playtest-reset`, base `ed7ae72963d9d9902cb42f1fec545d15e659fe25`.

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

Design contract: [DESIGN015](../../docs/designs/015-fresh-playtest-controls.md).

## Lanes

WO062: separate Fable5.1 xhigh mobile UX research and diagnosis, reporting through its own worktree/PVC. Native Sol lanes: isolated ephemeral session backend (WO063), memory/progression contracts (WO064), sound investigation/module fixes (WO065). Root owns architecture, UI/copy, input/runtime integration, visual design/foliage, review, documentation and delivery. Scope shared-file ownership explicitly before implementation.
