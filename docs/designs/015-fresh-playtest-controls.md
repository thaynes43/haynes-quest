# DESIGN015: Fresh playtests and direct controls

Status: Accepted for the private PLAN007 slice, September 12, 2026. Tom's physical-device feedback is the requirement; Astra ratifies the implementation choices below. This amends DESIGN006's private reward presentation and DESIGN011's age-gated jumping. Archived journeys retain their frozen contracts.

## The player experience

Every private test begins fresh. **Play from the beginning** starts at age zero; **Try the Besties chapter** is a labeled shortcut into chapter two with the first chapter already completed. Leaving or reloading returns to the start page. There is no save list or save-and-leave flow in this mode.

The left stick moves. A deliberate tap on the world jumps at every age; dragging looks around. Space always jumps. Walking into gear or a released memory collects it. Friendly contact provides available healing without a dialog. A large **Attack** button swings the equipped tool; the smaller **Bash** button appears above/right when a shield is collected. F and Shift provide keyboard equivalents. Intentional friendly harm remains behind its explicit confirmation, outside automatic combat targeting.

Each chapter contains two minor memories along the route and a major memory beyond the boss. Minor pickups show a brief picture and keep the player moving, at the same age. The major becomes available after the boss; collecting it with both minors completes the chapter and advances age. Missing minors remain collectible after victory. Two test chapters use six fictional illustrations and progress 0 → 4 → 7. Parent-curated photo roles and the longer campaign remain DESIGN012/backlog work.

Retrying after losing all health keeps defeated enemies, gear and collected memories in a fresh playtest. Surviving enemies regain their health. A boss retry therefore keeps the route victories that unlocked it. Archived v1/v2 journeys retain their original retry contract.

## Controls and feedback

- Fixed, visible stick with a 44 CSS pixel deflection radius and an 8 pixel dead zone. Its pointer remains independent of camera and action contacts. Keeping the stick's activation area local preserves world-tap jumping on the left side too.
- A world tap travels no more than 10 pixels and lasts no more than 500 ms. Exceeding the movement threshold makes it a camera drag until release. Cancellation never jumps. UI contacts keep their own role; a held stick plus another finger's world tap is supported.
- Attack is 84–94 pixels across, Bash 60–68; header controls have at least 48 pixel targets. Safe-area insets keep controls away from device edges. Labels and a pressed state identify each action; touch users see a jump hint rather than a keyboard legend.
- Primary attacks have a 400 ms authoritative cooldown. Bash requires the collected offhand shield, reaches 2.25 m, deals 2/3 damage by tier and has a separate 1 second cooldown. It shares Besties' dizzy window. Later dual-wield and combo designs can replace this bounded secondary action.
- Local arm motion, torso follow-through and swing/spell visuals acknowledge an attack immediately, including an empty swing. Pickups use the existing interaction clip. Movement is 4 m/s with bounded simulation slices so ordinary slow rendering does not halve movement speed. Background/modal time never accumulates into catch-up damage.
- Existing grass geometry is taller and planted on the route's visible shoulders, at actual platform height. The center path, gaps, moving platform and central boss floor remain readable.

## Freshness and authority

`QUEST_EPHEMERAL_PLAYTEST=true` is allowed only with fixture development mode. Startup uses bounded expiring memory storage and does not connect to, migrate or delete Postgres data. Sessions, ownership, CSRF, revisions, action receipts and media admission still apply. The temporary store retains the newest two runs per owner and retires least-recently-used runs or sessions at its global caps. Retained runs keep their receipts and ownership checks; evicted runs have no resume promise. Referenced previews remain available for idempotent creation, and the preview cap must exceed the run cap. Save discovery returns an empty list; an active page retains its current run ID. The chapter-two shortcut advances through normal authoritative actions.

The new `era-level-plan-v3` freezes two minor IDs and one major ID per level. V1/v2 parsers and their age-based ability arrays remain valid; the default persistent plan factory still produces v2. New playtest plans always include jump and expose memory roles. A v3 major recovery consumes all three memories and advances atomically; the old bundle-consumption and guard actions remain for older contracts only.

Root HTML is `no-store`; hashed JavaScript/CSS bundles are immutable. Studio pages and media use `no-cache` so browsers revalidate them. An unknown artwork identity uses visible study geometry and a recoverable warning. It cannot disable simulation or force a save/reload loop. Missing downloads remain retryable. A stale device client is a plausible cause of Tom's artwork gate; the specific device cause has not been established.

## Sound

The four v001 WAVs remain unchanged. Their earlier gain stack produced a landing peak around −30 dBFS; source analysis also found that sound was brief and bass-heavy. The new 0.8 master, measured cue trims and midrange attack/jump/pickup variants make feedback substantially stronger. A limiter bounds overlap. The fresh preference key avoids inheriting an earlier release's mute setting; the labeled toggle and Help audition make state and output easy to check.

Web Audio starts from a real gesture, confirms unlock, survives menu transitions and suspends in the background. A celebration interrupted before playback retries from the next gesture while its panel remains open. Zero volume is displayed as sound off; enabling sound restores an audible volume. Failed source starts release their playback slots. Supported browsers use the Audio Session `playback` category. Actual speaker audibility, Safari handling and child comfort still require physical-device listening; a running AudioContext is insufficient evidence.

## Fable research and lead decisions

Fable 5.1 at xhigh completed WO062 in `agent/haynes-quest-0911-204632` (final report commit `16c5d4f`, evidence-location follow-up `bfadcd1`). It inspected the deployed client in four viewport sizes and a touch-emulated context. Source gathering and code tracing used its Opus subagents. The browser lease was released. Its report remains in that worktree; this record captures the decisions and limits without importing search-index quotations as verified text.

Astra adopts the two-button hierarchy, larger targets, safe-area anchoring, pointer ownership, local attack feedback, cue rebalance and simulation-time correction. A 4 m/s pace improves response while keeping the short-jump landings forgiving; 5 m/s overshot the earlier resting zones. The fixed local stick preserves Tom's world-tap gesture across more of the screen. Bash reuses the existing offhand asset instead of introducing new area attacks. Unknown art falls back visibly rather than triggering another automatic reload. Held auto-repeat, automatic camera follow and new haptics are deferred until the simpler controls have physical feedback.

Primary guidance: [W3C's enhanced target-size guidance](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html) gives 44 CSS pixels as the enhanced minimum and encourages larger frequent controls. [Roblox mobile input](https://create.roblox.com/docs/input/mobile) supports considering orientation and preferred input. [MDN Audio Session](https://developer.mozilla.org/en-US/docs/Web/API/Audio_Session_API) documents explicit audio categories; [WebKit issue 237322](https://bugs.webkit.org/show_bug.cgi?id=237322) records silent-switch behavior. These pages were checked by the lead. Apple's game-control page required JavaScript in the lead fetch; Fable's Apple search excerpts inform the review but are not treated as directly verified quotations.

## Verification boundary

PLAN007 requires a complete fresh route through both bosses, independent direct Besties entry, contact collection, age-zero jumping, held-stick combinations, missing-art recovery, reload reset, audible-output samples, foliage captures and responsive control measurements. Automated Chromium remains distinct from physical Safari. The cached WebKit browser cannot launch in this dev-env because required GStreamer libraries are absent; restarting or changing dev-env is outside scope. Catalog and deployment checks are recorded in the active work orders and handoff before closure.
