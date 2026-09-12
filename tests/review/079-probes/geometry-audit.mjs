import { readFileSync } from "node:fs";

const docs = ["garden-playground-v1", "besties-playground-v1"].map((id) => ({
  id,
  d: JSON.parse(readFileSync(`src/shared/levels/${id}.json`, "utf8")),
}));

const ORD_REACH = 1.35, BOSS_REACH = 2.25, R = 0.3;

for (const { id, d } of docs) {
  console.log(`\n======== ${id} ========`);
  const plats = new Map(d.pieces.filter(p => p.type !== "sweeper" && p.type !== "checkpoint").map(p => [p.id, p]));
  const hazards = d.pieces.filter(p => p.type === "sweeper");
  const bounds = (p) => {
    const mx = p.motion?.axis === "x" ? p.motion.distance : 0;
    const mz = p.motion?.axis === "z" ? p.motion.distance : 0;
    return { minX: p.center.x - p.size.x/2 - mx, maxX: p.center.x + p.size.x/2 + mx,
             minZ: p.center.z - p.size.z/2 - mz, maxZ: p.center.z + p.size.z/2 + mz };
  };
  const top = (p) => p.center.y + p.size.y/2;

  // main path traversal corridor: for each consecutive pair, compute takeoff & landing bands.
  console.log("-- main path edges --");
  for (let i = 0; i + 1 < d.mainPath.length; i++) {
    const a = plats.get(d.mainPath[i]), b = plats.get(d.mainPath[i+1]);
    const conn = d.connections.find(c => c.from === a.id && c.to === b.id);
    const gapX = Math.max(0, Math.abs(a.center.x-b.center.x) + (a.motion?.axis==="x"?a.motion.distance:0) + (b.motion?.axis==="x"?b.motion.distance:0) - a.size.x/2 - b.size.x/2);
    const gapZ = Math.max(0, Math.abs(a.center.z-b.center.z) + (a.motion?.axis==="z"?a.motion.distance:0) + (b.motion?.axis==="z"?b.motion.distance:0) - a.size.z/2 - b.size.z/2);
    const gap = Math.hypot(gapX, gapZ);
    const rise = Math.abs(top(a) - top(b));
    console.log(` ${conn?.mode ?? "MISSING"} ${a.id} -> ${b.id}  gap=${gap.toFixed(3)} rise=${rise.toFixed(3)}`);
  }

  // encounter strike envelopes vs. the *landing* strip of every main-path edge
  const encs = Object.entries(d.anchors.encounters);
  const strike = ([slot, e]) => {
    const r = slot === "boss" ? BOSS_REACH : ORD_REACH;
    return { slot, minX: e.arena.minX - r, maxX: e.arena.maxX + r, minZ: e.arena.minZ - r, maxZ: e.arena.maxZ + r };
  };
  const overlap = (a, b) => a.minX <= b.maxX && a.maxX >= b.minX && a.minZ <= b.maxZ && a.maxZ >= b.minZ;

  console.log("-- jump landing / takeoff strips inside an encounter strike envelope --");
  for (let i = 0; i + 1 < d.mainPath.length; i++) {
    const a = plats.get(d.mainPath[i]), b = plats.get(d.mainPath[i+1]);
    const conn = d.connections.find(c => c.from === a.id && c.to === b.id);
    if (!conn || conn.mode === "walk") continue;
    // approximate: the closest strip of B to A (1m deep) is the landing zone; likewise for A's takeoff strip
    const zone = (p, other, label) => {
      const P = bounds(p), O = bounds(other);
      let z0, z1, x0 = Math.max(P.minX, O.minX - 1.4), x1 = Math.min(P.maxX, O.maxX + 1.4);
      if (p.center.z < other.center.z) { z1 = P.maxZ; z0 = P.maxZ - 1; } else { z0 = P.minZ; z1 = P.minZ + 1; }
      return { label, minX: Math.max(P.minX, x0), maxX: Math.min(P.maxX, x1), minZ: z0, maxZ: z1 };
    };
    const takeoff = zone(a, b, `${a.id}(takeoff)`);
    const landing = zone(b, a, `${b.id}(landing)`);
    for (const strip of [takeoff, landing]) {
      for (const e of encs) {
        const s = strike(e);
        if (overlap(strip, s)) console.log(`  ${strip.label} x[${strip.minX.toFixed(1)},${strip.maxX.toFixed(1)}] z[${strip.minZ.toFixed(1)},${strip.maxZ.toFixed(1)}] overlaps ${s.slot} strike x[${s.minX},${s.maxX}] z[${s.minZ},${s.maxZ}]`);
      }
      for (const h of hazards) {
        const tx = h.motion?.axis === "x" ? h.motion.distance : 0;
        const tz = h.motion?.axis === "z" ? h.motion.distance : 0;
        const rx = h.halfLength + h.radius;
        const rz = h.rotation ? h.halfLength + h.radius : h.radius;
        const env = { minX: h.center.x-tx-rx, maxX: h.center.x+tx+rx, minZ: h.center.z-tz-rz, maxZ: h.center.z+tz+rz };
        if (overlap(strip, env)) console.log(`  ${strip.label} overlaps hazard ${h.id} x[${env.minX.toFixed(2)},${env.maxX.toFixed(2)}] z[${env.minZ.toFixed(2)},${env.maxZ.toFixed(2)}]`);
      }
    }
  }

  console.log("-- arena vs arena overlap --");
  for (let i = 0; i < encs.length; i++) for (let j = i+1; j < encs.length; j++) {
    if (overlap(encs[i][1].arena, encs[j][1].arena)) console.log(`  ${encs[i][0]} overlaps ${encs[j][0]}`);
  }

  console.log("-- required anchors inside a strike envelope (not just an arena) --");
  const named = [
    ["spawn", d.anchors.spawn], ["finish", d.anchors.finish], ["rewardRespawn", d.anchors.rewardRespawn],
    ...Object.entries(d.anchors.pickups), ...Object.entries(d.anchors.memories),
    ...Object.entries(d.anchors.friendlies),
  ];
  for (const [k, a] of named) {
    const env = { minX: a.position.x-R, maxX: a.position.x+R, minZ: a.position.z-R, maxZ: a.position.z+R };
    for (const e of encs) { const s = strike(e); if (overlap(env, s)) console.log(`  ${k} @(${a.position.x},${a.position.z}) inside ${s.slot} strike envelope`); }
  }

  console.log("-- main-path index of every required anchor --");
  const mi = new Map(d.mainPath.map((p, i) => [p, i]));
  for (const [k, a] of [...named, ...encs.map(([s,e])=>[`enc:${s}`, e])])
    console.log(`  ${k.padEnd(16)} plat=${a.platformId.padEnd(18)} idx=${mi.get(a.platformId)} z=${a.position.z}`);
}
