/** Focused desktop/phone review inspection; only synthetic model media. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const origin = process.env.QUEST_REVIEW_ORIGIN ?? 'http://127.0.0.1:4399';
const out = path.resolve(process.env.QUEST_REVIEW_OUTPUT ?? 'test-results/web-slinger-review');
const expectedHash = 'f2896efa08de53c1a94b939930071a32efeb5320a7804d5eee48dbd085b4adc3';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'] });
const report = { origin, glbSha256: expectedHash, browser: browser.version(), screens: [], errors: [] };
try {
  for (const viewport of [{ name: 'desktop', width: 1440, height: 1000 }, { name: 'phone', width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport, hasTouch: viewport.name === 'phone', deviceScaleFactor: 1 });
    const page = await context.newPage();
    page.on('pageerror', (error) => report.errors.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error') report.errors.push(message.text()); });
    page.on('response', (response) => { if (response.status() >= 400) report.errors.push(`${response.status()} ${response.url()}`); });
    await page.goto(`${origin}/assets/reviews/web-slinger-helper/v001.html`, { waitUntil: 'networkidle' });
    assert.match(await page.locator('h1').innerText(), /Web-slinger Helper/);
    assert.ok((await page.locator('body').innerText()).includes("Tom's exact-version decision is pending"));
    await page.screenshot({ path: path.join(out, `${viewport.name}-reference.png`) });
    const viewer = page.locator('model-viewer[data-quest-clips]');
    await viewer.scrollIntoViewIfNeeded();
    await page.waitForFunction(() => document.querySelector('model-viewer')?.loaded, undefined, { timeout: 60_000 });
    const data = await viewer.evaluate((element) => ({ loaded: element.loaded, visible: element.modelIsVisible, clips: [...element.availableAnimations], src: new URL(element.src, location.href).href }));
    assert.ok(data.loaded && data.visible);
    assert.deepEqual(data.clips.sort(), ['attack', 'defeat', 'hit', 'idle', 'move']);
    const glb = await page.request.get(data.src);
    assert.ok(glb.ok());
    assert.equal(createHash('sha256').update(await glb.body()).digest('hex'), expectedHash);
    const selector = page.getByLabel('Choose a movement clip');
    await selector.selectOption('idle');
    await page.waitForTimeout(500); // Let the sticky header and model loading bar finish their transitions.
    const width = await page.evaluate(() => ({ viewport: innerWidth, content: document.documentElement.scrollWidth }));
    assert.ok(width.content <= width.viewport + 1, `${viewport.name}: no horizontal page overflow`);
    await page.screenshot({ path: path.join(out, `${viewport.name}-viewer.png`) });
    report.screens.push({ ...viewport, ...data, width });
    await context.close();
  }
  assert.deepEqual(report.errors, []);
} finally {
  await browser.close();
  await writeFile(path.join(out, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
}
console.log(JSON.stringify({ passed: true, browser: report.browser, viewports: report.screens.length, errors: report.errors.length, out }));
