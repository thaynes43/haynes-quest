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
 * - `props`: the theme's own placeable decor from the prop catalog (v4
 *   levels may also place every `shared` prop);
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
/**
 * The family-world era themes climb higher, so their fog starts later and
 * ends inside the 100 m camera far plane: tall landmarks stay readable from
 * across a chapter (DESIGN-025 D-05).
 */
const eraFog = Object.freeze({ near: 30, far: 95 });

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
    // Family-world era themes (v4 only). No prepared scenery: placed decor,
    // from the theme's kit or the shared kit, dresses each level.
    clubhouse: {
      id: "clubhouse",
      world: WORLD_THEMES.clubhouse,
      fog: eraFog,
      props: themeKitPropsFor("clubhouse"),
      trail: trail(
        { disc: 0xffd23f, discEmissive: 0x6b4d08, rim: 0xe8483f, rimEmissive: 0x4a1510, ticket: 0xfff1a6, ticketEmissive: 0x7a6010, stub: 0x3f8fe8, stubEmissive: 0x14305a, glow: 0xfff5c6 },
        { token: "toon star", tokens: "toon stars", ticket: "golden gadget", tickets: "golden gadgets" },
      ),
      exitGate: null,
      scenery: null,
    },
    harbor: {
      id: "harbor",
      world: WORLD_THEMES.harbor,
      fog: eraFog,
      props: themeKitPropsFor("harbor"),
      trail: trail(
        { disc: 0xf7c948, discEmissive: 0x6b4d08, rim: 0xd64533, rimEmissive: 0x4a1510, ticket: 0xffe39a, ticketEmissive: 0x8a5a10, stub: 0x2e4a62, stubEmissive: 0x101c28, glow: 0xfff1c6 },
        { token: "rescue badge", tokens: "rescue badges", ticket: "golden bone", tickets: "golden bones" },
      ),
      exitGate: null,
      scenery: null,
    },
    rooftop: {
      id: "rooftop",
      world: WORLD_THEMES.rooftop,
      fog: eraFog,
      props: themeKitPropsFor("rooftop"),
      trail: trail(
        { disc: 0xf2b134, discEmissive: 0x6b4308, rim: 0x4fe3ff, rimEmissive: 0x0f4a5a, ticket: 0xffd36b, ticketEmissive: 0x8a5a10, stub: 0xff4fa3, stubEmissive: 0x5a1238, glow: 0xc8f6ff },
        { token: "city coin", tokens: "city coins", ticket: "golden gizmo", tickets: "golden gizmos" },
      ),
      exitGate: null,
      scenery: null,
    },
    playroom: {
      id: "playroom",
      world: WORLD_THEMES.playroom,
      fog: eraFog,
      props: themeKitPropsFor("playroom"),
      trail: trail(
        { disc: 0xa7d8f4, discEmissive: 0x2a5a78, rim: 0xf4a7b9, rimEmissive: 0x5a2a38, ticket: 0xffe39a, ticketEmissive: 0x8a5a10, stub: 0xb9a7f4, stubEmissive: 0x3a2a5a, glow: 0xf0f8ff },
        { token: "bubble", tokens: "bubbles", ticket: "golden rattle", tickets: "golden rattles" },
      ),
      exitGate: null,
      scenery: null,
    },
    casita: {
      id: "casita",
      world: WORLD_THEMES.casita,
      fog: eraFog,
      props: themeKitPropsFor("casita"),
      trail: trail(
        { disc: 0xf2a93b, discEmissive: 0x6b3f08, rim: 0xe8487a, rimEmissive: 0x5a1228, ticket: 0xffd36b, ticketEmissive: 0x8a5a10, stub: 0x2e8b73, stubEmissive: 0x0f3a2e, glow: 0xfff0c6 },
        { token: "butterfly", tokens: "butterflies", ticket: "golden candle", tickets: "golden candles" },
      ),
      exitGate: null,
      scenery: null,
    },
  });

export function themeKitFor(theme: AuthoredLevelTheme): ThemeKit {
  return THEME_KITS[theme];
}
