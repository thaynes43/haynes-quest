# Rooftop City v001 production notes

The approved reference is a Blender construction sheet, not an image-generation concept. Production preserves its component geometry and adds mild 12-ray vertex contact shading. Broad palette regions use opaque vertex colours and one equipment material, plus a matte timber material on the tower. There is no atlas, texture, transparency, animation, skinning or compression extension.

The public master retains component and evaluated meshes. GLBs each have one identity mesh root at the floor centre, with front +Z after glTF's Y-up conversion. The existing registry planning boxes are retained deliberately; measured tight bounds are recorded separately. All 50 A3 decor transforms are tested through the actual SceneAssets instancing path, including current rotations and scales, plus 32 additional quarter-turn/scale probes. All stay inside their envelopes; the measured near-surface false-foothold diagnostic is empty.

The billboard has no central face. Ray probes check its centre is open while its edge rails exist. A tower trestle probe also verifies a real opening. Fallback scenery remains visible if a GLB cannot load. Four production files are 43,912–180,172 bytes and 880–2,960 triangles each.

The first unreviewed reference attempt had black alpha output, a tightly framed AC angle and intersecting rectangular wood staves. The approved sheet fixes alpha/framing and uses tapered wedge staves. Those preliminary files remain in authoring history. No initial production export was published or overwritten by a later version.

The coordinator approved the reference before export and the exact GLB comparison after loading and capture. Tom's exact-version review stays pending under PRD-004 Q-03. The A3 route uses fictional media, lockstep input and thinned software drawing between captures; it is not physical Safari or real-time performance acceptance. No published course, save, encounter, friendly roster or mechanic changes in this kit.
