import assert from "node:assert/strict";
import { inspectGame, waitForInspection } from "./authored-browser-driver.mjs";

const assetPath = "/studio/assets/media/bestie-pink/v001/bestie-pink.glb";

/** Keep one asset unavailable through combat retries until its explicit artwork retry. */
export async function createPausedArtworkProbe(page) {
  let failures = 0;
  let retryAllowed = false;
  await page.route(`**${assetPath}`, async (route) => {
    if (!retryAllowed) {
      failures += 1;
      await route.fulfill({
        status: 503,
        contentType: "text/plain",
        body: "Artwork recovery test",
      });
    } else await route.continue();
  });
  return {
    assetPath,
    isExpectedResponse(path, status) {
      return path === assetPath && status === 503 && failures > 0;
    },
    isExpectedConsole(message) {
      return (
        failures > 0 &&
        new URL(message.location().url || "about:blank").pathname ===
          assetPath &&
        /503/.test(message.text())
      );
    },
    async verify({ screenshot, mark }) {
      assert.ok(failures > 0, "the selected Besties model must fail before retry");
      mark("paused-artwork:await-real-defeat");
      await waitForInspection({
        page,
        screenshot,
        label: "paused-artwork-fallen",
        timeout: 90_000,
        predicate: (inspection) => inspection.status.phase === "fallen",
      });
      await page
        .getByRole("dialog", { name: "Take a breath. Try again." })
        .waitFor();
      await page.getByText("Some artwork couldn’t load.").waitFor();
      const before = await inspectGame(page);
      assert.ok(before.status.mediaFailed > 0);
      await screenshot("besties-paused-artwork-fallback");
      retryAllowed = true;
      await page
        .getByRole("button", { name: "Retry artwork", exact: true })
        .tap();
      await page
        .getByText("Some artwork couldn’t load.")
        .waitFor({ state: "hidden", timeout: 20_000 });
      const after = await waitForInspection({
        page,
        screenshot,
        label: "paused-artwork-restored",
        timeout: 20_000,
        predicate: (inspection) =>
          inspection.status.mediaFailed === 0 &&
          inspection.status.mediaLoading === 0 &&
          inspection.visuals?.besties?.length === 2 &&
          inspection.visuals.besties.every(
            (actor) => actor.clip && actor.pose?.head,
          ),
      });
      assert.equal(
        after.status.phase,
        "fallen",
        "artwork retry must not resume gameplay",
      );
      assert.equal(
        after.obby.timeSeconds,
        before.obby.timeSeconds,
        "physics clock must stay paused",
      );
      assert.deepEqual(
        after.status.position,
        before.status.position,
        "retry must not move the fallen player",
      );
      await screenshot("besties-paused-artwork-restored");
      const result = {
        assetPath,
        failures,
        retryPresses: 1,
        phase: after.status.phase,
        failedBefore: before.status.mediaFailed,
        failedAfter: after.status.mediaFailed,
        loadingAfter: after.status.mediaLoading,
        warningHidden: true,
        physicsStayedPaused: true,
        timeSeconds: after.obby.timeSeconds,
        actorsRestored: after.visuals.besties.map((actor) => actor.id),
      };
      mark("paused-artwork:restored", result);
      return result;
    },
  };
}
