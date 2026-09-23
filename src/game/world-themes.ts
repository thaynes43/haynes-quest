import {
  AUTHORED_LEVEL_SCHEMA_VERSION_V3,
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

export const WORLD_THEMES: Readonly<
  Record<AuthoredLevelTheme, RuntimeWorldTheme>
> = Object.freeze({ garden, party, arcade, toybox });

/**
 * V3 preview routes choose their own world. Published v1/v2 and legacy saves
 * retain the exact era-driven split that predates authored theme selection.
 */
export function resolveRuntimeWorldTheme(
  authored: Pick<AuthoredLevelDocument, "schemaVersion" | "theme"> | undefined,
  laterEra: boolean,
): RuntimeWorldTheme {
  return authored?.schemaVersion === AUTHORED_LEVEL_SCHEMA_VERSION_V3
    ? WORLD_THEMES[authored.theme]
    : laterEra
      ? WORLD_THEMES.party
      : WORLD_THEMES.garden;
}
