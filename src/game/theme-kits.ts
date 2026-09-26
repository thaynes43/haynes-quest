import * as THREE from "three";

import type { AuthoredLevelTheme } from "../shared/authored-level";
import type { SaveView } from "../shared/contracts";
import {
  themeKitPropsFor,
  type ThemeKitPropDefinition,
} from "../shared/theme-kits";
import { CasinoScene } from "./casino-scene";
import type { LevelLayout } from "./level";
import type { SceneAssets } from "./scene-assets";
import { WORLD_THEMES, type RuntimeWorldTheme } from "./world-themes";

/**
 * The theme-kit registry (DESIGN-025 D-05). One entry per world theme maps it
 * to everything the renderer needs:
 *
 * - `world`: palette, sky, ground, course colours and environment state
 *   (the existing `WORLD_THEMES` entry, unchanged);
 * - `fog`: fog distances (fog is drawn in the course sky colour);
 * - `props`: placeable decor from the shared prop catalog;
 * - `trail`: the look and names of collectible trails on v4 levels;
 * - `scenery`: an optional prepared-kit builder. The Rat Casino's former
 *   hard-wired `CasinoScene` is now simply the casino entry's builder, with
 *   identical output; themes without one use their procedural fallback.
 *
 * Adding a theme: add it to `AuthoredLevelTheme` and `WORLD_THEMES`, register
 * an entry here, and list its props in `src/shared/theme-kits.ts`. Adding a
 * prop only needs the shared catalog entry.
 */

export interface ThemeSceneryContext {
  readonly level: LevelLayout;
  readonly save: SaveView;
  readonly assets: SceneAssets;
  readonly valid: () => boolean;
}

export interface ThemeScenery {
  readonly root: THREE.Group;
  update?(deltaSeconds: number): void;
  dispose?(): void;
}

export interface TrailNames {
  /** Singular and plural names for trail tokens and the rare ticket. */
  readonly token: string;
  readonly tokens: string;
  readonly ticket: string;
  readonly tickets: string;
}

export interface TrailLook {
  readonly disc: number;
  readonly discEmissive: number;
  readonly rim: number;
  readonly rimEmissive: number;
  readonly ticket: number;
  readonly ticketEmissive: number;
  readonly stub: number;
  readonly stubEmissive: number;
  /** Ticket halo and beam. */
  readonly glow: number;
  readonly names: TrailNames;
}

export interface ThemeKit {
  readonly id: AuthoredLevelTheme;
  readonly world: RuntimeWorldTheme;
  readonly fog: { readonly near: number; readonly far: number };
  readonly props: readonly ThemeKitPropDefinition[];
  readonly trail: TrailLook;
  /** Model placed at the finish instead of the environment gate. */
  readonly exitGate: { readonly name: string; readonly url: string } | null;
  readonly scenery: ((context: ThemeSceneryContext) => ThemeScenery) | null;
}

const standardFog = Object.freeze({ near: 20, far: 52 });

/** The casino trail keeps DESIGN-022's exact honey-gold look. */
export const CASINO_TRAIL_LOOK: TrailLook = Object.freeze({
  disc: 0xf2c14e,
  discEmissive: 0x6b4308,
  rim: 0x5b3a86,
  rimEmissive: 0x24123a,
  ticket: 0xffd36b,
  ticketEmissive: 0x8a5a10,
  stub: 0x5b3a86,
  stubEmissive: 0x2a1446,
  glow: 0xffe39a,
  names: Object.freeze({
    token: "casino token",
    tokens: "casino tokens",
    ticket: "golden ticket",
    tickets: "golden tickets",
  }),
});

function trail(
  colors: Omit<TrailLook, "names">,
  names: TrailNames,
): TrailLook {
  return Object.freeze({ ...colors, names: Object.freeze(names) });
}

const casinoKitBase = "/studio/assets/media/rat-casino-kit/v001";

function casinoScenery(context: ThemeSceneryContext): ThemeScenery {
  const active = context.save.adventure?.activeLevel;
  return new CasinoScene(
    context.level,
    context.assets,
    context.valid,
    active?.periodId === "rat-casino-v1" &&
      !active?.encounters.some(
        (enemy) => enemy.content?.assetId === "golden-after-hours-rat",
      ),
  );
}

export const THEME_KITS: Readonly<Record<AuthoredLevelTheme, ThemeKit>> =
  Object.freeze({
    garden: {
      id: "garden",
      world: WORLD_THEMES.garden,
      fog: standardFog,
      props: themeKitPropsFor("garden"),
      trail: trail(
        { disc: 0xffd669, discEmissive: 0x6b4d08, rim: 0x5c8a3e, rimEmissive: 0x1f3314, ticket: 0xfff1a6, ticketEmissive: 0x7a6010, stub: 0x5c8a3e, stubEmissive: 0x1f3314, glow: 0xfff5c6 },
        { token: "seed", tokens: "seeds", ticket: "golden acorn", tickets: "golden acorns" },
      ),
      exitGate: null,
      scenery: null,
    },
    party: {
      id: "party",
      world: WORLD_THEMES.party,
      fog: standardFog,
      props: themeKitPropsFor("party"),
      trail: trail(
        { disc: 0xffd669, discEmissive: 0x7a3f62, rim: 0xd687a5, rimEmissive: 0x4a1f35, ticket: 0xffefb1, ticketEmissive: 0x8a5a10, stub: 0xb787b3, stubEmissive: 0x3a1f3a, glow: 0xfff5c6 },
        { token: "confetti coin", tokens: "confetti coins", ticket: "party ticket", tickets: "party tickets" },
      ),
      exitGate: null,
      scenery: null,
    },
    arcade: {
      id: "arcade",
      world: WORLD_THEMES.arcade,
      fog: standardFog,
      props: themeKitPropsFor("arcade"),
      trail: trail(
        { disc: 0xdca953, discEmissive: 0x5a3a12, rim: 0xd687a5, rimEmissive: 0x4a1f35, ticket: 0xd687a5, ticketEmissive: 0x5a1f3a, stub: 0x3e3353, stubEmissive: 0x1a1428, glow: 0xffd2e4 },
        { token: "arcade token", tokens: "arcade tokens", ticket: "high-score ticket", tickets: "high-score tickets" },
      ),
      exitGate: null,
      scenery: null,
    },
    toybox: {
      id: "toybox",
      world: WORLD_THEMES.toybox,
      fog: standardFog,
      props: themeKitPropsFor("toybox"),
      trail: trail(
        { disc: 0xdca953, discEmissive: 0x5a3a12, rim: 0x6d7cb0, rimEmissive: 0x232a44, ticket: 0xd9aa8e, ticketEmissive: 0x6a4020, stub: 0x6d7cb0, stubEmissive: 0x232a44, glow: 0xfff1d6 },
        { token: "toy button", tokens: "toy buttons", ticket: "golden key", tickets: "golden keys" },
      ),
      exitGate: null,
      scenery: null,
    },
    casino: {
      id: "casino",
      world: WORLD_THEMES.casino,
      fog: standardFog,
      props: themeKitPropsFor("casino"),
      trail: CASINO_TRAIL_LOOK,
      exitGate: { name: "casino-exit-arch", url: `${casinoKitBase}/marquee-arch.glb` },
      scenery: casinoScenery,
    },
  });

export function themeKitFor(theme: AuthoredLevelTheme): ThemeKit {
  return THEME_KITS[theme];
}
