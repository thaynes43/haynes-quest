import type { EncounterView, EquipmentKind } from "../shared/contracts";
import { ALL_PARODY_CANDIDATES } from "../shared/parody-catalog";

const parodyMotion: Record<
  string,
  { contactFraction: number; height: number }
> = {
  "bickering-besties": { contactFraction: 0.625, height: 1.4 },
  "mister-hiss": { contactFraction: 0.6, height: 1 },
  "peel-patrol": { contactFraction: 0.625, height: 1.15 },
  "drama-dragon": { contactFraction: 0.625, height: 1.8 },
  "sir-flush-a-lot": { contactFraction: 0.625, height: 1 },
  "nap-captain": { contactFraction: 0.6, height: 1.05 },
  "one-star-diva": { contactFraction: 0.625, height: 1.65 },
};

interface ParodyArtworkBase {
  readonly contactFraction: number;
  readonly height: number;
  readonly id: string;
}

export interface SingleParodyArtwork extends ParodyArtworkBase {
  readonly kind: "single";
  readonly url: string;
}

export interface DuoParodyArtwork extends ParodyArtworkBase {
  readonly kind: "duo";
  readonly models: readonly [
    { readonly id: "bestie-pink"; readonly url: string },
    { readonly id: "bestie-black"; readonly url: string },
  ];
}

export type ParodyArtwork = SingleParodyArtwork | DuoParodyArtwork;

/** Candidate identities are frozen by the server; legacy saves retain their old renderer. */
export function parodyArtwork(
  content: NonNullable<EncounterView["content"]>,
): ParodyArtwork | null {
  const entry = ALL_PARODY_CANDIDATES.find(
    (candidate) =>
      candidate.id === content.catalogEntryId &&
      candidate.version === content.catalogEntryVersion &&
      candidate.assetId === content.assetId &&
      candidate.assetVersion === content.assetVersion,
  );
  const motion = entry && parodyMotion[entry.assetId];
  if (!entry || !motion) return null;
  if (entry.assetId === "bickering-besties")
    return {
      ...motion,
      id: entry.assetId,
      kind: "duo",
      models: [
        {
          id: "bestie-pink",
          url: "/studio/assets/media/bestie-pink/v001/bestie-pink.glb",
        },
        {
          id: "bestie-black",
          url: "/studio/assets/media/bestie-black/v001/bestie-black.glb",
        },
      ],
    };
  return {
    ...motion,
    id: entry.assetId,
    kind: "single",
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
