import * as THREE from "three";

import {
  TICKET_RADIUS,
  TOKEN_RADIUS,
  type CollectiblePlacement,
  type CollectiblePlan,
} from "./casino-tokens";
import type { PositionSnapshot } from "./types";

// Code-native casino tokens and golden tickets (DESIGN-022). Colors follow the
// art brief: honey gold with a deep plum rim. No GLB is required.

const dummy = new THREE.Object3D();
const popSeconds = 0.22;

interface TicketVisual {
  readonly item: CollectiblePlacement;
  readonly root: THREE.Group;
  readonly card: THREE.Group;
  readonly halo: THREE.Mesh;
}

export interface TokenSceneInspection {
  tokens: number;
  visibleTokens: number;
  tickets: number;
  visibleTickets: number;
}

export class TokenScene {
  readonly root = new THREE.Group();
  private readonly discs: THREE.InstancedMesh;
  private readonly rims: THREE.InstancedMesh;
  private readonly tickets: TicketVisual[] = [];
  private readonly collected = new Set<string>();
  private readonly popStarted = new Map<string, number>();
  private readonly disposables: Array<THREE.BufferGeometry | THREE.Material> =
    [];

  constructor(
    private readonly plan: CollectiblePlan,
    collected: ReadonlySet<string> = new Set(),
  ) {
    this.root.name = "casino-collectibles";
    for (const id of collected) this.collected.add(id);
    const count = Math.max(1, plan.tokens.length);
    const discGeometry = new THREE.CylinderGeometry(
      TOKEN_RADIUS,
      TOKEN_RADIUS,
      0.05,
      22,
    );
    discGeometry.rotateX(Math.PI / 2);
    const discMaterial = new THREE.MeshStandardMaterial({
      color: 0xf2c14e,
      metalness: 0.55,
      roughness: 0.32,
      emissive: 0x6b4308,
      emissiveIntensity: 0.6,
    });
    const rimGeometry = new THREE.TorusGeometry(TOKEN_RADIUS, 0.028, 6, 22);
    const rimMaterial = new THREE.MeshStandardMaterial({
      color: 0x5b3a86,
      metalness: 0.2,
      roughness: 0.5,
      emissive: 0x24123a,
      emissiveIntensity: 0.4,
    });
    this.disposables.push(discGeometry, discMaterial, rimGeometry, rimMaterial);
    this.discs = new THREE.InstancedMesh(discGeometry, discMaterial, count);
    this.rims = new THREE.InstancedMesh(rimGeometry, rimMaterial, count);
    for (const mesh of [this.discs, this.rims]) {
      mesh.name =
        mesh === this.discs ? "casino-token-discs" : "casino-token-rims";
      mesh.count = plan.tokens.length;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.frustumCulled = false;
      this.root.add(mesh);
    }
    for (const item of plan.tickets) this.tickets.push(this.createTicket(item));
    this.update(0);
  }

  private createTicket(item: CollectiblePlacement): TicketVisual {
    const root = new THREE.Group();
    root.name = `golden-ticket-${item.id}`;
    root.position.set(item.position.x, item.position.y, item.position.z);
    const card = new THREE.Group();
    const face = new THREE.BoxGeometry(
      TICKET_RADIUS * 2.1,
      TICKET_RADIUS * 1.2,
      0.05,
    );
    const faceMaterial = new THREE.MeshStandardMaterial({
      color: 0xffd36b,
      metalness: 0.6,
      roughness: 0.25,
      emissive: 0x8a5a10,
      emissiveIntensity: 0.9,
    });
    const stub = new THREE.BoxGeometry(
      TICKET_RADIUS * 0.45,
      TICKET_RADIUS * 1.2,
      0.055,
    );
    const stubMaterial = new THREE.MeshStandardMaterial({
      color: 0x5b3a86,
      emissive: 0x2a1446,
      emissiveIntensity: 0.6,
    });
    const faceMesh = new THREE.Mesh(face, faceMaterial);
    const stubMesh = new THREE.Mesh(stub, stubMaterial);
    stubMesh.position.x = TICKET_RADIUS * 0.85;
    card.add(faceMesh, stubMesh);
    const haloGeometry = new THREE.TorusGeometry(
      TICKET_RADIUS * 1.45,
      0.02,
      6,
      32,
    );
    const haloMaterial = new THREE.MeshBasicMaterial({
      color: 0xffe39a,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    const halo = new THREE.Mesh(haloGeometry, haloMaterial);
    // A faint beam helps children spot a ticket from across a room.
    const beamGeometry = new THREE.CylinderGeometry(
      0.05,
      0.12,
      3.2,
      10,
      1,
      true,
    );
    const beamMaterial = new THREE.MeshBasicMaterial({
      color: 0xffe39a,
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    const beam = new THREE.Mesh(beamGeometry, beamMaterial);
    beam.position.y = 1.2;
    for (const object of [faceMesh, stubMesh, halo, beam]) {
      object.castShadow = false;
      object.receiveShadow = false;
    }
    this.disposables.push(
      face,
      faceMaterial,
      stub,
      stubMaterial,
      haloGeometry,
      haloMaterial,
      beamGeometry,
      beamMaterial,
    );
    root.add(card, halo, beam);
    root.visible = !this.collected.has(item.id);
    this.root.add(root);
    return { item, root, card, halo };
  }

  /** Starts an item's pop; returns where to burst, or null if already gone. */
  collect(id: string, elapsed: number): PositionSnapshot | null {
    if (this.collected.has(id)) return null;
    const item =
      this.plan.tokens.find((entry) => entry.id === id) ??
      this.plan.tickets.find((entry) => entry.id === id);
    if (!item) return null;
    this.collected.add(id);
    this.popStarted.set(id, elapsed);
    return { ...item.position };
  }

  /** Scale multiplier through a pop: a quick swell, then gone. */
  private popScale(id: string, elapsed: number): number {
    if (!this.collected.has(id)) return 1;
    const started = this.popStarted.get(id);
    if (started === undefined) return 0;
    const t = (elapsed - started) / popSeconds;
    if (t >= 1) {
      this.popStarted.delete(id);
      return 0;
    }
    return t < 0.45 ? 1 + t * 1.1 : (1.5 * (1 - t)) / 0.55;
  }

  update(elapsed: number): void {
    this.plan.tokens.forEach((item, index) => {
      const scale = this.popScale(item.id, elapsed);
      const rise = this.popStarted.has(item.id) ? 0.3 : 0;
      dummy.position.set(
        item.position.x,
        item.position.y + Math.sin(elapsed * 2.2 + index * 0.7) * 0.05 + rise,
        item.position.z,
      );
      dummy.rotation.set(0, elapsed * 2.4 + index * 0.35, 0);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      this.discs.setMatrixAt(index, dummy.matrix);
      this.rims.setMatrixAt(index, dummy.matrix);
    });
    this.discs.instanceMatrix.needsUpdate = true;
    this.rims.instanceMatrix.needsUpdate = true;
    for (const ticket of this.tickets) {
      const scale = this.popScale(ticket.item.id, elapsed);
      ticket.root.visible = scale > 0;
      ticket.root.scale.setScalar(Math.max(0.001, scale));
      ticket.root.position.y =
        ticket.item.position.y +
        Math.sin(elapsed * 1.8 + ticket.item.position.x) * 0.08;
      ticket.card.rotation.y = elapsed * 1.3;
      ticket.halo.rotation.set(Math.PI / 2, 0, elapsed * 0.9);
    }
  }

  inspect(): TokenSceneInspection {
    const visible = (item: CollectiblePlacement) =>
      !this.collected.has(item.id) || this.popStarted.has(item.id);
    return {
      tokens: this.plan.tokens.length,
      visibleTokens: this.plan.tokens.filter(visible).length,
      tickets: this.plan.tickets.length,
      visibleTickets: this.plan.tickets.filter(visible).length,
    };
  }

  dispose(): void {
    this.root.removeFromParent();
    this.discs.dispose();
    this.rims.dispose();
    for (const resource of this.disposables) resource.dispose();
    this.disposables.length = 0;
  }
}
