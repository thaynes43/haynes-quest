import type { ObbyCourse } from "./obby";
import type { PositionSnapshot } from "./types";

interface Surface {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  bottom: number;
  top: number;
}

interface Edge {
  to: number;
  portal: PositionSnapshot;
}

const footDiameter = 0.84;
const playerOverhang = 0.15;
const surfaceEpsilon = 0.005;
const heightEpsilon = 0.025;
const routeSampleLength = 0.025;

function within(value: number, min: number, max: number, margin = 0): boolean {
  return value >= min - margin && value <= max + margin;
}

function contains(surface: Surface, point: PositionSnapshot, margin = 0): boolean {
  return within(point.x, surface.minX, surface.maxX, margin) &&
    within(point.z, surface.minZ, surface.maxZ, margin);
}

function overlap(minA: number, maxA: number, minB: number, maxB: number): [number, number] {
  return [Math.max(minA, minB), Math.min(maxA, maxB)];
}

/** Static, same-height surfaces only. Moving, collapsing and bounce pieces are not enemy routes. */
export class EnemyGroundNavigation {
  private readonly surfaces: Surface[];
  private readonly edges: Edge[][];

  constructor(course: ObbyCourse) {
    this.surfaces = course.platforms
      .filter((platform) => !platform.motion && !platform.crumble && !platform.bounce)
      .map((platform) => ({
        minX: platform.center.x - platform.size.x / 2,
        maxX: platform.center.x + platform.size.x / 2,
        minZ: platform.center.z - platform.size.z / 2,
        maxZ: platform.center.z + platform.size.z / 2,
        bottom: platform.center.y - platform.size.y / 2,
        top: platform.center.y + platform.size.y / 2,
      }));
    this.edges = this.surfaces.map(() => []);
    for (let first = 0; first < this.surfaces.length; first += 1) {
      for (let second = first + 1; second < this.surfaces.length; second += 1) {
        const portal = this.portal(first, second);
        if (!portal) continue;
        this.edges[first]!.push({ to: second, portal });
        this.edges[second]!.push({ to: first, portal });
      }
    }
  }

  private portal(firstIndex: number, secondIndex: number): PositionSnapshot | null {
    const first = this.surfaces[firstIndex]!;
    const second = this.surfaces[secondIndex]!;
    if (Math.abs(first.top - second.top) > heightEpsilon) return null;
    const [minX, maxX] = overlap(first.minX, first.maxX, second.minX, second.maxX);
    const [minZ, maxZ] = overlap(first.minZ, first.maxZ, second.minZ, second.maxZ);
    if (maxX < minX - surfaceEpsilon || maxZ < minZ - surfaceEpsilon) return null;
    // A corner contact or a narrow seam cannot safely carry a foe's feet.
    if (maxX - minX < footDiameter && maxZ - minZ < footDiameter) return null;
    return {
      x: (minX + maxX) / 2,
      y: first.top,
      z: (minZ + maxZ) / 2,
    };
  }

  private candidates(point: PositionSnapshot, player: boolean): number[] {
    const matches = (margin: number): number[] => this.surfaces.flatMap((surface, index) => {
      const height = point.y - surface.top;
      if (height < -heightEpsilon || height > (player ? 1.25 : heightEpsilon)) return [];
      return contains(surface, point, margin) ? [index] : [];
    });
    const direct = matches(surfaceEpsilon);
    return direct.length > 0 || !player ? direct : matches(playerOverhang);
  }

  private supported(point: PositionSnapshot, height: number): boolean {
    if (!this.surfaces.some((surface) =>
      Math.abs(surface.top - height) <= heightEpsilon && contains(surface, point, surfaceEpsilon)
    )) return false;
    // Higher solid boxes are walls, even if a lower platform is under them.
    return !this.surfaces.some((surface) =>
      surface.bottom < height + 1 && surface.top > height + heightEpsilon &&
      contains(surface, point)
    );
  }

  /** Refuse a movement segment if any intermediate sample leaves walkable ground. */
  canWalk(from: PositionSnapshot, to: PositionSnapshot): boolean {
    const length = Math.hypot(to.x - from.x, to.z - from.z);
    const segments = Math.max(1, Math.ceil(length / routeSampleLength));
    for (let step = 1; step <= segments; step += 1) {
      const progress = step / segments;
      if (!this.supported({
        x: from.x + (to.x - from.x) * progress,
        y: from.y,
        z: from.z + (to.z - from.z) * progress,
      }, from.y)) return false;
    }
    return true;
  }

  /** A waypoint on a connected, level route; null means no safe pursuit path. */
  next(from: PositionSnapshot, goal: PositionSnapshot): PositionSnapshot | null {
    const starts = this.candidates(from, false);
    const targets = new Set(this.candidates(goal, true));
    if (starts.length === 0 || targets.size === 0) return null;
    const queue = starts.map((surface) => ({
      surface, point: from, firstPortal: null as PositionSnapshot | null,
    }));
    // A surface reached through a different portal can have a clear exit even
    // when the first portal is blocked by another solid box.
    const visitedEdges = new Set<string>();
    for (let index = 0; index < queue.length; index += 1) {
      const current = queue[index]!;
      if (targets.has(current.surface)) {
        const surface = this.surfaces[current.surface]!;
        const target = {
          x: Math.max(surface.minX, Math.min(surface.maxX, goal.x)),
          y: surface.top,
          z: Math.max(surface.minZ, Math.min(surface.maxZ, goal.z)),
        };
        if (this.canWalk(current.point, target))
          return current.firstPortal ?? target;
      }
      for (const edge of this.edges[current.surface]!) {
        const key = `${current.surface}:${edge.to}`;
        if (visitedEdges.has(key) || !this.canWalk(current.point, edge.portal)) continue;
        visitedEdges.add(key);
        queue.push({
          surface: edge.to,
          point: edge.portal,
          firstPortal: current.firstPortal ?? edge.portal,
        });
      }
    }
    return null;
  }

  /** A contact cannot jump a gap even when the target is within strike radius. */
  canStrike(from: PositionSnapshot, player: PositionSnapshot): boolean {
    return this.candidates(player, true).length > 0 &&
      this.canWalk(from, { ...player, y: from.y });
  }
}
