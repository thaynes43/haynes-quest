import {
  AUTHORED_LEVEL_SCHEMA_VERSION_V3,
  AUTHORED_LEVEL_SCHEMA_VERSION_V4,
  type AuthoredLevelDocument,
  type AuthoredLevelTheme,
} from "../shared/authored-level";
import { modelUrls } from "./scene-assets";
import { palettes } from "./scene-art";

export interface WorldPalette {
  readonly sky: number;
  readonly grass: number;
  readonly leaf: number;
  readonly light: number;
  readonly accent: number;
  readonly mist: number;
}

export interface ObbyVisualPalette {
  readonly platformSide: number;
  readonly platformTop: number;
  readonly platformEdge: number;
  readonly platformCenter: number | null;
  readonly platformRails: number | null;
  readonly ferrySide: number;
  readonly ferryTop: number;
  readonly ferryEdge: number;
  readonly ferryDetail: number;
  readonly hazard: number;
  readonly hazardBand: number;
  readonly checkpointInactive: number;
  readonly checkpointActive: number;
}

export interface EnvironmentAssetPaths {
  readonly path: string;
  readonly tree: string;
  readonly stone: string;
  readonly gate: string;
}

export type EnvironmentKit =
  | {
      /** Existing private runtime behavior; this does not imply owner approval. */
      readonly state: "legacy-runtime";
      readonly assets: EnvironmentAssetPaths;
      readonly fallbackName: null;
    }
  | {
      /** Procedural preview shown until an exact environment kit is reviewed. */
      readonly state: "pending-kit";
      readonly assets: null;
      readonly fallbackName: string;
    }
  | {
      /** Exact local Blender scenery selected for the private Rat Casino trial. */
      readonly state: "prepared-kit";
      readonly assets: null;
      readonly fallbackName: null;
    };

export interface RuntimeWorldTheme {
  readonly id: AuthoredLevelTheme;
  readonly palette: WorldPalette;
  readonly course: {
    readonly sky: number;
    readonly ground: number;
    readonly light: number;
    readonly exposure: number;
  };
  readonly obby: ObbyVisualPalette;
  readonly meadow: {
    readonly grass: number;
    readonly flower: number;
    readonly particles: number;
  };
  readonly environment: EnvironmentKit;
  readonly environmentScale: number;
  readonly usesPathTiles: boolean;
}

const clearingAssets: EnvironmentAssetPaths = Object.freeze({
  path: modelUrls.path,
  tree: modelUrls.tree,
  stone: modelUrls.stone,
  gate: modelUrls.gate,
});

const sharedCheckpointColors = {
  checkpointInactive: 0xfff1a6,
  checkpointActive: 0x8ce6b7,
} as const;

const garden: RuntimeWorldTheme = {
  id: "garden",
  palette: palettes.orchard,
  course: {
    sky: 0xcde5ef,
    ground: 0x88c1c5,
    light: 0xfff4df,
    exposure: 0.82,
  },
  obby: {
    platformSide: 0xb98b55,
    platformTop: 0x8fbb70,
    platformEdge: 0xf8e4a1,
    platformCenter: null,
    platformRails: null,
    ferrySide: 0x38a9b5,
    ferryTop: 0xffd669,
    ferryEdge: 0xfff5c6,
    ferryDetail: 0xd99845,
    hazard: 0xe99374,
    hazardBand: 0xffde83,
    ...sharedCheckpointColors,
  },
  meadow: {
    grass: 0x71a64d,
    flower: 0xffe9af,
    particles: 0xffdf8b,
  },
  environment: {
    state: "legacy-runtime",
    assets: clearingAssets,
    fallbackName: null,
  },
  environmentScale: 0.9,
  usesPathTiles: true,
};

const party: RuntimeWorldTheme = {
  id: "party",
  palette: palettes.fair,
  course: {
    sky: palettes.fair.sky,
    ground: 0x88c1c5,
    light: 0xfff4df,
    exposure: 0.85,
  },
  obby: {
    platformSide: 0xb787b3,
    platformTop: 0xf6ddcf,
    platformEdge: 0xd687a5,
    platformCenter: 0xeeb5c6,
    platformRails: 0xffefb1,
    ferrySide: 0x38a9b5,
    ferryTop: 0xffd669,
    ferryEdge: 0xfff5c6,
    ferryDetail: 0xd99845,
    hazard: 0xb586d4,
    hazardBand: 0xffde83,
    ...sharedCheckpointColors,
  },
  meadow: {
    grass: 0x7ba95b,
    flower: 0xd7b7dd,
    particles: 0xcfbbff,
  },
  environment: {
    state: "legacy-runtime",
    assets: clearingAssets,
    fallbackName: null,
  },
  environmentScale: 0.8,
  usesPathTiles: false,
};

const arcade: RuntimeWorldTheme = {
  id: "arcade",
  palette: {
    sky: 0x3e3353,
    grass: 0x3e3353,
    leaf: 0x6e547d,
    light: 0xdca953,
    accent: 0xd687a5,
    mist: 0x6e547d,
  },
  course: {
    sky: 0x3e3353,
    ground: 0x3e3353,
    light: 0xdca953,
    exposure: 0.9,
  },
  obby: {
    platformSide: 0x6e547d,
    platformTop: 0x6e547d,
    platformEdge: 0xd687a5,
    platformCenter: 0xd687a5,
    platformRails: null,
    ferrySide: 0x6e547d,
    ferryTop: 0xdca953,
    ferryEdge: 0xd687a5,
    ferryDetail: 0xd687a5,
    hazard: 0xd687a5,
    hazardBand: 0xdca953,
    checkpointInactive: 0xdca953,
    checkpointActive: 0xd687a5,
  },
  meadow: {
    grass: 0x6e547d,
    flower: 0xd687a5,
    particles: 0xdca953,
  },
  environment: {
    state: "pending-kit",
    assets: null,
    fallbackName: "arcade-pending-kit-fallback",
  },
  environmentScale: 0.8,
  usesPathTiles: false,
};

const toybox: RuntimeWorldTheme = {
  id: "toybox",
  palette: {
    sky: 0x8ca6a0,
    grass: 0x8ca6a0,
    leaf: 0x6d7cb0,
    light: 0xdca953,
    accent: 0xdca953,
    mist: 0xd9aa8e,
  },
  course: {
    sky: 0x8ca6a0,
    ground: 0x8ca6a0,
    light: 0xdca953,
    exposure: 0.86,
  },
  obby: {
    platformSide: 0xd9aa8e,
    platformTop: 0xd9aa8e,
    platformEdge: 0xdca953,
    platformCenter: null,
    platformRails: 0x6d7cb0,
    ferrySide: 0x6d7cb0,
    ferryTop: 0xd9aa8e,
    ferryEdge: 0xdca953,
    ferryDetail: 0x6d7cb0,
    hazard: 0x6d7cb0,
    hazardBand: 0xdca953,
    checkpointInactive: 0xdca953,
    checkpointActive: 0x6d7cb0,
  },
  meadow: {
    grass: 0x8ca6a0,
    flower: 0xdca953,
    particles: 0x6d7cb0,
  },
  environment: {
    state: "pending-kit",
    assets: null,
    fallbackName: "toybox-pending-kit-fallback",
  },
  environmentScale: 0.9,
  usesPathTiles: false,
};

const casino: RuntimeWorldTheme = {
  id: "casino",
  palette: {
    sky: 0x292333,
    grass: 0x34283c,
    leaf: 0x594354,
    light: 0xffd59a,
    accent: 0xb28a57,
    mist: 0x4b3a4e,
  },
  course: {
    sky: 0x292333,
    ground: 0x34283c,
    light: 0xffd59a,
    exposure: 1.03,
  },
  obby: {
    platformSide: 0x493548,
    platformTop: 0x674957,
    platformEdge: 0xc09b60,
    platformCenter: 0x79545f,
    platformRails: 0x9b784d,
    ferrySide: 0x4b3448,
    ferryTop: 0x85624f,
    ferryEdge: 0xd2aa70,
    ferryDetail: 0x9b784d,
    hazard: 0x825069,
    hazardBand: 0xe3bc78,
    checkpointInactive: 0xb78755,
    checkpointActive: 0xa4c4ac,
  },
  meadow: {
    grass: 0x493548,
    flower: 0xc09b60,
    particles: 0xe3bc78,
  },
  environment: {
    state: "prepared-kit",
    assets: null,
    fallbackName: null,
  },
  environmentScale: 1,
  usesPathTiles: false,
};

/**
 * Family-world era themes (DESIGN-026), available only to authored-level-v4
 * levels. Each is a bright storybook palette for its era. They use the
 * pending-kit state without automatic scenery: no clearing trees, meadow or
 * hills, and no placeholder props of their own, so a level's placed decor
 * frames it. The finish shows the procedural pending marker until an exact
 * kit is reviewed.
 */
function eraTheme(
  id: AuthoredLevelTheme,
  theme: Omit<RuntimeWorldTheme, "id" | "environment" | "environmentScale" | "usesPathTiles">,
): RuntimeWorldTheme {
  return {
    id,
    ...theme,
    environment: {
      state: "pending-kit",
      assets: null,
      fallbackName: `${id}-pending-kit-fallback`,
    },
    environmentScale: 1,
    usesPathTiles: false,
  };
}

/** Sunny toon greens, reds and yellows around a hilltop clubhouse. */
const clubhouse = eraTheme("clubhouse", {
  palette: {
    sky: 0xaee3ff,
    grass: 0x6cc24a,
    leaf: 0x3f9b3a,
    light: 0xfff2c4,
    accent: 0xffd23f,
    mist: 0xd8f1ff,
  },
  course: { sky: 0xaee3ff, ground: 0x7fcf5a, light: 0xfff4dc, exposure: 0.9 },
  obby: {
    platformSide: 0xe8483f,
    platformTop: 0x9edc6e,
    platformEdge: 0xffd23f,
    platformCenter: null,
    platformRails: 0xfff6d6,
    ferrySide: 0x3f8fe8,
    ferryTop: 0xffd23f,
    ferryEdge: 0xfff6d6,
    ferryDetail: 0xe8483f,
    hazard: 0xff7a3d,
    hazardBand: 0xfff176,
    ...sharedCheckpointColors,
  },
  meadow: { grass: 0x6cc24a, flower: 0xffd23f, particles: 0xfff176 },
});

/** Sea blues, rescue red and yellow, and weathered wooden piers. */
const harbor = eraTheme("harbor", {
  palette: {
    sky: 0x9fd4f0,
    grass: 0x2f7fb8,
    leaf: 0x1f5f8a,
    light: 0xfff1d0,
    accent: 0xd64533,
    mist: 0xcfe8f5,
  },
  course: { sky: 0x9fd4f0, ground: 0x2f86c0, light: 0xfff4e0, exposure: 0.9 },
  obby: {
    platformSide: 0xa8835b,
    platformTop: 0xd9c3a0,
    platformEdge: 0xf7c948,
    platformCenter: null,
    platformRails: 0xd64533,
    ferrySide: 0xd64533,
    ferryTop: 0xf2efe6,
    ferryEdge: 0xf7c948,
    ferryDetail: 0x2e4a62,
    hazard: 0xd64533,
    hazardBand: 0xf7c948,
    ...sharedCheckpointColors,
  },
  meadow: { grass: 0x2f7fb8, flower: 0xf7c948, particles: 0xffffff },
});

/** Dusk city blues, brick rooftops and neon billboard accents. */
const rooftop = eraTheme("rooftop", {
  palette: {
    sky: 0x5b6fa8,
    grass: 0x2b3350,
    leaf: 0x3c4a78,
    light: 0xffc98a,
    accent: 0xff4fa3,
    mist: 0x8a93c4,
  },
  course: { sky: 0x5b6fa8, ground: 0x2b3350, light: 0xffd9a8, exposure: 0.95 },
  obby: {
    platformSide: 0x9c4a36,
    platformTop: 0x8f96a8,
    platformEdge: 0x4fe3ff,
    platformCenter: null,
    platformRails: 0xff4fa3,
    ferrySide: 0x33394a,
    ferryTop: 0xf2b134,
    ferryEdge: 0x4fe3ff,
    ferryDetail: 0xff4fa3,
    hazard: 0xff4fa3,
    hazardBand: 0x4fe3ff,
    ...sharedCheckpointColors,
  },
  meadow: { grass: 0x2b3350, flower: 0xff4fa3, particles: 0x4fe3ff },
});

/** A soft pastel nursery: carpet, cream shelves and baby-blue blocks. */
const playroom = eraTheme("playroom", {
  palette: {
    sky: 0xfde8f0,
    grass: 0xf6dcc8,
    leaf: 0xa7d8f4,
    light: 0xfff7ea,
    accent: 0xf4a7b9,
    mist: 0xe8e0f7,
  },
  course: { sky: 0xfde8f0, ground: 0xf3d9c6, light: 0xfff8ee, exposure: 0.85 },
  obby: {
    platformSide: 0xa7d8f4,
    platformTop: 0xfff3d6,
    platformEdge: 0xf4a7b9,
    platformCenter: 0xfbe3a1,
    platformRails: null,
    ferrySide: 0xb9a7f4,
    ferryTop: 0xfbe3a1,
    ferryEdge: 0xfff3d6,
    ferryDetail: 0xa7e0c8,
    hazard: 0xf4a7b9,
    hazardBand: 0xfff3d6,
    ...sharedCheckpointColors,
  },
  meadow: { grass: 0xf6dcc8, flower: 0xf4a7b9, particles: 0xb9a7f4 },
});

/** Warm terracotta terraces, bright flowers and jungle greens. */
const casita = eraTheme("casita", {
  palette: {
    sky: 0xffe3b8,
    grass: 0x3f9b4f,
    leaf: 0x2c7a3f,
    light: 0xffe7b0,
    accent: 0xe8487a,
    mist: 0xf5d7a8,
  },
  course: { sky: 0xffe3b8, ground: 0x4fa65a, light: 0xfff0cc, exposure: 0.9 },
  obby: {
    platformSide: 0xd9825b,
    platformTop: 0xf5e6c8,
    platformEdge: 0xf2a93b,
    platformCenter: null,
    platformRails: 0x2e8b73,
    ferrySide: 0x2e8b73,
    ferryTop: 0xf2c14e,
    ferryEdge: 0xf5e6c8,
    ferryDetail: 0xe8487a,
    hazard: 0xe8487a,
    hazardBand: 0xf2c14e,
    ...sharedCheckpointColors,
  },
  meadow: { grass: 0x3f9b4f, flower: 0xe8487a, particles: 0xf2c14e },
});

export const WORLD_THEMES: Readonly<
  Record<AuthoredLevelTheme, RuntimeWorldTheme>
> = Object.freeze({
  garden,
  party,
  arcade,
  toybox,
  casino,
  clubhouse,
  harbor,
  rooftop,
  playroom,
  casita,
});

/**
 * V3/V4 world routes choose their own world. Published v1/v2 and legacy saves
 * retain the exact era-driven split that predates authored theme selection.
 */
export function resolveRuntimeWorldTheme(
  authored: Pick<AuthoredLevelDocument, "schemaVersion" | "theme"> | undefined,
  laterEra: boolean,
): RuntimeWorldTheme {
  return authored?.schemaVersion === AUTHORED_LEVEL_SCHEMA_VERSION_V3 ||
    authored?.schemaVersion === AUTHORED_LEVEL_SCHEMA_VERSION_V4
    ? WORLD_THEMES[authored.theme]
    : laterEra
      ? WORLD_THEMES.party
      : WORLD_THEMES.garden;
}
