import { describe, expect, it } from "vitest";

import {
  authoredLevelResolverFor,
  authoredRoute,
} from "../../src/game/authored-layout";
import { createLevelLayout } from "../../src/game/level";
import { modelUrls } from "../../src/game/scene-assets";
import {
  resolveRuntimeWorldTheme,
  WORLD_THEMES,
} from "../../src/game/world-themes";
import {
  AUTHORED_LEVEL_SCHEMA_VERSION_V3,
  type AuthoredLevelDocument,
  type AuthoredLevelTheme,
  type ResolvedAuthoredLevel,
} from "../../src/shared/authored-level";
import type { SaveView } from "../../src/shared/contracts";
import { makeAuthoredSave } from "./authored-fixtures";

const customRouteId = "private-theme-preview";

function v3Route(theme: AuthoredLevelTheme): ResolvedAuthoredLevel {
  const source = authoredRoute("garden-playground-v2");
  if (!source) throw new Error("Published garden fixture is unavailable");
  const document: AuthoredLevelDocument = {
    ...source.document,
    schemaVersion: AUTHORED_LEVEL_SCHEMA_VERSION_V3,
    id: customRouteId,
    theme,
  };
  return { ...source, document };
}

function previewSave(): SaveView {
  const save = structuredClone(
    makeAuthoredSave({ routeId: "garden-playground-v2" }),
  );
  if (!save.adventure?.activeLevel)
    throw new Error("Authored fixture needs an active level");
  save.adventure.activeLevel.routeId = customRouteId;
  return save;
}

function layoutFor(theme: AuthoredLevelTheme) {
  return createLevelLayout(
    previewSave(),
    authoredLevelResolverFor({ [customRouteId]: v3Route(theme) }),
  );
}

describe("runtime world themes", () => {
  it("preserves the published garden and party colors and asset paths", () => {
    expect(WORLD_THEMES.garden).toMatchObject({
      palette: {
        sky: 0xe9ddc3,
        grass: 0x668061,
        leaf: 0x467359,
        light: 0xffdc9b,
        accent: 0xf5c66c,
        mist: 0xc8cbb1,
      },
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
        hazard: 0xe99374,
      },
      meadow: {
        grass: 0x71a64d,
        flower: 0xffe9af,
        particles: 0xffdf8b,
      },
      environment: {
        state: "legacy-runtime",
        assets: {
          path: modelUrls.path,
          tree: modelUrls.tree,
          stone: modelUrls.stone,
          gate: modelUrls.gate,
        },
      },
      environmentScale: 0.9,
      usesPathTiles: true,
    });
    expect(WORLD_THEMES.party).toMatchObject({
      palette: {
        sky: 0x555975,
        grass: 0x456369,
        leaf: 0x596e89,
        light: 0xfbd6bd,
        accent: 0xb9a6fa,
        mist: 0x72718b,
      },
      course: {
        sky: 0x555975,
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
        hazard: 0xb586d4,
      },
      meadow: {
        grass: 0x7ba95b,
        flower: 0xd7b7dd,
        particles: 0xcfbbff,
      },
      environment: {
        state: "legacy-runtime",
        assets: {
          path: modelUrls.path,
          tree: modelUrls.tree,
          stone: modelUrls.stone,
          gate: modelUrls.gate,
        },
      },
      environmentScale: 0.8,
      usesPathTiles: false,
    });
  });

  it("uses authored v3 themes while retaining era selection for older routes", () => {
    const publishedGarden = authoredRoute("garden-playground-v2")!.document;
    const publishedParty = authoredRoute("besties-playground-v2")!.document;
    expect(resolveRuntimeWorldTheme(publishedGarden, false)).toBe(
      WORLD_THEMES.garden,
    );
    expect(resolveRuntimeWorldTheme(publishedParty, true)).toBe(
      WORLD_THEMES.party,
    );

    for (const theme of ["garden", "party", "arcade", "toybox"] as const) {
      const document = v3Route(theme).document;
      expect(resolveRuntimeWorldTheme(document, false)).toBe(
        WORLD_THEMES[theme],
      );
      expect(resolveRuntimeWorldTheme(document, true)).toBe(
        WORLD_THEMES[theme],
      );
    }
  });

  it("keeps pending previews procedural and names their fallback state", () => {
    expect(WORLD_THEMES.arcade).toMatchObject({
      palette: {
        grass: 0x3e3353,
        light: 0xdca953,
        accent: 0xd687a5,
      },
      obby: {
        platformSide: 0x6e547d,
        platformTop: 0x6e547d,
      },
      environment: {
        state: "pending-kit",
        assets: null,
        fallbackName: "arcade-pending-kit-fallback",
      },
    });
    expect(WORLD_THEMES.toybox).toMatchObject({
      palette: {
        grass: 0x8ca6a0,
        light: 0xdca953,
        accent: 0xdca953,
      },
      obby: {
        platformSide: 0xd9aa8e,
        platformTop: 0xd9aa8e,
        platformRails: 0x6d7cb0,
      },
      environment: {
        state: "pending-kit",
        assets: null,
        fallbackName: "toybox-pending-kit-fallback",
      },
    });
  });

  it("does not change course collision or gameplay placements when only theme changes", () => {
    const arcade = layoutFor("arcade");
    const toybox = layoutFor("toybox");
    const { authored: arcadeDocument, ...arcadeLayout } = arcade;
    const { authored: toyboxDocument, ...toyboxLayout } = toybox;

    expect(arcadeDocument?.theme).toBe("arcade");
    expect(toyboxDocument?.theme).toBe("toybox");
    expect(arcadeLayout).toEqual(toyboxLayout);
    expect(arcadeLayout.course).toEqual(toyboxLayout.course);
  });
});
