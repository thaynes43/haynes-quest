import { it } from "vitest";
import { isAuthoredSurfacePiece, resolveAuthoredLevelDocument, authoredSurfaceTopRange, type AuthoredLevelDocument } from "../../src/shared/authored-level";
import { abilitiesForAge } from "../../src/shared/abilities";
import { lintFamilyChapter, bossRetryRoute } from "../../src/shared/family-world-lint";
import { familyB1Level, FAMILY_B1_MAIN_PATH, FAMILY_B1_BRANCHES } from "../../scripts/levels/family/b1";
import { STAGES } from "../game/authored-traversal-lib";
import { bounceWalkOn, liftWalkIn, R2_STICKS, runGrowthRouteWithWaits } from "../game/family-kid-lib";
import { planCasinoCollectibles } from "../../src/game/casino-tokens";

it("metrics", () => {
  const level = familyB1Level();
  const doc = level as unknown as AuthoredLevelDocument;
  const resolved = resolveAuthoredLevelDocument(doc);
  const surf = doc.pieces.filter(isAuthoredSurfacePiece);
  const out: Record<string, unknown> = {};
  out.surfaces = surf.length;
  out.checkpoints = doc.pieces.filter((p) => p.type === "checkpoint").length;
  out.sweepers = doc.pieces.filter((p) => p.type === "sweeper").length;
  out.movers = surf.filter((p) => p.type === "moving-platform").map((p) => p.id);
  out.lifts = surf.filter((p) => p.type === "lift").map((p) => p.id);
  out.pads = surf.filter((p) => p.type === "bounce-pad").map((p) => p.id);
  out.pieces = doc.pieces.length;
  out.connections = doc.connections.length;
  out.decor = (level.decor ?? []).length;
  out.mainPath = FAMILY_B1_MAIN_PATH.length;
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, maxTop = -Infinity;
  for (const p of surf) {
    minX = Math.min(minX, p.center.x - p.size.x / 2); maxX = Math.max(maxX, p.center.x + p.size.x / 2);
    minZ = Math.min(minZ, p.center.z - p.size.z / 2); maxZ = Math.max(maxZ, p.center.z + p.size.z / 2);
    maxTop = Math.max(maxTop, authoredSurfaceTopRange(p).max);
  }
  out.span = { x: [minX, maxX, maxX - minX], z: [minZ, maxZ, maxZ - minZ] };
  out.maxTop = maxTop;
  const byId = new Map(surf.map((p) => [p.id, p]));
  const prof = FAMILY_B1_MAIN_PATH.map((id) => authoredSurfaceTopRange(byId.get(id)!).max);
  out.requiredClimb = Math.max(...prof) - prof[0]!;
  out.lint = lintFamilyChapter(doc, { world: "b" });
  out.bossRetry = bossRetryRoute(doc);
  for (const stage of STAGES) {
    const run = runGrowthRouteWithWaits(resolved, FAMILY_B1_MAIN_PATH, stage, abilitiesForAge(0));
    out[`run-${stage}`] = { seconds: run.seconds, recoveries: run.recoveries, failedAt: run.failedAt };
    out[`lift-${stage}`] = liftWalkIn(resolved, "toy-elevator", "train-station", "dresser", { phases: 24, stage });
    for (const b of FAMILY_B1_BRANCHES) {
      const r = runGrowthRouteWithWaits(resolved, b, stage, abilitiesForAge(0));
      out[`branch-${b[1]}-${stage}`] = { seconds: r.seconds, recoveries: r.recoveries, failedAt: r.failedAt };
    }
  }
  let sweep = 0, pass = 0;
  for (const [deck, pad, dest] of [["toy-step-3","bed-pad","bounce-block"],["toy-piano","pillow-pad-1","pillow-pile"],["pillow-pile","pillow-pad-2","top-shelf"],["crib-rail","fort-pad","pillow-fort"]] as const)
    for (const stage of STAGES) for (const lateral of [0, 0.6, -0.6]) for (const stick of R2_STICKS) {
      sweep++; if (bounceWalkOn(resolved, deck, pad, dest, { stick, stage, lateral }).reached) pass++;
    }
  out.r2 = `${pass}/${sweep}`;
  out.tickets = planCasinoCollectibles({ authored: doc, course: resolved.course })?.tickets.map((t) => t.platformId);
  console.log(JSON.stringify(out, null, 1));
}, 120000);
