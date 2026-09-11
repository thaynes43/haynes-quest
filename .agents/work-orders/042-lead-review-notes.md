# WO042 lead review notes

This is a lead-owned integration checkpoint, not a final Fable result or permission decision. Fable has exited and released its resources; root preserved its work.

## Independent read-only review

Sol compared extraction5507a8e function by function with its parent: moved gameplay helpers/assertions are equivalent apart from formatting. URL closure, per-driver save WeakMap, actual inputs, server-state comparisons, media retry, boss/age gates, save/resume and cleanup remain intact. Ferry baseline de71c5e still requires support, unchanged recoveries, actual platform displacement and bounded rider-offset drift plus a real final jump; it does not weaken substantive carry proof.

One minor diagnostic regression was found at intake: `journey.mjs` assigned `activePage` only after `driver.start` finished. Startup/navigation/setup failures therefore could not capture the page. Root restored early ownership through an optional `onPageCreated` callback immediately after page creation. Focused ESLint and whitespace checks passed; no runtime/browser behavior changed. This is test diagnostics, not gameplay.

## Secondary touch on menu buttons

Independent code review confirms the Fable probe uses the same retained-contact recipe proved by WO031: contact1 stays on the joystick while a separately identified contact is pressed/released. The initial reviewer incorrectly treated generated protocol comments as stronger evidence than WO031's real Chromium event trace; that verdict was withdrawn. Do not diagnose the test as invalid solely from the declaration comment.

Header buttons use `onClick`; game action buttons use pointer handling. The leading hypothesis is secondary-pointer events without a compatibility click. The later actual event trace confirmed the missing compatibility click and implicit capture. If confirmed, preserve primary touch/mouse/keyboard behavior, avoid duplicate activation, and verify menu opening clears movement and held-stick Save & leave fires once. Root integrated the corrected activator in ff3ad87; WO043 records the passing actual event regression, including fresh keyboard/tap/mouse deduplication.

## Evidence wording to correct at final intake

- The Fable session actually started19:22:26UTC, verified in task metadata/transcript. Its initial checkpoint's approximate19:30 time is inaccurate.
- Completed keyboard repeat report is dated19:36:26UTC approximately (use exact JSON timestamp), not the checkpoint's guessed19:40. Home/viewport report timestamp19:33:48.875UTC, not guessed19:38.
- There are three fictional pictures **in total**: two in the first released bundle and one in the second. Do not say three were released at the first boss or in each bundle. Final album contains three.
- Full keyboard/touch runs are Chromium software-renderer evidence, not physical Safari/child acceptance or PostgreSQL restart durability.
- Archived v1 plan data is preserved; its incomplete Nap/missing Diva candidate art is not fully playable. New v2 plans avoid both. Do not overstate graphical backward compatibility.
