# WO-020: Era catalog browser intake results

- **Status:** Prepared; final audit pending.
- **Owner:** Native GPT-5.6 Sol, xhigh, browser/file/network verification only.
- **Branch/worktree:** `agent/quest-era-catalog-audit` in `/home/dev/work/quest-era-catalog-audit`.
- **Base:** `f6a8f0de4a6b132ef5d4244a8bf5f1e37d56d531`.
- **Owned files:** `tests/e2e/era-catalog.mjs` and this result record.

## Prepared contract

`tests/e2e/era-catalog.mjs` is ready to audit the seven built v001 review pages for Blockling, Signal Moth, Buffer Baron, Loop Dancer, Prism Mimic, Trendweaver and the four-item era-equipment set. It requires exactly ten same-origin GLB viewers. Each viewer must report loaded and visible through the real `model-viewer` API, create a WebGL context, expose positive 3D dimensions and produce varied rendered pixels rather than relying on its poster.

The six enemy viewers must expose exactly `idle`, `move`, `attack`, `hit` and `defeat`. The page controls must send infinite repetitions for `idle`/`move`, one repetition for `attack`/`hit`/`defeat`, advance each clip, pause it with stable time, and return the Play label after every one-shot finishes. The four equipment candidates must remain rigid and expose no animation clips.

The audit also checks:

- every built manifest is byte-for-byte equivalent as JSON to the manifest in the source worktree;
- every downloaded GLB's exact byte count and SHA-256 match that source manifest;
- all browser page requests stay on the fixture origin, with no failed requests, HTTP error responses, page errors or console errors;
- every page and viewer fits a 390 × 844 touch viewport without horizontal overflow;
- real CDP touch drags change the camera orbit for Blockling and Spark Mallet;
- each named final `.blend` master is retrieved independently from the internal Blender service's declared `/artifacts/` route and matches its manifest byte count and SHA-256. The test accepts the three current declaration shapes: an explicit artifact URL, an artifact ID, or a safe declared `/workspace/` directory. It does not call Blender or inspect a scene.

Safe phone page and viewer screenshots plus the compact JSON report are written to ignored `test-results/era-catalog/`. No cookies, headers, response bodies, private photos, credentials or player/save identifiers are recorded.

## Preparation validation

- Prettier completed on the new audit.
- ESLint completed with zero findings.
- `node --check tests/e2e/era-catalog.mjs` passed.
- `git diff --check` passed.

## Pending final run

No catalog pass or product failure is claimed at this checkpoint. The remaining four review pages, the final ten source manifests/assets and the rebuilt `dist/site` were not all available. Run only after the root author confirms the seven built pages and ten final candidates are ready:

```bash
QUEST_E2E_URL=http://127.0.0.1:4390 \
QUEST_REPO_ROOT=/home/dev/work/quest-era-boss-loop \
QUEST_E2E_RESULTS_DIR=/home/dev/work/quest-era-catalog-audit/test-results/era-catalog \
node tests/e2e/era-catalog.mjs
```

Update this record with the exact browser, counts, hashes, selected safe screenshots and any findings after that run. Chromium with SwiftShader and touch emulation is functional browser evidence; it is not physical iPhone/iPad Safari evidence, performance certification, art approval or gameplay promotion.
