import * as THREE from "three";
import { sampleObby, type ObbyCourse, type ObbySample } from "./obby";
import { groundRing, material, shapeMesh } from "./scene-art";
import type { ObbyVisualPalette } from "./world-themes";

/** Course surfaces and hazards use the exact sampled collision dimensions. */
export class ObbyScene {
  readonly root = new THREE.Group();
  private platforms = new Map<string, THREE.Group>();
  private hazards = new Map<string, THREE.Group>();
  private checkpoints = new Map<string, THREE.Mesh>();

  constructor(
    course: ObbyCourse,
    private readonly palette: ObbyVisualPalette,
  ) {
    this.root.name = "obstacle-course";
    for (const platform of course.platforms) {
      const root = new THREE.Group();
      root.name = `platform-${platform.id}`;
      const ferry = Boolean(platform.motion);
      const { x: width, y: depth, z: length } = platform.size;
      const side = material(ferry ? palette.ferrySide : palette.platformSide);
      const top = material(ferry ? palette.ferryTop : palette.platformTop);
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
            material(ferry ? palette.ferryEdge : palette.platformEdge),
            [0, depth / 2 + 0.004, z],
          ),
        );
      }
      if (!ferry && palette.platformCenter !== null) {
        root.add(
          shapeMesh(
            new THREE.BoxGeometry(2.2, 0.01, Math.max(0.1, length - 0.4)),
            material(palette.platformCenter),
            [0, depth / 2 + 0.005, 0],
          ),
        );
      }
      if (!ferry && palette.platformRails !== null) {
        for (const x of [-1.12, 1.12])
          root.add(
            shapeMesh(
              new THREE.BoxGeometry(0.045, 0.012, Math.max(0.1, length - 0.4)),
              material(palette.platformRails),
              [x, depth / 2 + 0.006, 0],
            ),
          );
      }
      if (ferry) {
        for (const z of [-0.45, 0, 0.45])
          root.add(
            shapeMesh(
              new THREE.BoxGeometry(width - 0.15, 0.008, 0.022),
              material(palette.ferryDetail),
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
        material(palette.hazard),
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
          material(palette.hazardBand),
          [x, 0, 0],
        );
        band.rotation.z = Math.PI / 2;
        root.add(band);
      }
      this.hazards.set(hazard.id, root);
      this.root.add(root);
    }
    for (const checkpoint of course.checkpoints) {
      const strip = checkpoint.triggerHalfExtents;
      const marker = strip
        ? new THREE.Mesh(
            new THREE.PlaneGeometry(strip.x * 2, strip.z * 2),
            new THREE.MeshBasicMaterial({
              color: palette.checkpointInactive,
              transparent: true,
              opacity: 0.35,
              depthWrite: false,
            }),
          )
        : groundRing(
            checkpoint.triggerRadius,
            palette.checkpointInactive,
            0.65,
          );
      if (strip) marker.rotation.x = -Math.PI / 2;
      marker.userData.strip = Boolean(strip);
      marker.name = `checkpoint-${checkpoint.id}`;
      marker.position.set(
        checkpoint.position.x,
        checkpoint.position.y + (strip ? 0.045 : 0.012),
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
      surface.color.setHex(
        id === checkpointId
          ? this.palette.checkpointActive
          : this.palette.checkpointInactive,
      );
      surface.opacity = marker.userData.strip
        ? id === checkpointId
          ? 0.55
          : 0.35
        : id === checkpointId
          ? 0.9
          : 0.65;
    }
  }
}
