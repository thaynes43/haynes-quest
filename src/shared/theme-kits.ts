/**
 * Theme-kit prop catalog (DESIGN-025 D-05), the data half of the registry.
 *
 * The validator needs every placeable prop's bounding box, and `src/shared`
 * must not import `src/game`, so the catalog lives here as plain data. The
 * renderer's registry (`src/game/theme-kits.ts`) adds palettes, procedural
 * scenery and trail looks on top of it.
 *
 * Each prop has a stable id, the theme it belongs to, a local bounding box at
 * scale 1 (metres, Y up, origin at the floor centre, +Z toward the player at
 * rotation 0) and a procedural fallback shape. A prop may also name an exact
 * versioned GLB under `/studio/assets/media/...` with its SHA-256; until one
 * lands, or if it fails to load, the procedural fallback draws instead.
 *
 * Adding a prop: append an entry with a fresh id, the theme, a bounding box
 * that encloses the whole model, a fallback, and (optionally) the reviewed
 * GLB's URL and checksum. Keep the asset catalog pages in step with any GLB.
 */
import type { AuthoredLevelTheme } from "./authored-level";

export interface ThemeKitBounds {
  readonly min: Readonly<{ x: number; y: number; z: number }>;
  readonly max: Readonly<{ x: number; y: number; z: number }>;
}

export type ThemeKitFallbackShape = "box" | "cylinder" | "arch";

export interface ThemeKitPropDefinition {
  readonly id: string;
  readonly theme: AuthoredLevelTheme;
  readonly bounds: ThemeKitBounds;
  /** Procedural stand-in drawn whenever the exact model is absent or fails. */
  readonly fallback: {
    readonly shape: ThemeKitFallbackShape;
    readonly color: number;
    readonly trim: number;
  };
  /** Exact reviewed model, when one has landed. */
  readonly glb: {
    readonly url: string;
    readonly sha256: string;
  } | null;
}

function box(
  halfX: number,
  height: number,
  halfZ: number,
): ThemeKitBounds {
  return {
    min: { x: -halfX, y: 0, z: -halfZ },
    max: { x: halfX, y: height, z: halfZ },
  };
}

const casinoKit = "/studio/assets/media/rat-casino-kit/v001";

export const THEME_KIT_PROPS: readonly ThemeKitPropDefinition[] = Object.freeze([
  // Rat Casino kit v001 (WO097). Bounds are the exported floor-centred model
  // bounds from construction-measurements.json (Blender Z-up to glTF Y-up).
  {
    id: "casino-marquee-arch",
    theme: "casino",
    bounds: box(3.02, 3.69, 0.534),
    fallback: { shape: "arch", color: 0x522d3a, trim: 0xc39a61 },
    glb: {
      url: `${casinoKit}/marquee-arch.glb`,
      sha256: "1f939c9e11004397f2a7046390d788dd8ab54a0c26450eaa88b1dc983dcd6e8b",
    },
  },
  {
    id: "casino-roulette-dais",
    theme: "casino",
    bounds: box(1.754, 0.562, 1.752),
    fallback: { shape: "cylinder", color: 0x3b293c, trim: 0xc39a61 },
    glb: {
      url: `${casinoKit}/roulette-dais.glb`,
      sha256: "574644bcccf8038cb929aebd1d63eebbfbce976e732ec314e388cdef8cd52df6",
    },
  },
  {
    id: "casino-slot-cabinet",
    theme: "casino",
    bounds: box(0.517, 2.134, 0.551),
    fallback: { shape: "box", color: 0x261e2c, trim: 0xffd98b },
    glb: {
      url: `${casinoKit}/slot-cabinet.glb`,
      sha256: "06f1460afc516a4dd56c8ab33cc4ba84c2bcdb5a33f954cf6060af06fd9aabe3",
    },
  },
  // Procedural-only props: each theme can frame rooms before its kit lands.
  {
    id: "garden-hedge",
    theme: "garden",
    bounds: box(1, 1.2, 0.4),
    fallback: { shape: "box", color: 0x71a64d, trim: 0x5c8a3e },
    glb: null,
  },
  {
    id: "garden-lantern",
    theme: "garden",
    bounds: box(0.2, 2.2, 0.2),
    fallback: { shape: "cylinder", color: 0xb98b55, trim: 0xffe9af },
    glb: null,
  },
  {
    id: "garden-arch",
    theme: "garden",
    bounds: box(1.6, 3, 0.25),
    fallback: { shape: "arch", color: 0xb98b55, trim: 0x8fbb70 },
    glb: null,
  },
  {
    id: "party-gift-stack",
    theme: "party",
    bounds: box(0.6, 1.2, 0.6),
    fallback: { shape: "box", color: 0xd687a5, trim: 0xffefb1 },
    glb: null,
  },
  {
    id: "party-balloon-post",
    theme: "party",
    bounds: box(0.25, 2.6, 0.25),
    fallback: { shape: "cylinder", color: 0xb787b3, trim: 0xffefb1 },
    glb: null,
  },
  {
    id: "party-arch",
    theme: "party",
    bounds: box(1.8, 3.2, 0.3),
    fallback: { shape: "arch", color: 0xeeb5c6, trim: 0xffefb1 },
    glb: null,
  },
  {
    id: "arcade-cabinet",
    theme: "arcade",
    bounds: box(0.45, 1.9, 0.4),
    fallback: { shape: "box", color: 0x6e547d, trim: 0xdca953 },
    glb: null,
  },
  {
    id: "arcade-neon-arch",
    theme: "arcade",
    bounds: box(2, 3.4, 0.3),
    fallback: { shape: "arch", color: 0x3e3353, trim: 0xd687a5 },
    glb: null,
  },
  {
    id: "toybox-block",
    theme: "toybox",
    bounds: box(0.5, 1, 0.5),
    fallback: { shape: "box", color: 0xd9aa8e, trim: 0x6d7cb0 },
    glb: null,
  },
  {
    id: "toybox-soldier-post",
    theme: "toybox",
    bounds: box(0.25, 2, 0.25),
    fallback: { shape: "cylinder", color: 0x6d7cb0, trim: 0xdca953 },
    glb: null,
  },
] satisfies ThemeKitPropDefinition[]);

const byId = new Map(THEME_KIT_PROPS.map((prop) => [prop.id, prop]));

export function themeKitProp(id: string): ThemeKitPropDefinition | undefined {
  return byId.get(id);
}

export function themeKitPropsFor(
  theme: AuthoredLevelTheme,
): readonly ThemeKitPropDefinition[] {
  return THEME_KIT_PROPS.filter((prop) => prop.theme === theme);
}

export interface DecorPlacement {
  readonly position: Readonly<{ x: number; y: number; z: number }>;
  readonly rotationY: number;
  readonly scale: number;
}

/**
 * World-space axis-aligned box of a placed prop: its local bounds scaled,
 * rotated about Y and translated. Conservative for non-right-angle turns.
 */
export function decorWorldBounds(
  bounds: ThemeKitBounds,
  placement: DecorPlacement,
): ThemeKitBounds {
  const cos = Math.cos(placement.rotationY);
  const sin = Math.sin(placement.rotationY);
  const xs: number[] = [];
  const zs: number[] = [];
  for (const x of [bounds.min.x, bounds.max.x])
    for (const z of [bounds.min.z, bounds.max.z]) {
      // Three.js rotation.y maps local (x, z) to (x cos + z sin, -x sin + z cos).
      xs.push((x * cos + z * sin) * placement.scale);
      zs.push((-x * sin + z * cos) * placement.scale);
    }
  return {
    min: {
      x: placement.position.x + Math.min(...xs),
      y: placement.position.y + bounds.min.y * placement.scale,
      z: placement.position.z + Math.min(...zs),
    },
    max: {
      x: placement.position.x + Math.max(...xs),
      y: placement.position.y + bounds.max.y * placement.scale,
      z: placement.position.z + Math.max(...zs),
    },
  };
}
