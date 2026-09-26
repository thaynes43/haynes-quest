/**
 * CasinoScene's automatic venue decor must never sit in the chase camera's
 * sightline. Each wide deck gets a theatre portal beam above its far edge,
 * sized for the flat Rat Casino, where the next room stands at about the
 * same height. World A's casino finale (family-world-a) climbs, so a beam
 * sized from its own deck alone hung inside the camera once the player had
 * landed on a higher next deck (backstage 7.7 m -> Projection Balcony 9.7 m).
 *
 * The sweep stands a child at points along the middle of every main-path
 * deck, with the camera at its chapter-start yaw (behind, +z) at the default
 * and the widest growth distance, and casts the camera-to-target line
 * against the venue decor.
 */
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import familyWorldAV2 from "../../src/shared/levels/family-world-a-v2.json";
import { CasinoScene } from "../../src/game/casino-scene";
import { getAvatarProportions } from "../../src/game/controller";
import type { LevelLayout } from "../../src/game/level";
import type { SceneAssets } from "../../src/game/scene-assets";
import { growthCameraScale } from "../../src/shared/abilities";
import {
  resolveLevelEditorProject,
  type LevelEditorChapterV2,
} from "../../src/shared/editor-project";
import type { ResolvedAuthoredLevel } from "../../src/shared/authored-level";

const PITCH = 0.4;
const DISTANCE = 4.9;

function casinoFor(level: ResolvedAuthoredLevel): CasinoScene {
  const document = level.document;
  const layout = {
    id: document.id,
    routeId: document.id,
    authored: document,
    course: level.course,
    checkpoint: document.anchors.spawn.position,
    finish: document.anchors.finish.position,
    memories: [],
    pickups: [],
    encounters: Object.entries(document.anchors.encounters).map(([slot, anchor]) => ({
      id: slot,
      role: slot === "boss" ? "boss" : "ordinary",
      kind: anchor.kind,
      position: anchor.position,
      arena: anchor.arena,
    })),
    step: null,
    minX: -60,
    maxX: 20,
    minZ: -160,
    maxZ: 10,
  } as unknown as LevelLayout;
  const assets = { attach: () => undefined, attachInstances: () => undefined } as unknown as SceneAssets;
  const scene = new CasinoScene(layout, assets, () => true, true);
  scene.root.updateMatrixWorld(true);
  return scene;
}

/** Main-path deck points whose camera line crosses the venue decor. */
function blockedSightlines(level: ResolvedAuthoredLevel): string[] {
  const venue = casinoFor(level).root.getObjectByName("casino-venue-decor")!;
  const dims = getAvatarProportions("child");
  const blocked: string[] = [];
  const statics = new Set(level.document.pieces.filter((piece) => piece.type === "platform").map((piece) => piece.id));
  for (const id of level.document.mainPath) {
    if (!statics.has(id)) continue;
    const deck = level.course.platforms.find((platform) => platform.id === id)!;
    const top = deck.center.y + deck.size.y / 2;
    // The lane a child walks: the room-edge portal columns and the boss
    // stage's side curtains frame the rooms from outside it.
    for (const u of [0.3, 0.5, 0.7])
      for (let v = 0.05; v < 1; v += 0.15) {
        const x = deck.center.x - deck.size.x / 2 + u * deck.size.x;
        const z = deck.center.z - deck.size.z / 2 + v * deck.size.z;
        for (const scale of [1, growthCameraScale(1.6)]) {
          const target = new THREE.Vector3(x, top + dims.cameraTargetHeight + 0.3, z - 0.5);
          const camera = new THREE.Vector3(
            x,
            top + dims.cameraTargetHeight + Math.sin(PITCH) * DISTANCE * scale,
            z + Math.cos(PITCH) * DISTANCE * scale,
          );
          const direction = target.clone().sub(camera);
          const ray = new THREE.Raycaster(camera, direction.clone().normalize(), 0, direction.length());
          if (ray.intersectObject(venue, true).length > 0) {
            blocked.push(`${id}@(${x.toFixed(1)},${z.toFixed(1)})x${scale.toFixed(2)}`);
            break;
          }
        }
      }
  }
  return blocked;
}

describe("CasinoScene venue decor and the chase camera", () => {
  const { project, levels } = resolveLevelEditorProject(familyWorldAV2);
  const casino = (project.chapters as LevelEditorChapterV2[]).find((chapter) => chapter.level.theme === "casino")!;

  it("keeps every portal beam out of the camera's sightline across World A's casino finale", () => {
    expect(blockedSightlines(levels[casino.routeId]!)).toEqual([]);
  });
});
