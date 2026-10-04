/** Action minions A v001: per-asset inspection and preview configuration (glTF frame: +Y up, forward -Z, right +X).
 * Solids are rest-pose boxes carried by a bone; clearance pairs list bone groups (dominant skin weight) that must stay
 * out of (or, for hidden props, inside) a solid in the listed clips. Beats are asset-specific measured checks. */
const v = a => a.map(x => +x.toFixed(4));
export const ASSETS = {
  'gadget-hammer-hopper': {
    contactFraction: .625, contactProbe: 'mallet', bodyBones: ['body'],
    probes: ['mallet', 'hand_R', 'hand_L', 'body', 'boot', 'lid'],
    solids: {
      box: {frame: 'body', min: [-.42, .50, -.27], max: [.42, 1.06, .27], shrink: .006},
      lid: {frame: 'lid', min: [-.445, 1.03, -.295], max: [.445, 1.21, .295], shrink: .006},
    },
    clearance: {
      mallet_vs_box: {of: ['mallet'], solid: 'box'}, mallet_vs_lid: {of: ['mallet'], solid: 'lid'},
      fists_vs_box: {of: ['hand_R', 'hand_L'], solid: 'box'}, fists_vs_lid: {of: ['hand_R', 'hand_L'], solid: 'lid'},
      boot_vs_box: {of: ['boot'], solid: 'box'}, boot_vs_lid: {of: ['boot'], solid: 'lid'},
      wrench_hidden_until_defeat: {of: ['wrench'], solid: 'box', mode: 'inside', clips: ['idle', 'move', 'attack', 'hit']},
    },
    beats({at, B, wp, groupBox, T, rest}) {
      const contact = at('attack', 1.25, s => { const m = groupBox(s, ['mallet']); return {mallet_min_y: m.min.y, mallet_centre: m.getCenter(new T.Vector3()).toArray(), mallet_front_z: m.min.z}; });
      const preContact = at('attack', 1.2, s => groupBox(s, ['mallet']).min.y);
      const squash = at('attack', 1.27, s => groupBox(s, ['mallet']).getSize(new T.Vector3()).y);
      const unsquashed = at('attack', 1.25, s => groupBox(s, ['mallet']).getSize(new T.Vector3()).y);
      let bootLift = 0; for (let i = 0; i <= 42; i++) bootLift = Math.max(bootLift, at('move', .7 * i / 42, s => groupBox(s, ['boot']).min.y));
      const lidRest = B('lid').quaternion.clone(); const lidHit = at('hit', .09, () => B('lid').quaternion.angleTo(lidRest) * 180 / Math.PI);
      const held = at('defeat', 2.4, s => { const up = new T.Vector3(0, 1, 0).applyQuaternion(B('body').getWorldQuaternion(new T.Quaternion())); const w = groupBox(s, ['wrench']); const box = groupBox(s, ['body']);
        const k = groupBox(s, ['boot']); return {box_up_axis: v(up.toArray()), wrench_min_y: w.min.y, wrench_centre: v(w.getCenter(new T.Vector3()).toArray()), box_min_y: box.min.y, boot_min_y: k.min.y, boot_max_y: k.max.y}; });
      const idle0 = at('idle', 0, s => Math.max(...s.positions.map((p, i) => p.distanceTo(rest.positions[i]))));
      const data = {contact, pre_contact_mallet_min_y: preContact, mallet_height_contact: unsquashed, mallet_height_squash: squash, move_boot_max_lift_m: bootLift, hit_lid_open_deg: lidHit, defeat_held: held, idle0_vs_bind_max_m: idle0};
      return {data, checks: {
        idle_starts_in_concept_pose: idle0 < 1e-4,
        mallet_cap_hits_floor_at_contact: contact.mallet_min_y >= -1e-4 && contact.mallet_min_y < .02,
        mallet_strikes_in_front: contact.mallet_front_z < -.55 && Math.abs(contact.mallet_centre[0]) < .45,
        mallet_still_falling_before_contact: preContact > contact.mallet_min_y + .05,
        mallet_squashes_on_impact: squash < unsquashed - .02,
        boot_leaves_floor_in_move: bootLift > .08,
        lid_pops_on_hit: lidHit > 20,
        defeat_lies_on_its_back: Math.abs(held.box_up_axis[1]) < .2 && held.box_up_axis[2] > .8,
        wrench_rests_on_floor_in_defeat: held.wrench_min_y >= -1e-4 && held.wrench_min_y < .02,
        boot_kicks_up_in_defeat: held.boot_min_y > .2,
      }};
    },
    durations: {idle: 2, move: .7, attack: 2, hit: .6, defeat: 2.4},
    preview: {center: [.135, .72, 0], half: 1.0, beauty: [4.6, 3.0, -6.8], beautyZoom: .92, motionZoom: .78, compare: [-14, -50, -160], compareZoom: 1.0,
      beats: {idle: [[0, 'concept pose'], [.25, 'bounce'], [.55, 'side-eye'], [.79, 'blink']], move: [[0, 'land'], [.24, 'crouch'], [.6, 'airborne'], [.85, 'touch down']],
        attack: [[.15, 'tell: brows, rattle'], [.48, 'wind-up'], [.6, 'swing'], [.625, 'smash 1.25 s']], hit: [[0, 'rest'], [.15, 'jolt, lid pops'], [.45, 'wobble'], [1, 'settled']],
        defeat: [[.12, 'jolt'], [.28, 'spin, wrench pops'], [.52, 'topple'], [1, 'held: feet up']]}},
  },
};
