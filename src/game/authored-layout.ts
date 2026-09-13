import garden from "../shared/levels/garden-playground-v1.json";
import party from "../shared/levels/besties-playground-v1.json";
import gardenV2 from "../shared/levels/garden-playground-v2.json";
import partyV2 from "../shared/levels/besties-playground-v2.json";
import {
  resolveAuthoredLevelDocument,
  type AuthoredEncounterSlot,
  type ResolvedAuthoredLevel,
} from "../shared/authored-level";
import type { ActiveLevelView, SaveView } from "../shared/contracts";
import type { LevelLayout } from "./level";

const documents: Readonly<Record<string, unknown>> = {
  "garden-playground-v1": garden,
  "besties-playground-v1": party,
  "garden-playground-v2": gardenV2,
  "besties-playground-v2": partyV2,
};
const resolved = new Map<string, ResolvedAuthoredLevel>();

/** Published route IDs are immutable; every consumer shares one validated resolution. */
export function authoredRoute(
  routeId: string | undefined,
): ResolvedAuthoredLevel | null {
  if (!routeId || !Object.hasOwn(documents, routeId)) return null;
  let result = resolved.get(routeId);
  if (!result) {
    result = resolveAuthoredLevelDocument(documents[routeId]);
    resolved.set(routeId, result);
  }
  return result;
}

export function authoredLevelLayout(
  save: SaveView,
  active: ActiveLevelView,
): LevelLayout | null {
  const route = authoredRoute(active.routeId);
  if (!route) return null;
  if (!active.minorMemoryIds || !active.majorMemoryId) {
    throw new Error(
      "Authored routes require explicit minor and major memory roles",
    );
  }
  const { anchors, course, document } = route;
  const states = new Map(
    save.memories.map((memory) => [memory.id, memory.state]),
  );
  const ordinary = active.encounters.filter(
    (enemy) => enemy.role === "ordinary",
  );
  if (
    ordinary.length !== 4 ||
    active.encounters.filter((enemy) => enemy.role === "boss").length !== 1
  ) {
    throw new Error("Authored encounter slots do not match the frozen roster");
  }
  const encounterSlots = new Map(
    active.encounters.map((enemy) => {
      const slot: AuthoredEncounterSlot =
        enemy.role === "boss"
          ? "boss"
          : (`ordinary-${ordinary.indexOf(enemy) + 1}` as AuthoredEncounterSlot);
      if (anchors.encounters[slot].kind !== enemy.kind) {
        throw new Error(`Authored encounter slot ${slot} has a different kind`);
      }
      return [enemy.id, slot] as const;
    }),
  );
  const memoryBindings = [
    [active.minorMemoryIds[0], anchors.memories["minor-one"]],
    [active.minorMemoryIds[1], anchors.memories["minor-two"]],
    [active.majorMemoryId, anchors.memories.major],
  ] as const;
  const platforms = course.platforms;
  const minX =
    Math.min(
      ...platforms.map((platform) => platform.center.x - platform.size.x / 2),
    ) - 1;
  const maxX =
    Math.max(
      ...platforms.map((platform) => platform.center.x + platform.size.x / 2),
    ) + 1;
  const minZ =
    Math.min(
      ...platforms.map((platform) => platform.center.z - platform.size.z / 2),
    ) - 1;
  const maxZ =
    Math.max(
      ...platforms.map((platform) => platform.center.z + platform.size.z / 2),
    ) + 1;
  return {
    id: active.id,
    routeId: active.routeId,
    course,
    authored: document,
    memories: memoryBindings.map(([id, binding], index) => ({
      id,
      index,
      position: { ...binding.position },
      state: states.get(id) ?? "locked",
    })),
    pickups: active.pickups.map((pickup) => ({
      id: pickup.pickupId,
      equipmentId: pickup.id,
      kind: pickup.kind,
      position: { ...anchors.pickups[pickup.kind].position },
      collected: pickup.collected,
    })),
    encounters: active.encounters.map((enemy) => {
      const binding = anchors.encounters[encounterSlots.get(enemy.id)!];
      return {
        id: enemy.id,
        role: enemy.role,
        kind: enemy.kind,
        position: { ...binding.position },
        arena: { ...binding.arena },
        retryCheckpointId: binding.checkpointId,
      };
    }),
    friendlies: (active.friendlies ?? []).map((friend, index) => {
      const binding =
        anchors.friendlies[
          `friendly-${index + 1}` as keyof typeof anchors.friendlies
        ];
      if (!binding)
        throw new Error(
          "Authored friendly slots do not match the frozen roster",
        );
      return { ...friend, position: { ...binding.position } };
    }),
    checkpoint: { ...anchors.spawn.position },
    finish: { ...anchors.finish.position },
    step: null,
    minX,
    maxX,
    minZ,
    maxZ,
  };
}
