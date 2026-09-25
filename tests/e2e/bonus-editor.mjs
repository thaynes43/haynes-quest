// Browser check for optional enemy authoring on the fictional Rat Casino sample.
import assert from "node:assert/strict";
import { chromium } from "playwright";

const url = process.env.QUEST_E2E_URL;
assert.ok(url, "QUEST_E2E_URL is required");

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));

try {
  await page.goto(new URL("/editor", url).href, { waitUntil: "domcontentloaded" });
  const sample = page.getByRole("button", { name: "Open Rat Casino sample", exact: true });
  await sample.waitFor();
  page.once("dialog", (dialog) => void dialog.accept());
  await sample.click();
  const remove = page.getByRole("button", { name: "Remove optional enemy", exact: true });
  await remove.waitFor();
  assert.equal(await page.getByText("Ready to play", { exact: true }).count(), 1);
  await remove.click();

  const form = page.locator("form.editor-world-encounter");
  await form.waitFor();
  const platform = form.getByRole("combobox", { name: "Platform" });
  assert.equal(await platform.inputValue(), "cabinet-side-bridge");
  await form.getByRole("button", { name: "Add optional enemy", exact: true }).click();
  await remove.waitFor();
  assert.equal(await page.getByText("Ready to play", { exact: true }).count(), 1);

  await remove.click();
  await form.waitFor();
  await platform.selectOption("after-hours-exit");
  await form.getByRole("button", { name: "Add optional enemy", exact: true }).click();
  await form.getByRole("alert").waitFor();
  assert.match(await form.getByRole("alert").innerText(), /Try another spot or platform/);
  assert.equal(await remove.count(), 0, "invalid post-boss enemy was added");

  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ url, defaultPlatform: "cabinet-side-bridge", cleanReadd: true, postBossRejected: true, pageErrors: errors }, null, 2));
} finally {
  await browser.close();
}
