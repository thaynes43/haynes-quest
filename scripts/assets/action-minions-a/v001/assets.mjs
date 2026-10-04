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
  'mischief-kitten-skater': {
    contactFraction: .625, contactProbe: 'skate_FR', bodyBones: ['hips', 'chest'],
    probes: ['skate_FR', 'skate_FL', 'head', 'hat', 'hips', 'tail_5'],
    solids: {
      head: {frame: 'head', min: [-.2, .62, -.37], max: [.2, .98, -.03], shrink: .004},
      torso: {frame: 'hips', min: [-.1, .33, -.08], max: [.1, .47, .2], shrink: .004},
    },
    clearance: {
      skates_vs_head: {of: ['skate_FR', 'skate_FL', 'skate_HR', 'skate_HL', 'axle_FR_f', 'axle_FR_b', 'axle_FL_f', 'axle_FL_b', 'axle_HR_f', 'axle_HR_b', 'axle_HL_f', 'axle_HL_b'], solid: 'head'},
      skates_vs_torso: {of: ['skate_FR', 'skate_FL', 'skate_HR', 'skate_HL', 'axle_FR_f', 'axle_FR_b', 'axle_FL_f', 'axle_FL_b', 'axle_HR_f', 'axle_HR_b', 'axle_HL_f', 'axle_HL_b'], solid: 'torso'},
      tail_vs_head: {of: ['tail_2', 'tail_3', 'tail_4', 'tail_5'], solid: 'head'},
      hat_vs_head: {of: ['hat'], solid: 'head', clips: ['idle', 'move', 'attack', 'hit']},
    },
    beats({at, B, wp, groupBox, T, rest}) {
      const front = ['skate_FR', 'skate_FL', 'axle_FR_f', 'axle_FR_b', 'axle_FL_f', 'axle_FL_b'];
      const contact = at('attack', 1.25, s => { const f = groupBox(s, front); return {front_skates_min_y: f.min.y, front_toe_z: f.min.z, hips: wp(B('hips')).toArray()}; });
      const raised = at('attack', .95, s => groupBox(s, front).min.y);
      const restToe = groupBox(rest, front).min.z;
      let hindLift = 0; for (let i = 0; i <= 48; i++) hindLift = Math.max(hindLift, at('move', .8 * i / 48, s => groupBox(s, ['skate_HR', 'axle_HR_f', 'axle_HR_b']).min.y));
      const q0 = at('move', 0, () => B('axle_FR_f').quaternion.clone()), q1 = at('move', .2, () => B('axle_FR_f').quaternion.clone());
      const hatRest = wp(B('hat')).y; const hatHit = at('hit', .12, () => wp(B('hat')).y - hatRest);
      const held = at('defeat', 2.4, s => { const h = groupBox(s, ['hat']); const head = groupBox(s, ['head']); return {hat_min_y: h.min.y, hat_centre: h.getCenter(new T.Vector3()).toArray(), hat_to_head_m: h.getCenter(new T.Vector3()).distanceTo(head.getCenter(new T.Vector3())), head_min_y: head.min.y, skates_min_y: groupBox(s, ['skate_FR', 'skate_FL', 'skate_HR', 'skate_HL']).min.y}; });
      const wheels0 = groupBox(rest, ['axle_FR_f', 'axle_FR_b', 'axle_FL_f', 'axle_FL_b', 'axle_HR_f', 'axle_HR_b', 'axle_HL_f', 'axle_HL_b']).min.y;
      const idle0 = at('idle', 0, s => Math.max(...s.positions.map((p, i) => p.distanceTo(rest.positions[i]))));
      // exported-bone attachment: the ankle carried by each lower-leg bone vs the skate bone it plugs into
      const legs = ['FR', 'FL', 'HR', 'HL'], local = Object.fromEntries(legs.map(n => [n, wp(B('skate_' + n)).applyMatrix4(B('leg_' + n + '_lo').matrixWorld.clone().invert())]));
      let gap = 0, gapAt = null;
      for (const [clip, dur] of [['idle', 2], ['move', .8], ['attack', 2], ['hit', .6], ['defeat', 2.4]]) for (let i = 0; i <= Math.round(dur * 60); i++) at(clip, i / 60, () => {
        for (const n of legs) { const d = local[n].clone().applyMatrix4(B('leg_' + n + '_lo').matrixWorld).distanceTo(wp(B('skate_' + n))); if (d > gap) { gap = d; gapAt = {clip, time_s: i / 60, leg: n}; } } });
      const data = {ankle_to_skate_max_gap_m: gap, ankle_gap_worst: gapAt, contact, front_skates_min_y_at_0_95_s: raised, rest_front_toe_z: restToe, move_hind_skate_max_lift_m: hindLift, move_wheel_turn_deg_0_to_0_2_s: q0.angleTo(q1) * 180 / Math.PI,
        hit_hat_pop_m: hatHit, defeat_held: held, rest_wheel_min_y: wheels0, idle0_vs_bind_max_m: idle0};
      return {data, checks: {
        idle_starts_in_concept_stance: idle0 < 1e-4,
        legs_stay_plugged_into_skates: gap < .001,
        wheels_touch_floor_at_rest: wheels0 >= -1e-4 && wheels0 < .004,
        front_skates_raised_in_wind_up: raised > .1,
        front_skates_stomp_floor_at_contact: contact.front_skates_min_y >= -1e-4 && contact.front_skates_min_y < .01,
        stomp_lands_in_front: contact.front_toe_z < restToe - .25,
        hind_skate_lifts_in_stroke: hindLift > .03,
        wheels_roll_in_move: q0.angleTo(q1) > .5,
        hat_pops_on_hit: hatHit > .06,
        hat_lands_on_floor_in_defeat: held.hat_min_y >= -1e-4 && held.hat_min_y < .015 && held.hat_to_head_m > .3,
        knocked_out_on_its_side: held.head_min_y < .02,
      }};
    },
    durations: {idle: 2, move: .8, attack: 2, hit: .6, defeat: 2.4},
    preview: {center: [0, .64, .02], half: .78, beauty: [4.6, 3.0, -6.8], beautyZoom: .9, motionZoom: .7, compare: [-38, -68, -150], compareZoom: 1.0,
      beats: {idle: [[0, 'concept stance'], [.31, 'ear flick'], [.6, 'side-eye'], [.895, 'blink']], move: [[0, 'stroke'], [.25, 'push'], [.5, 'stroke'], [.75, 'glide']],
        attack: [[.15, 'tell: crouch, hiss'], [.47, 'rear up'], [.58, 'dash'], [.625, 'stomp 1.25 s']], hit: [[0, 'rest'], [.2, 'recoil, hat pops'], [.5, 'settle'], [1, 'settled']],
        defeat: [[.06, 'hat flies'], [.3, 'skates slide, spin'], [.55, 'flop'], [1, 'held: knocked out']]}},
  },
};
