// WO-033 probe R-7: the memory-released reward checkpoint is replaced by boss-landing when
// the player walks back north, because createGame leaves checkpointId null.
import { createObbyCourse } from "../../../src/game/obby-layout";
import { createObbyState, stepObby } from "../../../src/game/obby";

const course = createObbyCourse("gentle-jump-v1");
const HZ = 60;
const state = createObbyState({ x: 0, y: 0, z: -22 }); // standing by the fallen boss
state.grounded = true;
// What createGame.applySave does on the memory-released transition for a course level.
state.checkpoint = { x: 0, y: 0, z: -23.5 };
state.checkpointId = null;

let time = 0;
for (let frame = 0; frame < HZ * 4; frame += 1) {
  time += 1 / HZ;
  stepObby(state, { moveX: 0, moveY: -1 }, course, {
    deltaSeconds: 1 / HZ,
    timeSeconds: time,
    cameraYaw: 0,
    canJump: true,
    jumpPressed: false,
    radius: 0.24,
    height: 1.22,
  });
}
console.log(
  `after walking north for 4 s: position z=${state.position.z.toFixed(2)}, ` +
    `checkpointId=${state.checkpointId}, checkpoint z=${state.checkpoint.z} (reward point was -23.5)`,
);
