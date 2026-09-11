import type { EncounterKind, EquipmentView } from "../shared/contracts";

export function eraStory(year = 2020) {
  return year >= 2024
    ? {
        title: "The Looplight Fair",
        subtitle: "2024 · The age of endless remixes",
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
        subtitle: "2020 · Blocks, play and streaming worlds",
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
  if (equipment.kind === "guard-tool") return "Acorn shield";
  return equipment.tier > 1 ? "Prism wand" : "Spark mallet";
}
