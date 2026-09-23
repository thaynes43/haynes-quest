# Rat Pit Boss v001 paused still preview

## Status

These are still observations of the exact paused `rat-pit-boss.glb`. The GLB is unvalidated and superseded. This preview is not a completed candidate, animation or rig acceptance, validator evidence, final art approval, or gameplay acceptance.

The older files under `v001/checkpoint/` were not used.

## Source identity

- Input: `../rat-pit-boss.glb`
- SHA-256: `09a4dadbb4f9eabdddf32b05e7f6ee574e23580127ac9c4a94f991b95bcabc4a`
- Size: 1,916,492 bytes

## Method

The existing `../source/preview.mjs` renderer (SHA-256 `52beb3030b6e4e6c2dd804880641de6c04ceb9f0162227c55dfca64632eb484b`) served that exact GLB on a loopback-only HTTP server and loaded it with Three.js 0.186.0 `GLTFLoader` in headless Chromium 153.0.8010.12 using SwiftShader. The render used an 800 by 900 orthographic canvas, the file's initial/rest state, three simple lights, and a floor. No Blender service or Blender process was used.

- `front.png`: camera `(0, 1.08, -6)`, looking at `(0, 1.08, 0)`
- `three-quarter.png`: camera `(3.1, 2.15, -6)`, looking at `(0, 1.08, 0)`

The browser observation in `preview-browser.json` recorded zero page/console errors, WebGL error `0`, three render calls, and 14,146 rendered triangles including the two-triangle preview floor. It also enumerated five embedded clip headers. No clip was sampled for these stills, so the clip list is metadata only and is not animation validation.

## Outputs and limits

- `front.png` and `three-quarter.png` are 800 by 900 RGB PNG files.
- `SHA256SUMS` binds the source GLB, renderer, screenshots, and raw browser observation.
- Software Chromium rendering establishes that this exact GLB loaded and produced these two pixels-on-canvas views. It does not establish glTF conformance, skeleton or skin-weight correctness, animation behavior, runtime performance, physical-device appearance, final visual quality, or approval.
