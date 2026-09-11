import type { EncounterKind, EquipmentKind } from "../shared/contracts";

/** Exact candidates for isolated game review; deployment follows owner review. */
export function encounterArtwork(kind: EncounterKind, later: boolean) {
  const entries = later
    ? {
        "ordinary-a": { id: "loop-dancer", contact: 0.5 },
        "ordinary-b": { id: "prism-mimic", contact: 0.5 },
        boss: { id: "trendweaver", contact: 0.6 },
      }
    : {
        "ordinary-a": { id: "blockling", contact: 0.52 },
        "ordinary-b": { id: "signal-moth", contact: 0.56 },
        boss: { id: "buffer-baron", contact: 0.6 },
      };
  const entry = entries[kind];
  return {
    ...entry,
    url: `/studio/assets/media/${entry.id}/v001/${entry.id}.glb`,
  };
}

export function equipmentArtwork(kind: EquipmentKind, tier: number) {
  const id =
    kind === "attack-tool"
      ? tier > 1
        ? "prism-wand"
        : "spark-mallet"
      : tier > 1
        ? "ribbon-shield"
        : "acorn-shield";
  return {
    id,
    url: `/studio/assets/media/era-equipment/v001/${id}/${id}.glb`,
  };
}
