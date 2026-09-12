# WO062 results: Fable 5.1 mobile-controls research and review

- **Status:** Complete; recommendations for root ratification. No game source, cluster, asset, lead-tree or deployed-data change; no PR; no Blender/audio generation; no paid API keys.
- **Model / dispatch:** `claude-fable-5-1`, effort `xhigh`, via `agent-run` (task `haynes-quest-0911-204632`). Source gathering and code tracing were fanned out to three native Opus 5 subagents (`claude-opus-5`, verified on each report's first line); the recommendations and the verification of their claims are Fable's.
- **Worktree / branch / base:** `/home/dev/work/haynes-quest-0911-204632`, `agent/haynes-quest-0911-204632`, from `origin/main` `ed7ae72`.
- **Browser lease:** RELEASED. The shared Playwright MCP page was closed at the end of this research (`browser_close`, no open tabs); the temporary touch-emulation context was closed inside its own run.
- **Evidence (ignored paths):** `test-results/wo062/touch-probe.json` (live touch probe log) and `test-results/wo062/wo062-*.png` (home page and in-game HUD at 390x844, 844x390, 1180x820 and 820x1180); subagent reports `/tmp/wo062-research-apple-webkit/report.md`, `/tmp/wo062-research-roblox-a11y/report.md`, `/tmp/wo062-code-diagnosis/report.md` (with its runnable catalog probe `/tmp/wo062-code-diagnosis/probe.ts`). The layout numbers below were read from the live DOM, not measured from the screenshots.

## 1. Summary

Tom's choices stand: tap the world to jump at every age, walk into things to use them, one large Attack with a smaller Secondary above-right, and nothing else in the thumbs' way. The proposal is a three-zone screen: the left half is the stick, the bottom-right corner is the two-button cluster, and every other world pixel is "tap = jump, drag = camera". Each finger keeps one role from touch-down to lift, so a held stick never jumps, a drag never jumps, and a tap never turns the camera.

Directly observed on the live fixture: the current build has no world-tap path at all, four small always-present action buttons in a 2x2 grid (all dimmed at age 0), header buttons under Apple's 44 pt floor on phones, a camera drag with no tap slop, a stick that reaches full speed at 62% of its visible radius with no dead zone, and a simulation clamp that slows the whole world whenever the frame rate drops below 20 fps. The deployed bundle is correct and its cue files serve; the artwork-update loop can only come from a stale client on the iPad, which the page's missing cache headers and the modal's Save & leave path make easy to fall into. The most likely reasons sound is inaudible are the iOS ring/silent switch muting Web Audio, a muted preference inherited from the earlier silent release, and a very quiet gain stack. None of those three can be proven from a headless browser.

## 2. Live fixture observations (direct)

Chromium 153 headless with SwiftShader, fresh synthetic context, new Demo Adventurer journey with all three fictional pictures, chapter one at age 0. Served bundle `assets/index-D3lvcZ1s.js` (1,028,457 characters; the HANDOFF's released client). Console: favicon 404 and WebGL ReadPixels performance warnings only.

| Viewport (CSS px) | Stick | Action cluster | Per button | Header buttons |
| --- | --- | --- | --- | --- |
| 390x844 phone portrait | 116 ring at (17,683) | 2x2 grid 131x131 at (242,668) | 62, label 9 px | 37x37 (sound, memories, help); Save & leave 42x37 |
| 844x390 phone landscape | 99 (scaled 0.85) at (25,266) | 109x109 at (710,256) | 52, label 8 px | 43x43 |
| 1180x820 iPad landscape | 116 at (25,659) | 149x149 at (1006,626) | 70, label 10 px | 43x43 |
| 820x1180 iPad portrait | 116 at (25,1019) | 149x149 at (646,986) | 70 | 43x43 |

Guard, Jump, Attack and Remember all render disabled at age 0 before the mallet is found. In phone landscape the cluster sits over the world where a friendly resident stands.

Touch probe (second context with touch emulation, iPhone user agent, 390x844): a tap on the right half of the canvas and a tap on the left half both changed nothing. A 120 px drag on the right half rotated the camera (inferred from the later forward movement gaining an x component; the inspection hook does not expose yaw). With the stick deflected 10 px the traveler covered 0.21 m in 1.5 s; at full deflection 0.78 m in 1.5 s against a nominal 3.1 m/s. The context ran at roughly 3 to 4 fps and the 50 ms step clamp turned 1.5 s of wall time into about 0.25 s of game time. That number is a SwiftShader artefact; the mechanism is real on any device below 20 fps.

Served headers (read from the page with `cache: "no-store"`): `/`, `/assets/index-D3lvcZ1s.js` and `/studio/assets/media/ui-confirmed/v001/cue.wav` carry only `Last-Modified` (11 Sep 2026 23:43 UTC), with no `Cache-Control` and no `ETag`; `/api/*` carries `Cache-Control: no-store`. The served bundle text contains `bickering-besties`, `sir-flush-a-lot-besties`, `peel-patrol-besties` and `parody-catalog-v3`. Both cue files fetch with `redirect: "error"` and return 200 `audio/wav` (52,964 and 44,144 bytes). No `quest-audio` preference exists in a fresh session, so a fresh device starts unmuted at master volume 0.35.

## 3. Code-confirmed behaviour today (HEAD ed7ae72)

- `src/game/input.ts:196-208`: a touch `pointerdown` on the left half of the canvas is ignored; on the right half it becomes a camera pointer immediately. No tap/drag distinction, no slop, no world-tap action.
- `src/game/scene.ts:546`: yaw changes by 0.006 rad per dragged pixel (0.34 degrees; a full 390 px swipe is about 134 degrees). The analog `lookX`/`lookY` channels have no touch producer.
- `src/client/GameScreen.tsx:574-583`: Jump is disabled until `abilities` includes `jump`; `createGame.ts:662,684` gate Space the same way, so age 0 cannot jump anywhere.
- `src/client/GameScreen.tsx:1106-1131`: buttons fire on `pointerdown` with capture and ignore `click` except keyboard activation; `touch-activation.ts` leaves them alone. Movement, camera and each button cancel only their own channel (`input.ts:99-108`, `:264-275`).
- `src/client/GameScreen.tsx:1165-1183`: the stick's input radius is a hard-coded 36 px inside a 116 px ring, the origin is the ring centre (not the touch point), there is no dead zone, and the stick only writes input on `pointermove`, never on `pointerdown`. `getJoystickVector` in `input.ts:44-56` exists but is not used by the component.
- `src/game/createGame.ts:638`: `input.clear()` runs every frame while a modal is open or the page is hidden, so a thumb still resting on the stick is dead after a dialog closes until it moves again.
- `src/game/controller.ts:14,58`, `src/game/createGame.ts:615`, `src/game/obby.ts:152`: simulation step clamped to 0.05 s per frame. Game speed is 1.0x at 20 fps or better, 0.75x at 15 fps, 0.5x at 10 fps. The obby path (`obby.ts:747-795`) already has a 0.14 s jump buffer and 0.12 s coyote window; the flat-level `stepController` has neither.
- `src/shared/adventure.ts:23-26`: attack cooldown 600 ms, guard active 800 ms, guard cooldown 1,500 ms; hits, pickups and HP only change after the server round trip, and `createGame.ts:36` emits status at 10 Hz, so button highlights can lag up to 100 ms behind the world.
- `src/game/scene.ts:1111-1115`: device pixel ratio capped at 1.75.
- `src/client/styles.css:834-842`: the game screen sets `touch-action: none` and `user-select: none`, which covers the canvas; there is no `-webkit-touch-callout: none`, so a long press on iOS can still raise the callout or magnifier.
- `src/client/GameScreen.tsx:174-179`: audio `start()` runs on pointerdown, pointerup, touchend, click and keydown in capture phase, never removed until unmount (WO056 F9 applied). `:365-372` suspends the context when help, album, fallen, artwork-update or friend dialogs open; the next gesture resumes it. `QuestAudio.setPaused` has no caller. The context is only ever created inside `start()`, so never outside a gesture.
- `src/client/audio.ts:186-193,215-224`: a persisted `{"muted":true}` under `localStorage["quest-audio"]` makes `start()` return false on every later session; the only feedback is the header glyph changing from `♪` to `♪̸` (`GameScreen.tsx:462-472`).
- `src/client/GameScreen.tsx:357`: the artwork-update modal shows whenever `status.mediaReloadRequired` is true; it outranks every other modal. `scene.ts:411` is the only producer: `unsupportedContentCount` increments when a frozen encounter identity has no match in the bundle's compiled catalog (`scene-catalog.ts:38-53`), and only `rebuildRoute` resets it. Asset fetch or decode failures never set it; they show the non-blocking "Some artwork couldn't load" banner instead. While the gate is up `createGame.ts:494` rejects every action and `:625` stops the world; `retryMedia` (`scene.ts:529-537`) does not touch the counter and its button is hidden by `GameScreen.tsx:399`.
- `src/server/app.ts:229-230`: `/` and `/assets/*` are served by `@hono/node-server` `serveStatic`, which sets only `Last-Modified`; `no-store` is applied to `/api/*` only (`:106`).

## 4. Source guidance

Egress from this pod blocks direct page fetches (curl, WebFetch and the Playwright pod all fail to resolve the hosts), so every quotation below is the text returned by the search index for that URL. Treat wording as high-confidence but unverified until someone opens the page. Primary sources are Apple, WebKit, W3C, MDN, Roblox and Android; secondary sources are marked.

**Apple (primary)**

- [HIG: Game controls](https://developer.apple.com/design/human-interface-guidelines/game-controls): "Touch input is a natural way for players to manipulate things onscreen but can often be imprecise; a player can select a somewhat small area quickly, but cannot select a pixel-sized area accurately."
- [HIG: Game controllers](https://developer.apple.com/design/human-interface-guidelines/inputs/game-controllers): hide on-screen buttons and virtual thumbsticks when a physical controller connects.
- [HIG: Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility): "a button needs a hit region of at least 44x44 pt"; "Reduce the number of options shown at any given time"; "Avoid hidden gestures or nested UI. Instead, use prominent controls that are clearly visible"; "avoid timed interactions".
- [HIG: Layout](https://developer.apple.com/design/human-interface-guidelines/foundations/layout/): safe areas keep controls clear of rounded corners, the Home indicator and the Dynamic Island; support both orientations unless movement makes switching distracting.
- [WWDC24 10085, Design advanced games for Apple platforms](https://developer.apple.com/videos/play/wwdc2024/10085/): "the default tap target size you should aim for is 44 by 44 points"; a virtual left thumbstick can be hidden when unused; "it's important to expand the input area to be as broad as possible" because players cannot feel where their thumb is.
- [WWDC26 358, Make your game great with touch](https://developer.apple.com/videos/play/wwdc2026/358/): "The regions near the thumbs are ideal for frequent or important actions, and the region at the top of the screen is a great place to put less frequently used controls like menu buttons"; "Avoid placing controls where you expect movement or camera input to happen"; do not "cover your character in the center of the display"; "When an action isn't available or relevant, remove it from the screen entirely"; "Every touch control you create should have a visible pressed state"; a thumbstick collider can take "the entire half of the screen for touch detection".
- [HIG: Playing haptics](https://developer.apple.com/design/human-interface-guidelines/playing-haptics) and [Feedback](https://developer.apple.com/design/human-interface-guidelines/ios/user-interaction/feedback/): feedback "helps people know what's happening, discover what they can do next, understand the results of actions, and avoid mistakes". Web pages cannot trigger Taptic haptics in iOS Safari, so feedback must be visual and audible.

**WebKit, MDN, W3C (primary)**

- [WebKit: Designing websites for iPhone X](https://webkit.org/blog/7929/designing-websites-for-iphone-x/) and [MDN env()](https://developer.mozilla.org/en-US/docs/Web/CSS/env): `viewport-fit=cover` plus `env(safe-area-inset-*)` to lay out edge to edge while keeping controls out of the notch, corners and Home indicator (already used in `styles.css`).
- [WebKit: More responsive tapping on iOS](https://webkit.org/blog/5610/more-responsive-tapping-on-ios/): the 350 ms tap delay is removed for `width=device-width` viewports at initial scale and for elements under `touch-action: manipulation`.
- [MDN touch-action](https://developer.mozilla.org/en-US/docs/Web/CSS/touch-action) and [W3C Pointer Events 3](https://www.w3.org/TR/pointerevents3/): `none` disables browser panning and zooming on "a map or game surface"; without it the browser fires `pointercancel` when it takes a gesture. The spec ignores `touch-action` changes made after a pan has started.
- [MDN pointercancel](https://developer.mozilla.org/en-US/docs/Web/API/Element/pointercancel_event): also fires on orientation change and when "the user interacts with too many simultaneous pointers", so every control must survive losing its own pointer.
- [MDN viewport meta](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/meta/name/viewport): iOS Safari ignores `user-scalable=no`; zoom suppression must come from `touch-action`.
- [MDN -webkit-touch-callout](https://developer.mozilla.org/en-US/docs/Web/CSS/-webkit-touch-callout): `none` disables the long-press callout; Apple forum threads (secondary) report it is unreliable on recent iOS and pair it with `preventDefault` on `touchstart`.
- [MDN Web Audio best practices](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices): a context created outside a user gesture starts `suspended`. [MDN BaseAudioContext.state](https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/state): iOS moves the context to `interrupted` on tab switch, minimise or screen off and it must be resumed.
- [WebKit bug 237322](https://bugs.webkit.org/show_bug.cgi?id=237322): Web Audio output is muted when the iOS ringer switch is on silent, unlike media-element playback. [MDN Audio Session API](https://developer.mozilla.org/en-US/docs/Web/API/Audio_Session_API) and [W3C Audio Session](https://www.w3.org/TR/audio-session/): `navigator.audioSession.type = "playback"` requests the media-playback category; MDN lists it as implemented in Safari, the exact shipping version could not be confirmed from webkit.org, and [WebKit bug 261554](https://bugs.webkit.org/show_bug.cgi?id=261554) reports it did not keep a context alive in the background.
- [WebKit: New video policies for iOS](https://webkit.org/blog/6784/new-video-policies-for-ios/) and [Auto-play policy changes for macOS](https://webkit.org/blog/7734/auto-play-policy-changes-for-macos/): any audible playback needs a user gesture; muted or audio-less media may autoplay.
- [MDN HTTP caching](https://developer.mozilla.org/en-US/docs/Web/HTTP/Caching): a response with `Last-Modified` and no `Cache-Control` is eligible for heuristic freshness (typically 10% of the time since modification), which is why `/` above can be reused from cache on a normal navigation.

**Roblox (primary)**

- [Adaptive design](https://create.roblox.com/docs/production/publishing/adaptive-design): "a virtual thumbstick displays in the bottom-left corner of the screen, and a jump button displays in the bottom-right corner"; place custom buttons "near the natural resting position for thumbs", typically relative to the default jump button.
- [Mobile input](https://create.roblox.com/docs/input/mobile): "Most mobile players use two thumbs — one on the virtual thumbstick and one on the jump button."
- [UI/UX design](https://create.roblox.com/docs/production/game-design/ui-ux-design): design mobile first; "A clean, minimalist UI is particularly crucial for mobile interfaces, as small screens can easily get overwhelmed with excessive buttons"; buttons "within a player's thumb reach on mobile devices, for instance the lower-right area of the screen".
- [DevTouchCameraMovementMode](https://create.roblox.com/docs/reference/engine/enums/DevTouchCameraMovementMode): Classic (orbit and pitch), Follow (camera eases to face the character), Orbital (orbit only, no pitch). [DevTouchMovementMode](https://create.roblox.com/docs/reference/engine/enums/DevTouchMovementMode) includes DynamicThumbstick, Thumbstick and ClickToMove.
- [UserInputService](https://create.roblox.com/docs/reference/engine/classes/UserInputService): `TouchTap` and `TouchTapInWorld` (with `processedByUI`) fire when a tap completes; `TouchPan` carries `gameProcessedEvent` so a drag consumed by UI is distinguishable from a world drag. [ContextActionService](https://create.roblox.com/docs/reference/engine/classes/ContextActionService): `BindAction` with `createTouchButton`, `SetPosition`, `SetTitle`, `SetImage`.
- [ScreenInsets](https://create.roblox.com/docs/reference/engine/enums/ScreenInsets) and [ScreenOrientation](https://create.roblox.com/docs/reference/engine/enums/ScreenOrientation): keep GUI inside device safe insets; Roblox defaults to landscape sensor but supports portrait locks.
- [Accessibility guidelines](https://create.roblox.com/docs/production/publishing/accessibility): two forms of visual feedback, reduced-motion preference, larger text preference. Roblox publishes no numeric touch-target minimum; its guidance is scale-based sizing plus thumb reach.

**Size standards and child research**

- [WCAG 2.2 SC 2.5.8 Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html): 24x24 CSS px, or spacing such that 24 px circles centred on each target do not intersect (primary). [SC 2.5.5 Target Size (Enhanced)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html): 44x44 CSS px; "Touch is particularly problematic as it is an input mechanism with coarse precision" (primary).
- [Android accessibility](https://developer.android.com/guide/topics/ui/accessibility/apps): "touch target size, of at least 48dp x 48dp. Larger is even better" (primary). Material 3's 8 dp spacing figure could not be sourced.
- [NN/g: Children's UX and physical development](https://www.nngroup.com/articles/children-ux-physical-development/) (secondary, ages 3 to 12): "at least 2cm x 2cm touch targets" for young children, four times the adult 1x1 cm; tapping big targets is easy, dragging is hard for young kids.
- [Hoober via A List Apart](https://alistapart.com/article/how-we-hold-our-gadgets/) (secondary): 1,333 phone observations, 49% one-handed, 75% thumb-driven. All published thumb-zone data is portrait phone; no landscape-tablet reach study was found.

## 5. Recommendations (Fable's proposal for root ratification)

Sizes are CSS px, which equal iOS points. On an iPhone 1 px is about 0.16 mm and on an iPad about 0.19 mm, so 88 px is 1.4 cm on a phone and 1.7 cm on an iPad. Owner decisions are kept as stated; where a source would suggest otherwise it is noted, not substituted.

### 5.1 One layout, portrait and landscape

Three zones, same in both orientations, everything anchored to the safe-area insets:

1. **Movement zone (left).** The left 50% of the screen (45% in landscape) from below the top HUD band to the bottom inset. A resting ring is always visible near the bottom-left corner so a child sees where to put a thumb; the moment a finger lands anywhere in the zone the ring re-centres under it (Roblox's dynamic thumbstick, Apple's "expand the input area") and springs back on release. Ring 120 px, knob 48 px, full deflection at 44 px from the touch origin, 8 px dead zone, and the vector is written on touch-down as well as on move.
2. **Action cluster (bottom-right).** Attack and Secondary only. Attack centre at (right inset + 76, bottom inset + 76); Secondary centre 32 px right of and 96 px above the Attack centre, so it sits up-right of Attack with a 22 px gap and its edge 14 px from the screen edge. Both appear the first time a tool is collected, with a short pop; before that the corner is empty (Apple: remove unavailable actions). The cluster is unavailable while a modal is open.
3. **World zone (everything else).** Tap = jump, drag = camera, in both halves of the screen outside the two zones above and the top HUD band. A tap ripple at the touch point teaches "tap here to jump" without a button. Roblox players will look for a jump button at first; the ripple plus a one-time "Tap anywhere to jump" hint covers that, and the owner's choice stands.

Top HUD band: Home (44x44, top-left), chapter/age/health card (left), objective card (right), sound toggle and help (44x44 each, top-right, 8 px apart). Keep the centre third of the screen free of overlays (Apple: do not cover the character). Portrait phones raise both bottom zones by the Home-indicator inset (34 px) plus 12 px; landscape phones add the left/right insets (up to 59 px) so the stick ring and Attack never sit under the Dynamic Island corners.

| Element | Phone portrait | Phone landscape | iPad both | Floor and anchor |
| --- | --- | --- | --- | --- |
| Attack | 88 | 76 | 96 | 44 (Apple, WCAG AAA); child research 2 cm upper anchor |
| Secondary | 60 | 52 | 64 | 44 |
| Stick ring / knob | 120 / 48 | 108 / 44 | 132 / 52 | input area is the whole zone |
| Home, sound, help | 44 | 44 | 48 | 44 |
| Gap between any two targets | 12 | 12 | 16 | WCAG 2.5.8 spacing, Android 8 dp |
| Button label text | 13 px | 12 px | 14 px | HIG legibility; current 8 to 10 px is too small |

### 5.2 Contact roles: tap versus camera drag

Every pointer gets one role at touch-down from the zone it started in, and keeps it until lift or `pointercancel`; roles never migrate.

- **World contact resolution:** track distance and time from touch-down. Moving more than 12 px at any time makes it a camera drag for the rest of its life, with no jump. Lifting within 300 ms and under 12 px makes it a tap: queue a jump into the existing 140 ms buffer (executes on the next grounded frame, or inside the 120 ms coyote window after leaving an edge). A hold longer than 300 ms without moving does nothing.
- **Never jumps:** contacts that start on the stick zone, the cluster, the HUD band, a modal or any `[data-quest-ui]` element; contacts that moved beyond slop; the second finger of a pinch (`touch-action: none` already prevents browser zoom).
- **Camera:** keep 0.006 rad/px yaw. Limit pitch to a small band or disable it (Roblox Orbital) and add gentle follow: while the stick is held and no camera contact exists for 1.5 s, ease yaw toward the movement direction at up to 90 degrees/s. With tap-to-jump and follow, a six-year-old rarely needs to drag at all.
- **Long press and selection:** add `-webkit-touch-callout: none` to the game screen alongside the existing `user-select: none`, and keep `touch-action: none` on the whole game screen so Safari never starts a scroll or double-tap zoom mid-fight.

### 5.3 Simultaneous stick plus attack or jump

- A held stick keeps its vector while Attack, Secondary and world taps come and go; per-channel cancellation stays as implemented.
- Stop clearing input every paused frame. Clear once on pause; on resume, re-read every still-captured pointer (the stick's last vector, a held button) so a thumb that never lifted works immediately after a dialog closes.
- Attack fires on touch-down, not on click, and auto-repeats at the cooldown cadence while held, so mashing and holding both work. Secondary fires on touch-down once per press.
- Jump while attacking and attack while airborne are both accepted by the client; the server keeps deciding hits.
- `pointercancel` on one contact clears only that contact; an orientation change cancels all contacts and re-centres the stick (MDN documents both cancel cases).
- Keyboard parity: WASD/arrows move, Space jumps at every age, F is Attack, Shift (or G) is Secondary; mouse drag remains camera.

### 5.4 Primary and Secondary mappings

- **Attack:** the equipped tool's main strike at the nearest enemy in reach and facing arc (existing targeting). Show the swing locally on press and let the server response confirm the hit; do not wait for the round trip to animate. Consider 450 ms instead of 600 ms cooldown once the animation covers it.
- **Secondary:** a different attack from the same tool with a longer cooldown, defined per equipment entry so later dual-wield or combos plug in: spark mallet gives a ground thump (short-range knockback and a 1 s daze in 1.5 m, 3 s cooldown); prism wand gives a three-bolt sparkle spread (wider arc, shorter reach, 3 s cooldown). Both are runtime animation on existing assets; no new models.
- **Guard is retired as a button** per the owner's direction. The acorn shield becomes passive: it visibly absorbs part of the next hit and sparkles, so finding it still matters.

### 5.5 Walk-into interactions, no dedicated buttons

- Equipment, minor memories and friendly help trigger on entering a 1.2 m contact radius, once, on the enter edge, with a 1 s re-arm after leaving the radius. That stops repeated dialogs and never blocks movement.
- Minor memory (two per chapter): a photo card slides in for about 2 s beside the HUD with the collect cue; no modal, no age change.
- Major memory after the boss: walking into it (or the existing Reclaim button) opens the reward panel; this is the chapter's end and may block.
- Friends: contact gives the heal with a small bubble and the confirm cue, once per friend per chapter. Ordinary Attack never targets friends, so the harm-and-amends path has no touch trigger in this playtest; root decides whether that rule stays dormant or gets a deliberate gesture later.
- Remove the Jump, Remember, Take gear, Say hello and Guard buttons and the keyboard-hint strip from the touch HUD.

### 5.6 Readable feedback and animation

- Pressed state in the same frame as `pointerdown`: scale to 0.92 and brighten, spring back on release. Never wait for `click`.
- Attack: swing or beam animation of at least 280 ms with a visible arc; enemy flash plus a small nudge; a shake of the Attack button when there is no target, with the text hint kept for parents.
- Jump: squash on take-off, stretch in the air, landing dust with the landing cue, and the tap ripple at the touch point.
- Pickups: the item bounces toward its HUD slot with a 1.5 s toast.
- All of it under `prefers-reduced-motion` (Roblox and Apple both expose a reduced-motion preference).

### 5.7 Motion response

- Use `getJoystickVector` with a 44 px radius and 8 px dead zone, origin at the touch point, written on touch-down; today full speed arrives at 36 px of a 58 px radius with no dead zone and the origin at the ring centre, which reads as both twitchy and dead.
- Replace the 50 ms per-frame clamp with fixed 16.7 ms steps accumulated up to four per frame (or at least raise the clamp to 100 ms) so a 15 fps device no longer runs at 75% speed. Measure the device frame time first: at 20 fps or better the clamp is not the cause.
- Keep instant velocity on stick input (there is no ramp today). Consider 3.6 m/s from age 4 upward; 3.1 m/s for the infant reads slower on a large iPad screen.
- Add a phone quality tier: pixel ratio cap 1.5 on phones, fewer grass instances, shadows off, and log frame time on the device. Targets: 60 fps on a current iPad, at least 30 fps on an iPhone; only a physical run can confirm them.

### 5.8 No forced save or leave flow

- Header becomes Home only; it exits without a prompt and there is no resume list for this playtest (PLAN007).
- The artwork gate must never offer Save & leave. When the bundle cannot resolve a frozen identity, reload once automatically with a cache-busting query (guarded by a `sessionStorage` flag so it cannot loop), and if it still fails show "This app is out of date" with a Reload button only. Fetch and decode failures already fall back to the banner and keep the world running; keep that.
- Serve `/` with `Cache-Control: no-cache` and hashed `/assets/*` with `Cache-Control: public, max-age=31536000, immutable`, and add a client-version handshake so the client notices a newer server. That belongs in the app, not in haynes-ops.

### 5.9 Sound

- Root causes a headless run cannot show: the iPhone ring/silent switch mutes Web Audio (WebKit bug 237322) and iPad Control Center silent mode behaves the same. Mitigations, in order: set `navigator.audioSession.type = "playback"` behind feature detection on the first gesture; play a short `<audio playsinline>` element once on that gesture so Safari adopts the playback category (the widely used fallback); show the sound state as a labelled toggle a parent can read.
- Do not inherit the silent release's preference. The previous playtest client (`698c9c7` and earlier) defaulted to muted and persisted `{"muted":true,...}` under the same `quest-audio` key whenever the volume slider or the note button was touched; the current client honours that stored value and stays silent with only a `♪̸` glyph. Migrate the key (new name or a version field) so this release starts unmuted, and make the muted state a visible labelled pill rather than a glyph.
- The gain stack is quiet by construction: master 0.35 (about -9 dB) times per-cue gain 0.55 to 0.85 (about -5 to -1.4 dB) on files peaking at -8 to -16 dBFS yields landing cues near -30 dBFS peak. Raise the default master to about 0.8 and normalise the four cues to a common peak around -3 dBFS before judging them on speakers.
- Physical listening on the iPad and iPhone remains the only proof of audibility. If sound is still absent after the above, check the Network panel on the device for the cue fetches; on the live host they return 200 today.

## 6. Diagnosis: artwork gate and inaudible sound

**Artwork gate (CONFIRMED mechanism, INFERRED instance).** The modal is a pure function of the save's frozen encounter identities against the compiled catalog in whichever client bundle is running. The Besties chapter freezes the three identities that exist only in `parody-catalog-v3` (`sir-flush-a-lot-besties`, `peel-patrol-besties`, `bickering-besties`); chapter one uses identities shared with v1/v2. A client built before PLAN006 therefore plays chapter one normally and shows the gate exactly at the Besties chapter. The subagent's catalog probe shows the current bundle resolves all 21 identities, and the live check shows the deployed bundle contains the v3 identities, so the deployed server and client agree. The loop needs a stale client on the iPad: a Safari tab or page left over from the earlier playtest release at the same URL, or a copy reused under heuristic caching because `/` is served with `Last-Modified` and no `Cache-Control`. Once inside the modal, Save & leave then resume keeps the same in-memory bundle and recomputes the same three misses; only Reload journey can replace the bundle, and the modal's copy steers toward Save & leave. Verification on the device: open the page, force a reload, and confirm the loaded bundle name is `index-D3lvcZ1s.js`; if the loop persists on that bundle the diagnosis is wrong.

**Sound (three candidates, all needing the device).** In order of likelihood: (1) the ring/silent switch or Control Center silent mode mutes Web Audio while every code path reports success; (2) a persisted `muted: true` from the earlier silent release, inherited through the unchanged `quest-audio` key, which makes `start()` return false on every session; (3) the quiet gain stack. Eliminated for the live host: cue files missing or redirected (they return 200 `audio/wav`), the context being created outside a gesture, a dialog leaving the context suspended (the next gesture resumes it), and `setPaused` (never called). Verification on the device in one minute: look for `♪̸` in the header, check `localStorage["quest-audio"]`, flip the ring switch, then play a cue.

## 7. Observed versus inferred

Observed (live Chromium, this task): no world-tap path; four dimmed 52 to 70 px buttons in a 2x2 grid with 8 to 10 px labels; header controls of 37 px on phone portrait; camera drag without slop; the step clamp slowing the world at low frame rates; cue files serving correctly; the deployed bundle carrying the v3 catalog; no cache headers on the page and bundle; stick without dead zone or re-centring.

Confirmed by code reading with file references: the paused-frame `input.clear()`, the stick's 36 px input radius, the 600 ms server-authoritative attack cooldown and 10 Hz status feed, the gate's single producer and reset, the persisted-mute path and the earlier release's muted default.

Inferred (needs a physical device): the stale client on the iPad; the silent-switch mute; a stored muted preference on the iPad; the gain stack being below speaker audibility; actual iPad and iPhone frame rates; the long-press callout; the exact Safari support level of the Audio Session API.

## 8. Browser and device scope

Playwright Chromium 153 with SwiftShader in the cluster, viewports 390x844, 844x390, 1180x820 and 820x1180, plus one touch-emulated 390x844 context with an iPhone user agent. No WebKit, no physical iPad or iPhone, no audible playback, no child playtest. Nothing here is evidence of Safari touch feel or sound.

## 9. Branch, commit and lease

Committed on `agent/haynes-quest-0911-204632` in `/home/dev/work/haynes-quest-0911-204632` (checkpoint `7404295`, then the final revision; exact hash in the final CLI output). No PR was opened. The browser lease is released as stated at the top of this file.
