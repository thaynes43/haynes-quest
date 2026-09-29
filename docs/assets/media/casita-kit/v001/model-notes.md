# Casita kit v001 production notes

The production meshes derive from the preserved parametric blockout and the coordinator-approved corrected sheet. Curve and sphere sampling is reduced at construction time. Tiny tile designs are painted faces; the broad forms retain their beveled edges. Each model keeps separate editable production parts plus a joined export mesh in `casita-kit.blend`.

The coordinator asked for orange planter blooms that clearly read as flowers. Each now has six raised petals and a darker center. Their original head positions, the pot footprint and the 0.90 m planning height remain fixed. The crown butterfly, smaller butterflies, candle niches, blue-and-cream tile patterns and teal paint stay consistent across the kit.

Opaque vertex colors carry the palette and mild baked contact shading. The four finishes are matte, glazed paint, satin gold and candle glow; no textures, external decoders, animation, skins or morphs ship. Every GLB has one identity mesh node, glTF +Y up, front +Z and a floor-centered root. Decorative details are scenery without collision.

The B2 registry keeps the original planning boxes. All 36 existing placements are unchanged: nine walls, twenty planters, four doors and three arches. The actual transformed mesh vertices stay inside their planning envelopes and outside the route's walkable surface volumes. Walls and doors intentionally stand on the ground below raised decks; the arch is a backdrop, never a route-spanning gate.

Tom's exact-version decision remains pending. Technical checks and coordinator selection authorize this labeled private candidate under PRD-004 Q-03; they do not establish owner approval, physical Safari performance or deployment.
