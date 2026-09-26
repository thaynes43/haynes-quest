import {
  AUTHORED_LEVEL_SCHEMA_VERSION_V4,
  type AuthoredLevelDocument,
} from "../shared/authored-level";
import type { ObbyCourse, ObbyPlatform } from "./obby";
import type { PositionSnapshot } from "./types";

// Casino tokens and golden tickets (DESIGN-022 slice 1). Placement is derived
// deterministically from the authored route; nothing here is saved or sent to
// the server. Casino imagery is a visual joke: tokens are never wagered.

export type CollectibleKind = "token" | "ticket";

export interface CollectiblePlacement {
  readonly id: string;
  readonly kind: CollectibleKind;
  readonly position: PositionSnapshot;
  readonly platformId: string;
  /** Trail tokens sit on a platform; arc tokens float over a jump from `from`. */
  readonly role: "trail" | "arc" | "ticket";
  readonly from?: string;
}

export interface CollectiblePlan {
  readonly tokens: readonly CollectiblePlacement[];
  readonly tickets: readonly CollectiblePlacement[];
}

export interface CollectibleCounts {
  tokens: number;
  tokenTotal: number;
  tickets: number;
  ticketTotal: number;
}

/** Minimal geometry the planner needs from a level layout. */
export interface CollectibleLevel {
  readonly authored?: AuthoredLevelDocument;
  readonly course?: ObbyCourse;
}

export const TOKEN_RADIUS = 0.2;
export const TICKET_RADIUS = 0.3;
const trailSpacing = 1.5;
const trailHeight = 0.55;
const edgeClearance = 0.4;
const entryInset = 0.6;
const anchorClearance = 1.2;
const hazardMargin = 0.5;
const minTokenSpacing = 0.8;
const arcHeight = 0.2;
const ticketHeight = 0.95;
const maxTickets = 3;
/** Extra reach beyond the collider so a near miss still collects. */
const touchSlack = 0.14;
/** A traveler's body needs this much open floor around a standing spot. */
const standingClearance = 0.25;
/** A platform whose underside is lower than this above a floor blocks it. */
const standingHeadroom = 1.3;

interface Rect {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

function rectOf(platform: ObbyPlatform): Rect {
  return {
    minX: platform.center.x - platform.size.x / 2,
    maxX: platform.center.x + platform.size.x / 2,
    minZ: platform.center.z - platform.size.z / 2,
    maxZ: platform.center.z + platform.size.z / 2,
  };
}

function topOf(platform: ObbyPlatform): number {
  return platform.center.y + platform.size.y / 2;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/**
 * Where the line from a platform's centre toward `target` leaves the platform.
 * Travelers run from one platform's middle toward the next, so trails and jump
 * arcs follow that centre-to-centre line.
 */
function edgeToward(
  rect: Rect,
  target: { x: number; z: number },
): { x: number; z: number } {
  const centerX = (rect.minX + rect.maxX) / 2;
  const centerZ = (rect.minZ + rect.maxZ) / 2;
  const dx = target.x - centerX;
  const dz = target.z - centerZ;
  const length = Math.hypot(dx, dz);
  if (length < 1e-6) return { x: centerX, z: centerZ };
  const halfX = (rect.maxX - rect.minX) / 2;
  const halfZ = (rect.maxZ - rect.minZ) / 2;
  const reach = Math.min(
    Math.abs(dx) < 1e-9 ? Number.POSITIVE_INFINITY : halfX / Math.abs(dx),
    Math.abs(dz) < 1e-9 ? Number.POSITIVE_INFINITY : halfZ / Math.abs(dz),
    1,
  );
  return { x: centerX + dx * reach, z: centerZ + dz * reach };
}

function centerOf(platform: ObbyPlatform): { x: number; z: number } {
  return { x: platform.center.x, z: platform.center.z };
}

function containsPoint(
  rect: Rect,
  point: { x: number; z: number },
  margin: number,
): boolean {
  return (
    point.x > rect.minX - margin &&
    point.x < rect.maxX + margin &&
    point.z > rect.minZ - margin &&
    point.z < rect.maxZ + margin
  );
}

function rectsOverlap(first: Rect, second: Rect): boolean {
  return (
    first.minX < second.maxX &&
    second.minX < first.maxX &&
    first.minZ < second.maxZ &&
    second.minZ < first.maxZ
  );
}

/** Clamps a point into a rectangle shrunk by the edge clearance. */
function clampInside(rect: Rect, point: { x: number; z: number }) {
  const insetX = Math.min(edgeClearance, (rect.maxX - rect.minX) / 2);
  const insetZ = Math.min(edgeClearance, (rect.maxZ - rect.minZ) / 2);
  return {
    x: Math.min(rect.maxX - insetX, Math.max(rect.minX + insetX, point.x)),
    z: Math.min(rect.maxZ - insetZ, Math.max(rect.minZ + insetZ, point.z)),
  };
}

/** Moves a point from an edge toward the platform centre by `inset`. */
function inward(
  rect: Rect,
  point: { x: number; z: number },
  inset: number,
): { x: number; z: number } {
  const centerX = (rect.minX + rect.maxX) / 2;
  const centerZ = (rect.minZ + rect.maxZ) / 2;
  const dx = centerX - point.x;
  const dz = centerZ - point.z;
  const length = Math.hypot(dx, dz);
  if (length < 1e-6) return point;
  const step = Math.min(inset, length);
  return clampInside(rect, {
    x: point.x + (dx / length) * step,
    z: point.z + (dz / length) * step,
  });
}

function anchorPositions(document: AuthoredLevelDocument): PositionSnapshot[] {
  const anchors = document.anchors;
  return [
    anchors.spawn.position,
    anchors.finish.position,
    anchors.rewardRespawn.position,
    ...Object.values(anchors.pickups).map((anchor) => anchor.position),
    ...Object.values(anchors.memories).map((anchor) => anchor.position),
    ...Object.values(anchors.encounters).map((anchor) => anchor.position),
    ...Object.values(anchors.friendlies).map((anchor) => anchor.position),
  ];
}

/**
 * Plans casino tokens and golden tickets for a `casino` themed authored level,
 * and themed trails for every authored-level-v4 level (DESIGN-025 D-04).
 * Returns `null` for every other level so the gentle courses stay unchanged.
 */
export function planCasinoCollectibles(
  level: CollectibleLevel,
): CollectiblePlan | null {
  const document = level.authored;
  const course = level.course;
  if (
    !document ||
    !course ||
    (document.theme !== "casino" &&
      document.schemaVersion !== AUTHORED_LEVEL_SCHEMA_VERSION_V4)
  )
    return null;
  const platforms = new Map(course.platforms.map((entry) => [entry.id, entry]));
  const anchors = anchorPositions(document);
  const hazards = course.hazards.map((hazard) => ({
    center: hazard.center,
    reach:
      hazard.halfLength +
      hazard.radius +
      (hazard.motion?.distance ?? 0) +
      hazardMargin,
  }));
  const tokens: CollectiblePlacement[] = [];
  const solids = course.platforms
    .filter((platform) => !platform.motion)
    .map((platform) => ({
      id: platform.id,
      rect: rectOf(platform),
      top: topOf(platform),
      bottom: platform.center.y - platform.size.y / 2,
    }));
  /** Whether an item of `radius` would sit inside a platform. */
  const embedded = (point: PositionSnapshot, radius: number): boolean =>
    solids.some(
      (solid) =>
        containsPoint(solid.rect, point, radius) &&
        point.y > solid.bottom - radius &&
        point.y < solid.top + radius,
    );
  /**
   * Whether another, higher platform overlaps this floor at `point`. Authored
   * rooms may overlap where they meet; that strip belongs to the higher one.
   */
  const covered = (
    platformId: string,
    point: { x: number; z: number },
    floor: number,
  ): boolean =>
    solids.some(
      (solid) =>
        solid.id !== platformId &&
        solid.top > floor + 0.01 &&
        solid.bottom < floor + standingHeadroom &&
        containsPoint(solid.rect, point, standingClearance),
    );

  const clear = (point: PositionSnapshot): boolean =>
    anchors.every(
      (anchor) =>
        Math.hypot(anchor.x - point.x, anchor.z - point.z) >= anchorClearance ||
        Math.abs(anchor.y - point.y) > 1.6,
    ) &&
    hazards.every(
      (hazard) =>
        Math.hypot(hazard.center.x - point.x, hazard.center.z - point.z) >=
          hazard.reach || Math.abs(hazard.center.y - point.y) > 1.6,
    ) &&
    tokens.every(
      (token) =>
        Math.hypot(
          token.position.x - point.x,
          token.position.y - point.y,
          token.position.z - point.z,
        ) >= minTokenSpacing,
    );

  const add = (
    point: PositionSnapshot,
    platformId: string,
    from?: string,
  ): void => {
    const position = {
      x: round(point.x),
      y: round(point.y),
      z: round(point.z),
    };
    if (!clear(position) || embedded(position, TOKEN_RADIUS)) return;
    const floor = platforms.get(platformId);
    if (!from && floor && covered(platformId, position, topOf(floor))) return;
    tokens.push({
      id: `token-${tokens.length + 1}`,
      kind: "token",
      position,
      platformId,
      role: from ? "arc" : "trail",
      ...(from ? { from } : {}),
    });
  };

  const connection = (from: string, to: string) =>
    document.connections.find(
      (entry) =>
        (entry.from === from && entry.to === to) ||
        (entry.from === to && entry.to === from),
    );

  const trail = (
    platform: ObbyPlatform,
    entry: { x: number; z: number },
    exit: { x: number; z: number },
  ): void => {
    // Moving, crumbling and bouncing surfaces carry no trail of their own.
    if (platform.motion || platform.crumble || platform.bounce) return;
    const rect = rectOf(platform);
    const y = topOf(platform) + trailHeight;
    const start = clampInside(rect, entry);
    const end = clampInside(rect, exit);
    const length = Math.hypot(end.x - start.x, end.z - start.z);
    if (length < 1.2) {
      add(
        { x: (start.x + end.x) / 2, y, z: (start.z + end.z) / 2 },
        platform.id,
      );
      return;
    }
    const count = Math.max(1, Math.floor(length / trailSpacing));
    for (let index = 0; index <= count; index++) {
      const t = index / count;
      add(
        {
          x: start.x + (end.x - start.x) * t,
          y,
          z: start.z + (end.z - start.z) * t,
        },
        platform.id,
      );
    }
  };

  const arc = (from: ObbyPlatform, to: ObbyPlatform): void => {
    // Overlapping platforms meet at a step rather than across a gap.
    if (rectsOverlap(rectOf(from), rectOf(to))) return;
    const takeoff = edgeToward(rectOf(from), centerOf(to));
    const landing = edgeToward(rectOf(to), centerOf(from));
    const gap = Math.hypot(landing.x - takeoff.x, landing.z - takeoff.z);
    if (gap < 0.25) return;
    const fromTop = topOf(from);
    const toTop = topOf(to);
    const samples = gap >= 0.9 ? [0.12, 0.5, 0.88] : [0.5];
    for (const t of samples) {
      add(
        {
          x: takeoff.x + (landing.x - takeoff.x) * t,
          y:
            fromTop +
            (toTop - fromTop) * t +
            trailHeight +
            arcHeight * Math.sin(Math.PI * t),
          z: takeoff.z + (landing.z - takeoff.z) * t,
        },
        to.id,
        from.id,
      );
    }
  };

  const walked = new Set<string>();
  const walkPath = (path: readonly string[], main: boolean): void => {
    for (let index = 0; index < path.length; index++) {
      const id = path[index]!;
      const platform = platforms.get(id);
      if (!platform) continue;
      const rect = rectOf(platform);
      const previous = index > 0 ? platforms.get(path[index - 1]!) : undefined;
      const next =
        index < path.length - 1 ? platforms.get(path[index + 1]!) : undefined;
      if (!walked.has(id)) {
        walked.add(id);
        const entry = previous
          ? inward(rect, edgeToward(rect, centerOf(previous)), entryInset)
          : main
            ? document.anchors.spawn.position
            : centerOf(platform);
        const exit = next
          ? inward(rect, edgeToward(rect, centerOf(next)), entryInset)
          : main
            ? document.anchors.finish.position
            : centerOf(platform);
        trail(platform, entry, exit);
      }
      if (next) {
        const link = connection(id, next.id);
        if (link?.mode === "jump" && !platform.motion && !next.motion)
          arc(platform, next);
      }
    }
  };

  walkPath(document.mainPath, true);
  for (const branch of document.branches) walkPath(branch, false);

  const mainRoute = new Set(document.mainPath);
  const tickets: CollectiblePlacement[] = [];
  for (const branch of document.branches) {
    if (tickets.length >= maxTickets) break;
    const candidates = branch
      .map((id, index) => ({ platform: platforms.get(id), index }))
      .filter(
        (entry): entry is { platform: ObbyPlatform; index: number } =>
          Boolean(entry.platform) &&
          !mainRoute.has(entry.platform!.id) &&
          !entry.platform!.motion &&
          !entry.platform!.crumble &&
          !entry.platform!.bounce,
      );
    if (!candidates.length) continue;
    // Highest first; on a tie, the platform furthest along the detour.
    candidates.sort(
      (left, right) =>
        topOf(right.platform) - topOf(left.platform) ||
        right.index - left.index,
    );
    // The centre, then each inset corner, of the highest platform with open,
    // uncovered floor clear of every anchor; a lower platform otherwise.
    for (const { platform } of candidates) {
      const rect = rectOf(platform);
      const floor = topOf(platform);
      const y = floor + ticketHeight;
      const spot = [
        { x: platform.center.x, z: platform.center.z },
        ...[
          [rect.minX, rect.minZ],
          [rect.maxX, rect.minZ],
          [rect.minX, rect.maxZ],
          [rect.maxX, rect.maxZ],
        ].map(([x, z]) => inward(rect, { x: x!, z: z! }, 0.6)),
      ].find(
        (candidate) =>
          anchors.every(
            (anchor) =>
              Math.hypot(anchor.x - candidate.x, anchor.z - candidate.z) >=
                anchorClearance || Math.abs(anchor.y - y) > 1.6,
          ) &&
          !covered(platform.id, candidate, floor) &&
          !embedded({ ...candidate, y }, TICKET_RADIUS),
      );
      if (!spot) continue;
      tickets.push({
        id: `ticket-${tickets.length + 1}`,
        kind: "ticket",
        position: { x: round(spot.x), y: round(y), z: round(spot.z) },
        platformId: platform.id,
        role: "ticket",
      });
      break;
    }
  }
  // A ticket's platform never also carries a token under it.
  const ticketed = tickets.map((ticket) => ticket.position);
  const keptTokens = tokens.filter((token) =>
    ticketed.every(
      (ticket) =>
        Math.hypot(ticket.x - token.position.x, ticket.z - token.position.z) >=
        0.9,
    ),
  );
  return {
    tokens: keptTokens.map((token, index) => ({
      ...token,
      id: `token-${index + 1}`,
    })),
    tickets,
  };
}

/** Tracks what the traveler has touched this run. Kept through falls and retries. */
export class CollectibleTracker {
  private readonly collected = new Set<string>();

  constructor(readonly plan: CollectiblePlan) {}

  /**
   * Collects every item the traveler's body touches at `feet`. Returns the
   * newly collected items in plan order.
   */
  collect(
    feet: PositionSnapshot,
    body: { radius: number; height: number },
  ): CollectiblePlacement[] {
    const found: CollectiblePlacement[] = [];
    for (const item of [...this.plan.tokens, ...this.plan.tickets]) {
      if (this.collected.has(item.id)) continue;
      const itemRadius = item.kind === "ticket" ? TICKET_RADIUS : TOKEN_RADIUS;
      const reach = body.radius + itemRadius + touchSlack;
      if (
        Math.hypot(item.position.x - feet.x, item.position.z - feet.z) > reach
      )
        continue;
      if (
        item.position.y < feet.y - itemRadius ||
        item.position.y > feet.y + body.height + itemRadius
      )
        continue;
      this.collected.add(item.id);
      found.push(item);
    }
    return found;
  }

  has(id: string): boolean {
    return this.collected.has(id);
  }

  get collectedIds(): ReadonlySet<string> {
    return this.collected;
  }

  counts(): CollectibleCounts {
    let tokens = 0;
    let tickets = 0;
    for (const id of this.collected) {
      if (id.startsWith("ticket-")) tickets++;
      else tokens++;
    }
    return {
      tokens,
      tokenTotal: this.plan.tokens.length,
      tickets,
      ticketTotal: this.plan.tickets.length,
    };
  }
}
