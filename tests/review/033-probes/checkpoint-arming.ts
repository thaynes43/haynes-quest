// WO-033 probe R-6: which lanes on the authored gentle-jump-v1 course arm first-clearing?
import { createObbyCourse } from "../../../src/game/obby-layout";
import { createObbyState, stepObby } from "../../../src/game/obby";

const course = createObbyCourse("gentle-jump-v1");
const HZ = 60;
const child = { radius: 0.24, height: 1.22 }; // getAvatarProportions("child")

function run(laneX: number) {
  const state = createObbyState({ x: laneX, y: 0, z: 1 });
  state.grounded = true;
  let time = 0;
  let jumpedFirstGap = false;
  const armed: string[] = [];
  let recoveredTo: number | null = null;
  for (let frame = 0; frame < HZ * 20; frame += 1) {
    time += 1 / HZ;
    // A naive child: hold forward, jump once 0.3 m before the first gap, forget the second.
    let jumpPressed = false;
    if (!jumpedFirstGap && state.position.z <= -3.2) {
      jumpPressed = true;
      jumpedFirstGap = true;
    }
    const result = stepObby(state, { moveX: 0, moveY: 1 }, course, {
      deltaSeconds: 1 / HZ,
      timeSeconds: time,
      cameraYaw: 0,
      canJump: true,
      jumpPressed,
      radius: child.radius,
      height: child.height,
    });
    if (result.checkpointChanged && state.checkpointId && !armed.includes(state.checkpointId)) {
      armed.push(state.checkpointId);
    }
    if (result.recovered) {
      recoveredTo = state.position.z;
      break;
    }
  }
  return { armed, recoveredTo };
}

for (const laneX of [0, 0.3, 0.6, 0.7, 1, 1.5, 2, 3, 4, 5]) {
  const { armed, recoveredTo } = run(laneX);
  const where = recoveredTo === null ? "no fall" : recoveredTo > 0 ? "START (redo gap 1)" : "first-clearing";
  console.log(`lane x=${laneX.toFixed(1).padStart(4)}  armed=${JSON.stringify(armed).padEnd(28)} fall at gap 2 -> ${where}`);
}
const ring = course.checkpoints.find((checkpoint) => checkpoint.id === "first-clearing")!;
const island = course.platforms.find((platform) => platform.id === "first-clearing-island")!;
console.log(
  `\nfirst-clearing ring diameter ${(2 * ring.triggerRadius).toFixed(2)} m on a ${island.size.x} m wide island: ` +
    `${(((2 * ring.triggerRadius) / island.size.x) * 100).toFixed(0)}% of the walkable width arms it`,
);
