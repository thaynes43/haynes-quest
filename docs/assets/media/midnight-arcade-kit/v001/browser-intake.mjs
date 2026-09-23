// Actual GLB rendering evidence, independent of Blender source renders.
// Run from this repository with: node docs/assets/media/midnight-arcade-kit/v001/browser-intake.mjs
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const directory = path.dirname(fileURLToPath(import.meta.url));
const vendor = path.resolve(directory, '../../../../javascripts/vendor/model-viewer-4.3.1.min.mjs');
const names = ['ticket-arch', 'arcade-cabinet', 'joystick-bollard'];
const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1');
  try {
    if (url.pathname === '/') {
      const name = names.includes(url.searchParams.get('asset')) ? url.searchParams.get('asset') : names[0];
      response.setHeader('Content-Type', 'text/html');
      response.end(`<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;width:100%;height:100%;background:#e7dfd4}model-viewer{width:100%;height:100%}</style><script type="module" src="/model-viewer.mjs"></script></head><body><model-viewer src="/${name}.glb" alt="WO095 technical preview" camera-controls interaction-prompt="none" environment-image="neutral" exposure="1" shadow-intensity=".8" camera-orbit="28deg 72deg auto"></model-viewer></body></html>`);
    } else if (url.pathname === '/model-viewer.mjs') {
      response.setHeader('Content-Type', 'text/javascript');
      response.end(await fs.readFile(vendor));
    } else if (names.some(name => url.pathname === '/' + name + '.glb')) {
      response.setHeader('Content-Type', 'model/gltf-binary');
      response.end(await fs.readFile(path.join(directory, path.basename(url.pathname))));
    } else if (url.pathname === '/favicon.ico') {
      response.writeHead(204); response.end();
    } else { response.writeHead(404); response.end(); }
  } catch (error) { response.writeHead(500); response.end(String(error)); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1000, height: 850 }, deviceScaleFactor: 1 });
  const errors = [], failedRequests = [], consoleErrors = [], inspected = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('requestfailed', request => failedRequests.push({ url: request.url(), error: request.failure()?.errorText }));
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  for (const name of names) {
    await page.goto(`http://127.0.0.1:${server.address().port}/?asset=${name}`);
    await page.waitForFunction(() => document.querySelector('model-viewer')?.loaded === true, { timeout: 30000 });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await page.screenshot({ path: path.join(directory, name + '-browser.png') });
    inspected.push(await page.evaluate(name => {
      const model = document.querySelector('model-viewer');
      return { asset: name, loaded: model.loaded, dimensions: model.getDimensions(),
        center: model.getBoundingBoxCenter(), availableAnimations: model.availableAnimations,
        screenshot: name + '-browser.png', cameraOrbit: model.getCameraOrbit().toString() };
    }, name));
  }
  const report = { browser: await browser.version(), viewer: 'model-viewer 4.3.1 (bundled)',
    renderer: 'Chromium headless / software WebGL (SwiftShader)', viewportPixels: [1000, 850],
    tested: 'Actual separately exported static GLBs, loaded from a local HTTP server',
    limitation: 'Desktop browser rendering check; not physical iPhone/iPad or gameplay performance acceptance.',
    inspected, pageErrors: errors, failedRequests, consoleErrors };
  await fs.writeFile(path.join(directory, 'browser-report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
  if (errors.length || failedRequests.length || consoleErrors.length) process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
}
