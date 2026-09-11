/**
 * WO-033 review regression (finding R-5). The runtime records an enemy contact
 * whenever `EnemySimulation.step` reports one, and `flushPendingHit` dispatches it
 * with no grounded/support check, unlike `validStrike`. On `gentle-jump-v1` the
 * `ordinary-a` arena ends 0.6 m from the south lip of `first-clearing-island`, so a
 * child who steps off the lip during the enemy's wind-up is struck while already
 * falling into the gap: one mis-step costs both a local reset and a server
 * `take-hit`. This mirrors createGame's per-frame order exactly (stepObby,
 * resolvePlayerCollision, enemies.step) with the authored course and real enemy
 * tuning. Marked `fails` because it reproduces the defect at eaa7eb3; flip to `it`
 * once an airborne, unsupported player cannot be struck.
 */
import { describe, expect, it } from "vitest";
import { EnemySimulation } from "../../src/game/combat";
import { getAvatarProportions } from "../../src/game/controller";
import { createLevelLayout } from "../../src/game/level";
import { createObbyState, sampleObby, stepObby } from "../../src/game/obby";
import type { PositionSnapshot } from "../../src/game/types";
import type { SaveView } from "../../src/shared/contracts";
import { makeEraSave } from "../game/fixtures";

const dt = 1 / 60;

function routedJumpSave(): SaveView {
  const save = makeEraSave({ levelIndex: 1 });
  const adventure = save.adventure!;
  return {
    ...save,
    adventure: {
      ...adventure,
      activeLevel: { ...adventure.activeLevel!, routeId: "gentle-jump-v1" },
    },
  };
}

interface AirborneContact {
  timeSeconds: number;
  encounterId: string;
  position: PositionSnapshot;
  supported: boolean;
}

/** Walk to the south lip beside ordinary-a, dwell while it winds up, then step off. */
function stepOffLipAfter(dwellSeconds: number): AirborneContact[] {
  const save = routedJumpSave();
  const level = createLevelLayout(save);
  const course = level.course!;
  const body = getAvatarProportions(save.appearance.stage);
  const reach = body.colliderRadius * 0.6;
  const enemies = new EnemySimulation(level, save);
  const player = createObbyState({ x: 0, y: 0, z: -8.6 });
  player.grounded = true;
  const supported = (position: PositionSnapshot, time: number): boolean =>
    sampleObby(course, time).platforms.some(
      (box) =>
        Math.abs(position.x - box.center.x) <= box.size.x / 2 + reach &&
        Math.abs(position.z - box.center.z) <= box.size.z / 2 + reach &&
        Math.abs(box.center.y + box.size.y / 2 - position.y) <= 0.016,
    );
  const airborne: AirborneContact[] = [];
  let courseTime = 0;
  for (let frame = 0; frame * dt < dwellSeconds + 1.2; frame += 1) {
    const elapsed = frame * dt;
    courseTime += dt;
    const holdAtLip = elapsed < dwellSeconds;
    const input = { moveX: 0, moveY: holdAtLip ? (player.position.z > -9.4 ? 1 : 0) : 1 };
    stepObby(player, input, course, {
      deltaSeconds: dt,
      timeSeconds: courseTime,
      cameraYaw: 0,
      canJump: true,
      jumpPressed: false,
      radius: body.colliderRadius,
      height: body.height,
    });
    if (player.recoveryRemaining <= 0) enemies.resolvePlayerCollision(player.position, level);
    const contacts = enemies.step(
      { player: player.position, deltaSeconds: dt, active: player.recoveryRemaining <= 0 },
      save,
    );
    if (contacts[0] && !player.grounded && player.position.y < -0.001) {
      airborne.push({
        timeSeconds: courseTime,
        encounterId: contacts[0],
        position: { ...player.position },
        supported: supported(player.position, courseTime),
      });
    }
  }
  return airborne;
}

describe("enemy strikes and gap falls", () => {
  it.fails("does not record a contact against a player who has already left the island", () => {
    // 2.35 s of dwell lines the step-off up with ordinary-a's strike frame.
    const contacts = stepOffLipAfter(2.35);
    expect(contacts.filter((contact) => !contact.supported)).toEqual([]);
  });
});
