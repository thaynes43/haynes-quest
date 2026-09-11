import type {
  ActiveLevelView,
  EncounterKind,
  EquipmentView,
} from "../shared/contracts";
import {
  ALL_PARODY_CANDIDATES,
  PARODY_PERIODS,
} from "../shared/parody-catalog";

export function eraStory(year = 2020, level?: ActiveLevelView | null) {
  const period =
    level?.periodId === "block-party-v1" ||
    level?.periodId === "remix-runway-v1" ||
    level?.periodId === "remix-runway-v2"
      ? PARODY_PERIODS[level.periodId]
      : null;
  if (period && level) {
    const enemies: Record<EncounterKind, string> = {
      "ordinary-a": "Party guest",
      "ordinary-b": "Party guest",
      boss: "Chapter boss",
    };
    for (const encounter of level.encounters) {
      const identity = encounter.content;
      const entry =
        identity &&
        ALL_PARODY_CANDIDATES.find(
          (candidate) =>
            candidate.id === identity.catalogEntryId &&
            candidate.version === identity.catalogEntryVersion &&
            candidate.assetId === identity.assetId &&
            candidate.assetVersion === identity.assetVersion,
        );
      if (entry) enemies[encounter.kind] = entry.title;
    }
    return { ...period, subtitle: `${year} · ${period.subtitle}`, enemies };
  }
  return year >= 2024
    ? {
        title: "The Looplight Fair",
        subtitle: `${year} · The age of endless remixes`,
        description:
          "Follow the ribbons into a fair that never stops repeating itself.",
        enemies: {
          "ordinary-a": "Loop Dancer",
          "ordinary-b": "Prism Mimic",
          boss: "The Trendweaver",
        } satisfies Record<EncounterKind, string>,
      }
    : {
        title: "The Pixel Orchard",
        subtitle: `${year} · Blocks, play and streaming worlds`,
        description:
          "A familiar orchard has been overrun by building blocks and restless signals.",
        enemies: {
          "ordinary-a": "Blockling",
          "ordinary-b": "Signal Moth",
          boss: "The Buffer Baron",
        } satisfies Record<EncounterKind, string>,
      };
}

export function equipmentName(
  equipment?: Pick<EquipmentView, "kind" | "tier">,
): string {
  if (!equipment) return "Find a tool";
  if (equipment.kind === "guard-tool")
    return equipment.tier > 1 ? "Ribbon shield" : "Acorn shield";
  return equipment.tier > 1 ? "Prism wand" : "Spark mallet";
}
