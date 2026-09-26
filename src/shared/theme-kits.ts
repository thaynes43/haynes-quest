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
 * Adding a prop: append an entry with a fresh id, the theme (or `shared` for
 * a prop every v4 theme may place), a bounding box that encloses the whole
 * model, a fallback, and (optionally) the reviewed GLB's URL and checksum.
 * Keep the asset catalog pages in step with any GLB.
 */
import type { AuthoredLevelTheme } from "./authored-level";

export interface ThemeKitBounds {
  readonly min: Readonly<{ x: number; y: number; z: number }>;
  readonly max: Readonly<{ x: number; y: number; z: number }>;
}

/**
 * Procedural stand-ins, each filling the prop's bounds: a slab (`box`), a post
 * (`cylinder`), two posts and a lintel (`arch`), a ball (`sphere`), a tank on
 * four legs (`tank`), three stacked blocks (`stack`) or a panel on two legs
 * (`board`).
 */
export type ThemeKitFallbackShape =
  | "box"
  | "cylinder"
  | "arch"
  | "sphere"
  | "tank"
  | "stack"
  | "board";

/**
 * The shared prop namespace: props any authored-level-v4 theme may place, on
 * top of its own kit (DESIGN-025 D-05).
 */
export const SHARED_THEME_KIT = "shared" as const;

export type ThemeKitPropTheme = AuthoredLevelTheme | typeof SHARED_THEME_KIT;

export interface ThemeKitPropDefinition {
  readonly id: string;
  readonly theme: ThemeKitPropTheme;
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
const media = "/studio/assets/media";

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
  // Family-world era kits (DESIGN-026). The art lead's WO111 kits
  // (toon-clubhouse-kit, rescue-harbor-kit, rooftop-city-kit, playroom-kit,
  // casita-kit) add exact GLBs later; until then each prop draws its
  // procedural stand-in at these bounds.
  {
    id: "clubhouse-tower-facade",
    theme: "clubhouse",
    bounds: box(2.2, 6.5, 0.6),
    fallback: { shape: "box", color: 0xe8483f, trim: 0xffd23f },
    glb: null,
  },
  {
    id: "curly-slide",
    theme: "clubhouse",
    bounds: box(1.2, 3.2, 1.2),
    fallback: { shape: "cylinder", color: 0xffd23f, trim: 0xe8483f },
    glb: null,
  },
  {
    id: "gadget-toolbox-stand",
    theme: "clubhouse",
    bounds: box(0.6, 1.3, 0.45),
    fallback: { shape: "stack", color: 0x3f8fe8, trim: 0xffd23f },
    glb: null,
  },
  {
    id: "rounded-hedge",
    theme: "clubhouse",
    bounds: box(1.1, 1.2, 0.6),
    fallback: { shape: "sphere", color: 0x4fb548, trim: 0x2f8a3a },
    glb: null,
  },
  {
    id: "stage-marker",
    theme: "clubhouse",
    bounds: box(0.9, 0.35, 0.9),
    fallback: { shape: "cylinder", color: 0xffd23f, trim: 0xe8483f },
    glb: null,
  },
  {
    id: "lookout-tower-facade",
    theme: "harbor",
    bounds: box(1.8, 7, 1.8),
    fallback: { shape: "tank", color: 0xd64533, trim: 0xf7c948 },
    glb: null,
  },
  {
    id: "pier-bollard",
    theme: "harbor",
    bounds: box(0.3, 0.8, 0.3),
    fallback: { shape: "cylinder", color: 0x2e4a62, trim: 0xf7c948 },
    glb: null,
  },
  {
    id: "rescue-buoy-stand",
    theme: "harbor",
    bounds: box(0.6, 1.8, 0.25),
    fallback: { shape: "board", color: 0xa8835b, trim: 0xd64533 },
    glb: null,
  },
  {
    id: "small-boat",
    theme: "harbor",
    bounds: box(1.2, 1.1, 2.6),
    fallback: { shape: "box", color: 0x2f7fb8, trim: 0xf2efe6 },
    glb: null,
  },
  {
    id: "water-tower",
    theme: "rooftop",
    bounds: box(1.4, 5, 1.4),
    fallback: { shape: "tank", color: 0x8a5a44, trim: 0x5a6d8c },
    glb: null,
  },
  {
    id: "rooftop-ac-unit",
    theme: "rooftop",
    bounds: box(0.9, 1.1, 0.7),
    fallback: { shape: "box", color: 0x9aa4b2, trim: 0x5a6d8c },
    glb: null,
  },
  {
    id: "crane-hook",
    theme: "rooftop",
    bounds: box(0.5, 1.6, 0.5),
    fallback: { shape: "cylinder", color: 0xf2b134, trim: 0x33394a },
    glb: null,
  },
  {
    id: "billboard-frame",
    theme: "rooftop",
    bounds: box(2.5, 4, 0.25),
    fallback: { shape: "board", color: 0x2b3350, trim: 0xff4fa3 },
    glb: null,
  },
  {
    id: "stacking-block-tower",
    theme: "playroom",
    bounds: box(0.7, 2.4, 0.7),
    fallback: { shape: "stack", color: 0xf4a7b9, trim: 0xa7d8f4 },
    glb: null,
  },
  {
    id: "toy-bus-garage",
    theme: "playroom",
    bounds: box(2, 2.2, 1.6),
    fallback: { shape: "box", color: 0xfbe3a1, trim: 0xb9a7f4 },
    glb: null,
  },
  {
    id: "crib-rail-fence",
    theme: "playroom",
    bounds: box(1.6, 0.9, 0.12),
    fallback: { shape: "box", color: 0xfdf6ec, trim: 0xa7e0c8 },
    glb: null,
  },
  {
    id: "giant-plush-ball",
    theme: "playroom",
    bounds: box(0.9, 1.8, 0.9),
    fallback: { shape: "sphere", color: 0xa7d8f4, trim: 0xf4a7b9 },
    glb: null,
  },
  {
    id: "casita-terrace-wall",
    theme: "casita",
    bounds: box(2.4, 2, 0.35),
    fallback: { shape: "box", color: 0xd9825b, trim: 0xf5e6c8 },
    glb: null,
  },
  {
    id: "flower-planter",
    theme: "casita",
    bounds: box(0.6, 0.9, 0.6),
    fallback: { shape: "cylinder", color: 0xc4643f, trim: 0xe8487a },
    glb: null,
  },
  {
    id: "patterned-door",
    theme: "casita",
    bounds: box(0.8, 2.4, 0.2),
    fallback: { shape: "box", color: 0x2e8b73, trim: 0xf2c14e },
    glb: null,
  },
  {
    id: "butterfly-arch",
    theme: "casita",
    bounds: box(1.8, 3.2, 0.3),
    fallback: { shape: "arch", color: 0x3f9b4f, trim: 0xf2a93b },
    glb: null,
  },
  // Concert-stage props for the Besties party finale.
  {
    id: "stage-speaker",
    theme: "party",
    bounds: box(0.6, 1.8, 0.5),
    fallback: { shape: "stack", color: 0x2b2233, trim: 0xd687a5 },
    glb: null,
  },
  {
    id: "light-truss",
    theme: "party",
    bounds: box(2.5, 4.2, 0.3),
    fallback: { shape: "arch", color: 0x9aa4b2, trim: 0xffefb1 },
    glb: null,
  },
  {
    id: "star-backdrop",
    theme: "party",
    bounds: box(3, 4.5, 0.25),
    fallback: { shape: "board", color: 0x5b3a86, trim: 0xffd669 },
    glb: null,
  },
  // Shared props: the existing exact GLB kits, placeable in every v4 theme.
  // Ids are the catalog-inventory ids; bounds are the floor-centred model
  // bounds measured from each GLB (accessor extents through the node
  // transforms, rounded outward to the millimetre), and each SHA-256 is the
  // inventory checksum of the exact file.
  {
    id: "clearing-tree",
    theme: SHARED_THEME_KIT,
    bounds: box(1.25, 3, 0.774),
    fallback: { shape: "cylinder", color: 0x467359, trim: 0x668061 },
    glb: {
      url: `${media}/clearing-tree/v001/clearing-tree.glb`,
      sha256: "501873525cbacf5449274a5f1c4ddf8294c2c8057b79b995e4070af375006ff9",
    },
  },
  {
    id: "clearing-stone",
    theme: SHARED_THEME_KIT,
    bounds: box(0.525, 0.8, 0.375),
    fallback: { shape: "sphere", color: 0xc8cbb1, trim: 0x9a9c86 },
    glb: {
      url: `${media}/clearing-stone/v001/clearing-stone.glb`,
      sha256: "475de5a60175e1899f5688ed7a5738a036a3d60b7b06c455eea0bb4472e11aa7",
    },
  },
  {
    id: "arrival-landmark",
    theme: SHARED_THEME_KIT,
    bounds: box(1.2, 2.8, 0.275),
    fallback: { shape: "arch", color: 0xb98b55, trim: 0xffdc9b },
    glb: {
      url: `${media}/arrival-landmark/v001/arrival-landmark.glb`,
      sha256: "9c151754f84a5df8f03fde12c9047e870a87eef94933e7e5491e066e16cb8c63",
    },
  },
  {
    id: "toybox-block-tower",
    theme: SHARED_THEME_KIT,
    bounds: box(0.85, 2.377, 0.456),
    fallback: { shape: "stack", color: 0xd9aa8e, trim: 0x6d7cb0 },
    glb: {
      url: `${media}/skyline-toybox-kit/v001/block-tower.glb`,
      sha256: "f7d9109a3f39a52db248423b680344393d94471b3420838c5bf717de243531e4",
    },
  },
  {
    id: "toybox-safety-rail",
    theme: SHARED_THEME_KIT,
    bounds: box(1.2, 0.756, 0.19),
    fallback: { shape: "box", color: 0x6d7cb0, trim: 0xdca953 },
    glb: {
      url: `${media}/skyline-toybox-kit/v001/safety-rail.glb`,
      sha256: "fd5b45ac33852017c51a46877e85b7bbb2c25edff6f362b8e8451a32ab5d4f7d",
    },
  },
  {
    id: "toybox-windup-lantern",
    theme: SHARED_THEME_KIT,
    bounds: box(0.33, 0.814, 0.214),
    fallback: { shape: "cylinder", color: 0xdca953, trim: 0xfff1d6 },
    glb: {
      url: `${media}/skyline-toybox-kit/v001/windup-lantern.glb`,
      sha256: "fc6bdef3e83df930abc7cdaf4d898a8e4bed0c1476f7496fb3ff3aa54ac33948",
    },
  },
  {
    id: "midnight-ticket-arch",
    theme: SHARED_THEME_KIT,
    bounds: { min: { x: -3.041, y: 0, z: -0.31 }, max: { x: 3.041, y: 3.385, z: 0.428 } },
    fallback: { shape: "arch", color: 0x3e3353, trim: 0xd687a5 },
    glb: {
      url: `${media}/midnight-arcade-kit/v001/ticket-arch.glb`,
      sha256: "bd06ceeacde3401dc1d484711c2d579bf5e72fca5dcc12f6885fada62b49a265",
    },
  },
  {
    id: "midnight-arcade-cabinet",
    theme: SHARED_THEME_KIT,
    bounds: { min: { x: -0.473, y: 0, z: -0.5 }, max: { x: 0.473, y: 1.79, z: 0.52 } },
    fallback: { shape: "box", color: 0x6e547d, trim: 0xdca953 },
    glb: {
      url: `${media}/midnight-arcade-kit/v001/arcade-cabinet.glb`,
      sha256: "63a54542acd25a1aededf63b563b2926002ff87b14069fa470fe2919c0f20142",
    },
  },
  {
    id: "midnight-joystick-bollard",
    theme: SHARED_THEME_KIT,
    bounds: box(0.425, 1.05, 0.425),
    fallback: { shape: "cylinder", color: 0x3e3353, trim: 0xd687a5 },
    glb: {
      url: `${media}/midnight-arcade-kit/v001/joystick-bollard.glb`,
      sha256: "11719fe4ef27242a409e7cb81137a1429903545593f1dcb61e69ae80d9d4754d",
    },
  },
] satisfies ThemeKitPropDefinition[]);

const byId = new Map(THEME_KIT_PROPS.map((prop) => [prop.id, prop]));

export function themeKitProp(id: string): ThemeKitPropDefinition | undefined {
  return byId.get(id);
}

/** The props registered to one theme's own kit (the shared kit excluded). */
export function themeKitPropsFor(
  theme: AuthoredLevelTheme,
): readonly ThemeKitPropDefinition[] {
  return THEME_KIT_PROPS.filter((prop) => prop.theme === theme);
}

/** The shared props every v4 theme may place. */
export function sharedThemeKitProps(): readonly ThemeKitPropDefinition[] {
  return THEME_KIT_PROPS.filter((prop) => prop.theme === SHARED_THEME_KIT);
}

/** Everything a v4 level of this theme may place: its own kit, then the shared kit. */
export function placeableThemeKitProps(
  theme: AuthoredLevelTheme,
): readonly ThemeKitPropDefinition[] {
  return [...themeKitPropsFor(theme), ...sharedThemeKitProps()];
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
