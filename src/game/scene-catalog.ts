import type { EncounterView, EquipmentKind } from "../shared/contracts";
import { PARODY_CANDIDATES } from "../shared/parody-catalog";

const parodyMotion: Record<
  string,
  { contactFraction: number; height: number }
> = {
  "mister-hiss": { contactFraction: 0.6, height: 1 },
  "peel-patrol": { contactFraction: 0.625, height: 1.15 },
  "drama-dragon": { contactFraction: 0.625, height: 1.8 },
  "sir-flush-a-lot": { contactFraction: 0.625, height: 1 },
  "nap-captain": { contactFraction: 0.6, height: 1.05 },
  "one-star-diva": { contactFraction: 0.625, height: 1.65 },
};

/** Candidate identities are frozen by the server; legacy saves retain their old renderer. */
export function parodyArtwork(content: NonNullable<EncounterView["content"]>) {
  const entry = PARODY_CANDIDATES.find(
    (candidate) =>
      candidate.id === content.catalogEntryId &&
      candidate.version === content.catalogEntryVersion &&
      candidate.assetId === content.assetId &&
      candidate.assetVersion === content.assetVersion,
  );
  const motion = entry && parodyMotion[entry.id];
  if (!entry || !motion) throw new Error("Unsupported frozen parody artwork");
  return {
    ...motion,
    id: entry.assetId,
    url: `/studio/assets/media/${entry.assetId}/${entry.assetVersion}/${entry.assetId}.glb`,
  };
}

/** Equipment candidates for isolated review; deployment follows owner review. */
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
