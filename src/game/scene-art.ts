import * as THREE from "three";
import type { EncounterKind, EquipmentKind } from "../shared/contracts";

export const palettes = {
  orchard: {
    sky: 0xe9ddc3,
    grass: 0x668061,
    leaf: 0x467359,
    light: 0xffdc9b,
    accent: 0xf5c66c,
    mist: 0xc8cbb1,
  },
  fair: {
    sky: 0x555975,
    grass: 0x456369,
    leaf: 0x596e89,
    light: 0xfbd6bd,
    accent: 0xb9a6fa,
    mist: 0x72718b,
  },
};

export function material(
  color: number,
  emissive = 0,
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    emissive,
    roughness: 0.83,
    metalness: 0.03,
  });
}

export function shapeMesh(
  geometry: THREE.BufferGeometry,
  mat: THREE.Material,
  position: [number, number, number] = [0, 0, 0],
): THREE.Mesh {
  const object = new THREE.Mesh(geometry, mat);
  object.position.set(...position);
  object.castShadow = true;
  object.receiveShadow = true;
  return object;
}

function roundedBox(
  width: number,
  height: number,
  depth: number,
): THREE.ExtrudeGeometry {
  const radius = Math.min(width, height, depth) * 0.12;
  const x = width / 2 - radius,
    y = height / 2 - radius;
  const shape = new THREE.Shape();
  shape.moveTo(-x, -y);
  shape.lineTo(x, -y);
  shape.lineTo(x, y);
  shape.lineTo(-x, y);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: depth - radius * 2,
    bevelEnabled: true,
    bevelSegments: 2,
    bevelSize: radius,
    bevelThickness: radius,
    curveSegments: 2,
    steps: 1,
  });
  geometry.translate(0, 0, -depth / 2 + radius);
  return geometry;
}

function leafShape(width: number, height: number): THREE.Shape {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(width, height * 0.1, width, height * 0.68, 0, height);
  shape.bezierCurveTo(
    -width * 0.55,
    height * 0.54,
    -width * 0.5,
    height * 0.15,
    0,
    0,
  );
  return shape;
}

function eyes(
  root: THREE.Group,
  y: number,
  z: number,
  separation: number,
  size: number,
  color = 0xffd778,
): void {
  for (const side of [-1, 1]) {
    root.add(
      shapeMesh(
        new THREE.SphereGeometry(size * 1.3, 12, 8),
        material(0x463335),
        [separation * side, y, z],
      ),
    );
    root.add(
      shapeMesh(new THREE.SphereGeometry(size, 12, 8), material(color, color), [
        separation * side,
        y,
        z - size * 0.6,
      ]),
    );
  }
}

/** Temporary encounter studies. The separate Blender candidates remain unapproved. */
export function createEncounterStudy(
  kind: EncounterKind,
  laterEra: boolean,
): THREE.Group {
  const root = new THREE.Group();
  root.name = `encounter-study-${laterEra ? "2024" : "2020"}-${kind}`;
  const wood = material(0x785139),
    gold = material(0xc59851),
    plum = material(0x66516f),
    leaf = material(0x537458);
  const glow = material(
    laterEra ? 0xb7a3f2 : 0xe2b35a,
    laterEra ? 0x463567 : 0x5f3d11,
  );
  const motion = new THREE.Group();
  motion.name = "motion";
  root.add(motion);
  if (kind === "ordinary-a" && !laterEra) {
    const body = shapeMesh(roundedBox(0.52, 0.32, 0.65), wood, [0, 0.33, 0.06]);
    motion.add(body);
    const head = shapeMesh(
      new THREE.CylinderGeometry(0.33, 0.32, 0.28, 5),
      wood.clone(),
      [0, 0.64, -0.21],
    );
    head.rotation.x = Math.PI / 2;
    head.rotation.z = 0.17;
    motion.add(head);
    eyes(motion, 0.64, -0.365, 0.115, 0.044);
    for (const side of [-1, 1])
      for (const end of [-1, 1]) {
        const leg = new THREE.Group();
        leg.name = `leg-${side}-${end}`;
        leg.position.set(side * 0.25, 0.23, end * 0.25);
        leg.add(
          shapeMesh(roundedBox(0.13, 0.23, 0.14), wood.clone(), [0, -0.06, 0]),
        );
        leg.add(
          shapeMesh(roundedBox(0.2, 0.1, 0.22), gold.clone(), [
            side * 0.02,
            -0.18,
            -0.04,
          ]),
        );
        motion.add(leg);
      }
    for (let i = 0; i < 3; i++) {
      const sprout = shapeMesh(
        new THREE.ShapeGeometry(leafShape(0.09, 0.23)),
        leaf.clone(),
        [(i - 1) * 0.08, 0.83, -0.17],
      );
      (sprout.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
      sprout.rotation.z = (i - 1) * 0.65;
      motion.add(sprout);
    }
    for (const side of [-1, 1]) {
      const plate = shapeMesh(roundedBox(0.23, 0.12, 0.37), gold.clone(), [
        side * 0.32,
        0.43,
        -0.05,
      ]);
      plate.rotation.z = side * 0.35;
      motion.add(plate);
    }
  } else if (kind === "ordinary-b" && !laterEra) {
    const thorax = shapeMesh(
      new THREE.SphereGeometry(0.2, 16, 12),
      wood,
      [0, 0.65, 0],
    );
    thorax.scale.set(1, 1.3, 0.7);
    motion.add(thorax);
    eyes(motion, 0.8, -0.115, 0.09, 0.05, 0x9984bd);
    for (const side of [-1, 1])
      for (const upper of [false, true]) {
        const wing = new THREE.Group();
        wing.name = `wing-${side}-${upper}`;
        wing.position.set(side * 0.12, 0.7, 0.04);
        const outline = new THREE.ExtrudeGeometry(
          leafShape(0.16, upper ? 0.54 : 0.38),
          {
            depth: 0.035,
            bevelEnabled: true,
            bevelSize: 0.015,
            bevelThickness: 0.008,
            bevelSegments: 2,
            steps: 1,
            curveSegments: 8,
          },
        );
        wing.add(shapeMesh(outline, gold.clone()));
        const pane = shapeMesh(
          new THREE.ShapeGeometry(leafShape(0.125, upper ? 0.45 : 0.3)),
          glow.clone(),
          [0, 0.035, -0.01],
        );
        (pane.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
        wing.add(pane);
        wing.rotation.z = side * (upper ? -0.85 : -2.2);
        motion.add(wing);
      }
    for (const side of [-1, 1]) {
      const antenna = shapeMesh(
        new THREE.TorusGeometry(0.09, 0.012, 6, 16, Math.PI * 1.4),
        gold.clone(),
        [side * 0.12, 1.02, 0],
      );
      antenna.rotation.z = side * -0.6;
      motion.add(antenna);
    }
  } else if (kind === "boss" && !laterEra) {
    const body = shapeMesh(
      new THREE.CylinderGeometry(0.36, 0.58, 1.0, 10),
      wood,
      [0, 0.83, 0],
    );
    motion.add(body);
    for (let i = 0; i < 10; i++) {
      const angle = (i * Math.PI) / 5;
      const rib = shapeMesh(
        new THREE.CylinderGeometry(0.025, 0.03, 1.04, 6),
        gold.clone(),
        [Math.sin(angle) * 0.44, 0.85, Math.cos(angle) * 0.44],
      );
      rib.rotation.z = Math.sin(angle) * 0.13;
      motion.add(rib);
    }
    const mask = shapeMesh(roundedBox(0.5, 0.5, 0.13), plum, [0, 1.07, -0.43]);
    mask.rotation.z = 0.06;
    motion.add(mask);
    eyes(motion, 1.1, -0.51, 0.13, 0.06);
    const halo = new THREE.Group();
    halo.name = "halo";
    halo.position.y = 1.55;
    for (let i = 0; i < 8; i++) {
      const arc = shapeMesh(
        new THREE.TorusGeometry(0.4, 0.06, 8, 8, 0.5),
        i % 2 ? gold.clone() : glow.clone(),
      );
      arc.rotation.z = (i * Math.PI) / 4;
      halo.add(arc);
    }
    motion.add(halo);
    for (const side of [-1, 1]) {
      const arm = new THREE.Group();
      arm.name = `arm-${side}`;
      arm.position.set(side * 0.54, 1.04, 0);
      const forearm = shapeMesh(roundedBox(0.23, 0.58, 0.24), wood.clone(), [
        side * 0.09,
        -0.18,
        0,
      ]);
      forearm.rotation.z = side * 0.3;
      arm.add(forearm);
      arm.add(
        shapeMesh(new THREE.SphereGeometry(0.16, 12, 8), gold.clone(), [
          side * 0.18,
          -0.5,
          0,
        ]),
      );
      motion.add(arm);
    }
  } else if (kind === "ordinary-a") {
    const body = shapeMesh(
      new THREE.CylinderGeometry(0.15, 0.24, 0.43, 8),
      plum,
      [0, 0.55, 0],
    );
    motion.add(body);
    motion.add(
      shapeMesh(new THREE.SphereGeometry(0.22, 16, 12), gold, [0, 0.96, -0.02]),
    );
    eyes(motion, 0.98, -0.18, 0.075, 0.037, 0xacdbd1);
    for (const side of [-1, 1]) {
      const leg = shapeMesh(
        new THREE.CylinderGeometry(0.055, 0.08, 0.31, 8),
        wood.clone(),
        [side * 0.13, 0.17, 0],
      );
      leg.name = `dancer-leg-${side}`;
      motion.add(leg);
      const ribbon = shapeMesh(
        new THREE.TorusGeometry(0.32, 0.043, 8, 32, Math.PI * 1.75),
        glow.clone(),
        [side * 0.29, 0.7, 0],
      );
      ribbon.rotation.y = side * 0.3;
      ribbon.rotation.z = side;
      ribbon.name = `ribbon-${side}`;
      motion.add(ribbon);
    }
    const hat = shapeMesh(
      new THREE.ConeGeometry(0.23, 0.35, 5),
      plum.clone(),
      [0, 1.25, 0],
    );
    hat.rotation.z = -0.2;
    motion.add(hat);
  } else if (kind === "ordinary-b") {
    const body = shapeMesh(
      new THREE.SphereGeometry(0.3, 12, 8),
      plum,
      [0, 0.37, 0.1],
    );
    body.scale.set(0.8, 0.8, 1.35);
    motion.add(body);
    const mask = shapeMesh(
      new THREE.ConeGeometry(0.3, 0.48, 5),
      material(0x99b7c5),
      [0, 0.66, -0.22],
    );
    mask.rotation.x = -Math.PI / 2;
    motion.add(mask);
    eyes(motion, 0.74, -0.38, 0.115, 0.036, 0xdfbbf5);
    for (const side of [-1, 1]) {
      const ear = shapeMesh(
        new THREE.ConeGeometry(0.11, 0.32, 3),
        gold.clone(),
        [side * 0.18, 0.94, -0.17],
      );
      ear.rotation.z = side * -0.18;
      motion.add(ear);
      for (const end of [-1, 1])
        motion.add(
          shapeMesh(roundedBox(0.12, 0.26, 0.13), wood.clone(), [
            side * 0.18,
            0.14,
            end * 0.25,
          ]),
        );
    }
    const tail = shapeMesh(
      new THREE.TorusGeometry(0.28, 0.11, 8, 16, Math.PI * 1.5),
      glow,
      [0, 0.55, 0.57],
    );
    tail.rotation.y = Math.PI / 2;
    tail.name = "tail";
    motion.add(tail);
  } else {
    motion.add(
      shapeMesh(
        new THREE.CylinderGeometry(0.38, 0.52, 0.95, 12),
        plum,
        [0, 0.87, 0],
      ),
    );
    for (const y of [0.42, 1.31])
      motion.add(
        shapeMesh(
          new THREE.CylinderGeometry(0.62, 0.62, 0.14, 12),
          gold.clone(),
          [0, y, 0],
        ),
      );
    const face = shapeMesh(
      new THREE.CylinderGeometry(0.33, 0.33, 0.15, 8),
      material(0xc9bdcb),
      [0, 1.53, -0.05],
    );
    face.rotation.x = Math.PI / 2;
    motion.add(face);
    eyes(motion, 1.56, -0.16, 0.13, 0.05, 0xb3e2dc);
    for (const side of [-1, 1]) {
      const arm = new THREE.Group();
      arm.name = `arm-${side}`;
      arm.position.set(side * 0.57, 1.1, 0);
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(side * 0.35, 0.2, 0),
        new THREE.Vector3(side * 0.57, -0.1, -0.12),
        new THREE.Vector3(side * 0.32, -0.45, -0.2),
      ]);
      arm.add(
        shapeMesh(
          new THREE.TubeGeometry(curve, 20, 0.08, 5, false),
          glow.clone(),
        ),
      );
      arm.add(
        shapeMesh(new THREE.DodecahedronGeometry(0.18), gold.clone(), [
          side * 0.32,
          -0.45,
          -0.2,
        ]),
      );
      motion.add(arm);
    }
    const crown = shapeMesh(
      new THREE.TorusGeometry(0.29, 0.035, 8, 24),
      glow.clone(),
      [0, 1.96, 0],
    );
    crown.name = "halo";
    motion.add(crown);
  }
  return root;
}

export function createEquipmentStudy(
  kind: EquipmentKind,
  tier: number,
): THREE.Group {
  const root = new THREE.Group();
  root.name = `equipment-study-${kind}-${tier}`;
  const wood = material(0x76523d),
    gold = material(0xd3ac60),
    glow = material(
      tier > 1 ? 0xc2a4ed : 0xf1cd77,
      tier > 1 ? 0x493461 : 0x493210,
    );
  if (kind === "guard-tool") {
    const shape = new THREE.Shape();
    shape.moveTo(0, -0.29);
    shape.bezierCurveTo(-0.35, -0.1, -0.3, 0.26, 0, 0.3);
    shape.bezierCurveTo(0.3, 0.26, 0.35, -0.1, 0, -0.29);
    root.add(
      shapeMesh(
        new THREE.ExtrudeGeometry(shape, {
          depth: 0.065,
          bevelEnabled: true,
          bevelSize: 0.025,
          bevelThickness: 0.02,
          bevelSegments: 2,
          steps: 1,
        }),
        wood,
      ),
    );
    const rim = shapeMesh(
      new THREE.TorusGeometry(0.22, 0.024, 6, 28),
      gold,
      [0, 0, -0.025],
    );
    rim.scale.y = 1.13;
    root.add(rim);
    root.add(
      shapeMesh(
        new THREE.SphereGeometry(0.07, 12, 8),
        gold.clone(),
        [0, 0, -0.07],
      ),
    );
  } else {
    root.add(
      shapeMesh(
        new THREE.CylinderGeometry(0.035, 0.055, 0.52, 10),
        wood,
        [0, -0.1, 0],
      ),
    );
    if (tier > 1)
      root.add(
        shapeMesh(new THREE.OctahedronGeometry(0.2), glow, [0, 0.27, 0]),
      );
    else root.add(shapeMesh(roundedBox(0.42, 0.22, 0.25), gold, [0, 0.22, 0]));
    for (const y of [-0.27, -0.15, 0.04])
      root.add(
        shapeMesh(new THREE.TorusGeometry(0.047, 0.01, 6, 12), gold.clone(), [
          0,
          y,
          0,
        ]),
      );
  }
  return root;
}

export function groundRing(
  radius: number,
  color: number,
  opacity = 0.7,
): THREE.Mesh {
  const ring = shapeMesh(
    new THREE.RingGeometry(radius - 0.045, radius, 48),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.025;
  return ring;
}
