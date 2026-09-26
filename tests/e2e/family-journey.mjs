// Synthetic family journey (DESIGN-024 validation, browser part). Run against
// a freshly started tests/e2e/serve-family.ts (it creates Test Child B):
//
//   QUEST_E2E_URL=http://127.0.0.1:4180 node tests/e2e/family-journey.mjs
//
// Covers: signed-out start; the administrator creates Test Child B, waits for
// the automatic pick, recaptions, swaps with Show more and publishes; a family
// member sees the journey card without setup controls and opens the game. The
// big-memory age advance and move card are covered by
// tests/game/game-screen-family.test.tsx. Chromium only; no Safari claim.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { chromium } from "playwright";

const url = process.env.QUEST_E2E_URL;
assert.ok(url, "QUEST_E2E_URL is required");
const origin = new URL(url).origin;
const out = "test-results/family-journey";
await fs.mkdir(out, { recursive: true });
const UPSTREAM = /00000000-0000-4000-8000-0000000000(0a|0b)|10000000-0000-4000-8000-\d{12}/;

const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const report = { steps: [], privacyChecked: 0 };
const step = (name) => {
  report.steps.push(name);
  console.log(`ok ${name}`);
};

async function open(session, viewport = { width: 1280, height: 900 }) {
  const context = await browser.newContext({ viewport });
  if (session) {
    await context.addCookies([{ name: "quest_test_session", value: session, url: origin }]);
  }
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", async (response) => {
    if (!response.url().includes("/api/") || !(response.headers()["content-type"] ?? "").includes("json")) return;
    const text = await response.text().catch(() => "");
    report.privacyChecked += 1;
    assert.doesNotMatch(text, UPSTREAM, `upstream id leaked from ${new URL(response.url()).pathname}`);
  });
  return { context, page, errors };
}

try {
  // Signed out: only the sign-in start.
  {
    const { context, page } = await open(null);
    await page.goto(url);
    await page.getByRole("button", { name: "Sign in" }).waitFor();
    assert.equal((await page.request.get(`${origin}/api/children`)).status(), 401);
    step("signed-out visitor sees only sign-in and gets 401");
    await context.close();
  }

  // Administrator setup.
  {
    const { context, page, errors } = await open("admin");
    await page.goto(url);
    await page.getByRole("button", { name: "Set up your family" }).click();
    await page.getByRole("button", { name: "Add a child" }).click();
    await page.getByLabel("Name in the photo library").fill("Test Child B");
    await page.getByRole("button", { name: "Find" }).click();
    await page.getByLabel("Name to show").fill("Test Child B");
    assert.equal(await page.getByLabel("Birthday").inputValue(), "2020-02-29");
    await page.getByLabel("World").selectOption("rat-casino-world@v2");
    await page.getByRole("button", { name: "Create and pick photos" }).click();
    await page.locator(".family-chapter-card").first().waitFor({ timeout: 60_000 });
    assert.equal(await page.locator(".family-chapter-card").count(), 3);
    assert.equal(await page.locator(".family-slot").count(), 9);
    await page.waitForFunction(() => [...document.querySelectorAll("img.family-thumbnail")]
      .every((image) => image.complete && image.naturalWidth > 0));
    step("admin created a child and the automatic pick filled 9 slots with private thumbnails");

    const first = page.locator(".family-slot").first();
    await first.getByRole("button", { name: "Edit caption" }).click();
    await first.getByLabel("Caption").fill("Pumpkin patch day");
    await first.getByRole("button", { name: "Save" }).click();
    await first.getByText("Pumpkin patch day").waitFor();
    step("admin edited a caption");

    const second = page.locator(".family-slot").nth(4);
    await second.getByRole("button", { name: "Swap" }).click();
    await second.locator(".family-suggestion").first().waitFor();
    const before = await second.locator(".family-suggestion").count();
    const more = second.getByRole("button", { name: "Show more" });
    if (await more.isVisible()) {
      await more.click();
      for (let wait = 0; wait < 50 && (await second.locator(".family-suggestion").count()) <= before; wait += 1) {
        await page.waitForTimeout(100);
      }
      assert.ok((await second.locator(".family-suggestion").count()) > before, "Show more added suggestions");
    }
    await second.locator(".family-suggestion").first().click();
    await second.locator(".family-suggestions").waitFor({ state: "detached" });
    step(`admin swapped a photo from ${before}+ suggestions`);

    await page.getByRole("button", { name: "Publish" }).click();
    await page.getByText("Published version 1").waitFor();
    await page.screenshot({ path: `${out}/admin-memories.png`, fullPage: true });
    step("admin published the journey");
    assert.deepEqual(errors, []);
    await context.close();
  }

  // Family member: journey card, no setup, the game opens.
  {
    const { context, page, errors } = await open("member", { width: 390, height: 844 });
    await page.goto(url);
    const card = page.locator(".family-journey-card");
    await card.waitFor();
    assert.match(await card.innerText(), /Test Child B[\s\S]*Ready to start/);
    assert.equal(await page.getByRole("button", { name: "Set up your family" }).count(), 0);
    const admin = await page.request.get(`${origin}/api/admin/children`);
    assert.equal(admin.status(), 403);
    step("member sees the journey card and no setup");
    await card.click();
    await page.locator("canvas").first().waitFor({ timeout: 60_000 });
    const text = await page.locator("body").innerText();
    assert.doesNotMatch(text, /fictional/i);
    await page.screenshot({ path: `${out}/member-game.png` });
    step("member opened the family game without fixture copy");
    assert.deepEqual(errors, []);
    await context.close();
  }
  assert.ok(report.privacyChecked > 10);
  await fs.writeFile(`${out}/report.json`, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`family journey passed (${report.steps.length} steps, ${report.privacyChecked} API bodies checked)`);
} finally {
  await browser.close();
}
