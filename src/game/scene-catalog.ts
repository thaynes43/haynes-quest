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
  "chick-flia": { contactFraction: 0.625, height: 1.72 },
  "jackrabbit-drummer": { contactFraction: 0.625, height: 1.96 },
  "fox-card-shark": { contactFraction: 0.625, height: 1.8 },
  "moth-projectionist": { contactFraction: 0.625, height: 1.65 },
  "rat-pit-boss": { contactFraction: 0.625, height: 2.15 },
  "golden-after-hours-rat": { contactFraction: 0.625, height: 1.7 },
  // Family-era models (WO111 delivery log): contact 1.25 s of a 2.0 s attack.
  "clubhouse-bully-cat": { contactFraction: 0.625, height: 2.5 },
  "honk-bus": { contactFraction: 0.625, height: 2.3 },
  // parody-catalog-v10: contact 1.25 s of a 2.0 s attack; heights are the
  // logged `heightM` values.
  "gadget-helper": { contactFraction: 0.625, height: 1.118245 },
  "rival-mayor": { contactFraction: 0.625, height: 2.4745 },
  "yes-yes-veggie": { contactFraction: 0.625, height: 0.997798 },
  "magic-house": { contactFraction: 0.625, height: 2.898 },
  "mischief-kitten": { contactFraction: 0.625, height: 0.9186895485603485 },
  "bin-chicken": { contactFraction: 0.625, height: 1.2570000538098558 },
  // parody-catalog-v11: exact WO111 v001 exports, contact at 1.25 s.
  "inator-monster": { contactFraction: 0.625, height: 3.216711139418322 },
  "putty-grunt": { contactFraction: 0.625, height: 1.4005481542008216 },
  "demon-band-idol": { contactFraction: 0.625, height: 1.3958640411922474 },
  "radio-host-showman": { contactFraction: 0.625, height: 2.0030001423669983 },
  "lab-robot": { contactFraction: 0.625, height: 1.2918970584869385 },
  // parody-catalog-v12: exported Three.js heights and 1.25 s / 2.0 s contact.
  "gadget-hammer-hopper": { contactFraction: 0.625, height: 1.5414782316099696 },
  "broccoli-bouncer": { contactFraction: 0.625, height: 1.527886152267456 },
  "bin-chicken-flower-thief": { contactFraction: 0.625, height: 1.4803972244262695 },
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

/** Static storybook planting props for authored scenery (DESIGN-029). */
export const storybookPlantingKit = Object.freeze({
  "broad-canopy-tree": {
    id: "broad-canopy-tree",
    url: "/studio/assets/media/storybook-planting-kit/v001/models/broad-canopy-tree.glb",
  },
  "slim-cypress": {
    id: "slim-cypress",
    url: "/studio/assets/media/storybook-planting-kit/v001/models/slim-cypress.glb",
  },
  "flowering-shrub": {
    id: "flowering-shrub",
    url: "/studio/assets/media/storybook-planting-kit/v001/models/flowering-shrub.glb",
  },
} as const);

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
          url: `/studio/assets/media/bestie-pink/${entry.assetVersion}/bestie-pink.glb`,
        },
        {
          id: "bestie-black",
          url: `/studio/assets/media/bestie-black/${entry.assetVersion}/bestie-black.glb`,
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
