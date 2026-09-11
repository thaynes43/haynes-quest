# Asset review: replace with asset ID and version

Copy this page to `docs/assets/reviews/<asset-id>/<version>.md`. Replace all example values and media paths; remove inapplicable sections. Link the page from the catalog. Keep old versions available for comparison.

- **Stable ID / candidate version:** To fill
- **Status:** In production / Needs iteration / Ready for Tom / Changes requested / Approved / Superseded
- **Kind / gameplay purpose:** To fill
- **Public-safe provenance:** Original/generated/licensed; actual tool/model versions, generation date, applicable terms and attribution
- **Authoring agent / effort:** Actual agent; Blender must be Astra
- **Art brief / input concepts:** Exact versions and reference checksums; names of fictional subjects only
- **Editable master:** Durable relative artifact ID and checksum, with authorized retrieval instructions; no private URLs or credentials
- **Runtime files:** Exact GLB/audio/texture filenames, sizes and SHA256s; include every file in an approved kit

## Concept to model

Show every selected source image, a matching render and the exported model. Keep useful earlier concepts linked for feedback. Record prompt/reference history in this version's source record; do not claim seeds or exact reproducibility the tool did not supply.

This fenced example assumes a page at `reviews/<asset-id>/<version>.md` and real files under `media/<asset-id>/<version>/`. Replace every example path before using it as live markup:

```html
<figure>
  <img src="../../media/ASSET/VERSION/concept.png" alt="Describe the selected concept and its useful construction views">
  <figcaption>Selected concept; coordinator decision, pending Tom's review.</figcaption>
</figure>
<model-viewer src="../../media/ASSET/VERSION/model.glb"
  poster="../../media/ASSET/VERSION/front.png"
  alt="Describe this candidate model and its age stage where relevant"
  camera-controls touch-action="pan-y">
</model-viewer>
<p><a href="../../media/ASSET/VERSION/model.glb">Download model</a> ·
  <a href="../../media/ASSET/VERSION/front.png">View still</a></p>
```

Include front/side/back or turntable views, a scale reference and visible animation examples. Specify required clip names and which are actually shown. Compare age variants together. Avoid autoplaying movement/audio; stills and downloads must remain useful if 3D rendering fails.

## Audio audition

Link the source take and processed export separately. State duration, channel/sample format, level measurements, loop boundaries and processing recipe. Record whether any real listening review happened and by whom/tool.

```html
<audio controls preload="none" aria-label="Describe this cue and version">
  <source src="../../media/ASSET/VERSION/cue.wav" type="audio/wav">
  <a href="../../media/ASSET/VERSION/cue.wav">Download the cue</a>
</audio>
<p>Describe the sound and its intended gameplay moment; list any loop or level concern.</p>
```

## Technical checks

List actual commands/results: model format validator, orientation/scale, geometry/material/texture budget, animation/deformation, in-engine preview and download size; or audio decode, duration, levels, clipping and loop checks. Include tested browsers/devices and explicit untested limits. A Blender render, generated waveform or browser emulation is not proof of real-device behavior or listening quality.

## Coordinator intake and iteration

- **Reviewed by / date:** To fill
- **Input and exported versions compared:** To fill
- **Style / silhouette / proportions / motion findings:** To fill
- **Requested corrections / resulting version:** To fill
- **Selected for Tom's review:** Pending until evidence and concrete previews exist

## Feedback and owner decision

State the small set of concrete appearance, movement or sound choices Tom should review. Preserve his feedback as versioned decisions rather than overwriting the history.

- **Reviewer:** Tom
- **Decision / date:** Pending
- **Approved version and artifact checksums:** None
- **Requested changes:** None recorded

An agent or validator cannot fill in Tom's approval. Coordinator selection enables continued candidate production and iteration, not final gameplay promotion.

## Integration

After approval, record the gameplay manifest/version and PR, and the previous approved version being replaced. A materially changed model, texture, animation or processed sound needs a new candidate version and review. Pending/rejected candidates stay in the isolated studio; gameplay uses identified placeholders or previously approved versions.
