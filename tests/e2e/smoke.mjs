import { chromium } from "playwright";
import fs from "node:fs/promises";
const browser = await chromium.launch({
  headless: true,
  args: [
    "--no-sandbox",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ],
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await fs.mkdir("test-results", { recursive: true });
await page.goto("http://127.0.0.1:4173");
await page.getByRole("button", { name: "Start a journey" }).waitFor();
await page.screenshot({
  path: "test-results/home-desktop.png",
  fullPage: true,
});
await page.getByRole("button", { name: "Start a journey" }).click();
await page.getByRole("button", { name: "Preview memories" }).click();
await page.getByRole("button", { name: "Begin your journey" }).waitFor();
await page.screenshot({
  path: "test-results/setup-desktop.png",
  fullPage: true,
});
await page.getByRole("button", { name: "Begin your journey" }).click();
await page.locator("canvas").waitFor();
await page.waitForTimeout(800);
await page.screenshot({ path: "test-results/game-desktop-start.png" });
console.log(
  JSON.stringify(
    {
      title: await page.title(),
      errors,
      canvas: await page.locator("canvas").count(),
      text: (await page.locator("body").innerText()).slice(0, 1400),
    },
    null,
    2,
  ),
);
await browser.close();
