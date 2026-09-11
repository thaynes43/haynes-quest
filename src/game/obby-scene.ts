import * as THREE from "three";
import { sampleObby, type ObbyCourse, type ObbySample } from "./obby";
import { groundRing, material, shapeMesh } from "./scene-art";

/** Course surfaces and hazards use the exact sampled collision dimensions. */
export class ObbyScene {
  readonly root = new THREE.Group();
  private platforms = new Map<string, THREE.Group>();
  private hazards = new Map<string, THREE.Group>();
  private checkpoints = new Map<string, THREE.Mesh>();

  constructor(course: ObbyCourse, later: boolean) {
    this.root.name = "obstacle-course";
    for (const platform of course.platforms) {
      const root = new THREE.Group();
      root.name = `platform-${platform.id}`;
      const ferry = Boolean(platform.motion);
      const { x: width, y: depth, z: length } = platform.size;
      const side = material(ferry ? 0x38a9b5 : later ? 0xb787b3 : 0xb98b55);
      const top = material(ferry ? 0xffd669 : later ? 0xf6ddcf : 0x8fbb70);
      const floor = shapeMesh(new THREE.BoxGeometry(width, depth, length), [
        side,
        side,
        top,
        side,
        side,
        side,
      ]);
      root.add(floor);
      // Painted edge strips sit on the box top, leaving the gap fully visible.
      for (const z of [-length / 2 + 0.08, length / 2 - 0.08]) {
        root.add(
          shapeMesh(
            new THREE.BoxGeometry(width, 0.008, 0.16),
            material(ferry ? 0xfff5c6 : later ? 0xd687a5 : 0xf8e4a1),
            [0, depth / 2 + 0.004, z],
          ),
        );
      }
      if (later && !ferry) {
        root.add(
          shapeMesh(
            new THREE.BoxGeometry(2.2, 0.01, Math.max(0.1, length - 0.4)),
            material(0xeeb5c6),
            [0, depth / 2 + 0.005, 0],
          ),
        );
        for (const x of [-1.12, 1.12])
          root.add(
            shapeMesh(
              new THREE.BoxGeometry(0.045, 0.012, Math.max(0.1, length - 0.4)),
              material(0xffefb1),
              [x, depth / 2 + 0.006, 0],
            ),
          );
      }
      if (ferry) {
        for (const z of [-0.45, 0, 0.45])
          root.add(
            shapeMesh(
              new THREE.BoxGeometry(width - 0.15, 0.008, 0.022),
              material(0xd99845),
              [0, depth / 2 + 0.01, z],
            ),
          );
      }
      this.platforms.set(platform.id, root);
      this.root.add(root);
    }
    for (const hazard of course.hazards) {
      const root = new THREE.Group();
      root.name = `hazard-${hazard.id}`;
      const bar = shapeMesh(
        new THREE.CapsuleGeometry(hazard.radius, hazard.halfLength * 2, 5, 16),
        material(later ? 0xb586d4 : 0xe99374),
      );
      bar.rotation.z = Math.PI / 2;
      root.add(bar);
      for (const x of [
        -hazard.halfLength * 0.65,
        0,
        hazard.halfLength * 0.65,
      ]) {
        const band = shapeMesh(
          new THREE.CylinderGeometry(
            hazard.radius + 0.002,
            hazard.radius + 0.002,
            0.15,
            16,
          ),
          material(0xffde83),
          [x, 0, 0],
        );
        band.rotation.z = Math.PI / 2;
        root.add(band);
      }
      this.hazards.set(hazard.id, root);
      this.root.add(root);
    }
    for (const checkpoint of course.checkpoints) {
      const marker = groundRing(checkpoint.triggerRadius, 0xfff1a6, 0.65);
      marker.name = `checkpoint-${checkpoint.id}`;
      marker.position.set(
        checkpoint.position.x,
        checkpoint.position.y + 0.012,
        checkpoint.position.z,
      );
      this.checkpoints.set(checkpoint.id, marker);
      this.root.add(marker);
    }
    this.update(sampleObby(course, 0), null);
  }

  update(sample: ObbySample, checkpointId: string | null): void {
    for (const platform of sample.platforms) {
      this.platforms
        .get(platform.id)
        ?.position.set(platform.center.x, platform.center.y, platform.center.z);
    }
    for (const hazard of sample.hazards) {
      const root = this.hazards.get(hazard.id);
      if (!root) continue;
      root.position.set(hazard.center.x, hazard.center.y, hazard.center.z);
      root.rotation.y = hazard.angle;
    }
    for (const [id, marker] of this.checkpoints) {
      const surface = marker.material as THREE.MeshBasicMaterial;
      surface.color.setHex(id === checkpointId ? 0x8ce6b7 : 0xfff1a6);
      surface.opacity = id === checkpointId ? 0.9 : 0.65;
    }
  }
}
