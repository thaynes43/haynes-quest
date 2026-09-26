/**
 * DESIGN-027 D-02: the per-device "Scary moments" switch. It defaults to on;
 * turning it off plays every chapter at scare level 0 without touching the
 * published journey. Storage is optional: a blocked or broken store reads as
 * the default and never gates the game.
 */
export const SCARY_MOMENTS_STORAGE_KEY = "quest-scary-moments-v1";

export const SCARY_MOMENTS_LABEL = "Scary moments";
export const SCARY_MOMENTS_DESCRIPTION =
  "Blackouts, jump scares and creepy sounds in spooky chapters.";

type PreferenceStorage = Pick<Storage, "getItem" | "setItem">;

function defaultStorage(): PreferenceStorage | undefined {
  try {
    return globalThis.localStorage ?? undefined;
  } catch {
    return undefined;
  }
}

/** Whether scary moments are on for this device; `true` unless explicitly turned off. */
export function readScaryMoments(
  storage: PreferenceStorage | null | undefined = defaultStorage(),
): boolean {
  try {
    return storage?.getItem(SCARY_MOMENTS_STORAGE_KEY) !== "off";
  } catch {
    return true;
  }
}

/** Remembers the choice on this device; a storage failure keeps the choice for this page only. */
export function writeScaryMoments(
  enabled: boolean,
  storage: PreferenceStorage | null | undefined = defaultStorage(),
): void {
  try {
    storage?.setItem(SCARY_MOMENTS_STORAGE_KEY, enabled ? "on" : "off");
  } catch {
    /* Preferences are optional; the in-memory choice still applies. */
  }
}
