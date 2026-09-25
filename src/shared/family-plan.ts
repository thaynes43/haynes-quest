/**
 * Shared vocabulary for family journeys (DESIGN-024). Everything here is pure
 * and name-free: it holds no child data, only the rules that turn a private
 * birthday and private photo choices into a frozen, playable plan.
 */
import type {
  FrozenEditorWorldLevelPlanV2,
} from "./adventure.js";
import type { WorldEditorLevelDocument } from "./editor-project.js";
import type { ParodyCatalogVersion } from "./parody-catalog.js";

export const FAMILY_WORLD_PLAN_VERSION = "family-world-plan-v1" as const;

/**
 * DESIGN-024 D-03: a February 29 birthday falls on February 28 in common
 * years. `birth-date-whole-years-v1` (every fixture/editor plan) instead lets a
 * leap-day birthday arrive on March 1; family plans record their own rule so
 * the two are never confused.
 */
export const FAMILY_AGE_RULE = "birth-date-whole-years-feb28-v1" as const;

export const FAMILY_MEMORY_SLOTS = ["minor-one", "minor-two", "major"] as const;
export type FamilyMemorySlot = (typeof FAMILY_MEMORY_SLOTS)[number];

/**
 * DESIGN-025 D-01 move vocabulary. `move`/`interact`/`jump` match today's
 * `Ability`; the growth moves arrive with WO107.
 */
export const FAMILY_ABILITIES = [
  "move",
  "interact",
  "jump",
  "high-jump",
  "double-jump",
  "glide",
] as const;
export type FamilyAbility = (typeof FAMILY_ABILITIES)[number];

/** The largest age a family ladder is sampled to. */
export const FAMILY_MAX_AGE = 30;

// ---------------------------------------------------------------------------
// Dates and the family age rule
// ---------------------------------------------------------------------------

const DAY_MS = 86_400_000;

export function isDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function dateParts(value: string): [number, number, number] {
  if (!isDateOnly(value)) throw new RangeError("Invalid date");
  const [year, month, day] = value.split("-").map(Number) as [number, number, number];
  return [year, month, day];
}

function formatDate(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** The calendar date on which someone born on `birthDate` turns `years`. */
export function familyAnniversary(birthDate: string, years: number): string {
  if (!Number.isInteger(years) || years < 0 || years > 200) {
    throw new RangeError("Invalid anniversary");
  }
  const [birthYear, month, day] = dateParts(birthDate);
  const year = birthYear + years;
  if (month === 2 && day === 29 && !isLeapYear(year)) return formatDate(year, 2, 28);
  return formatDate(year, month, day);
}

/** Whole years under {@link FAMILY_AGE_RULE}. Throws before birth. */
export function familyWholeYearsAt(birthDate: string, eventDate: string): number {
  const [birthYear] = dateParts(birthDate);
  const [eventYear] = dateParts(eventDate);
  let years = eventYear - birthYear;
  if (years >= 0 && eventDate < familyAnniversary(birthDate, years)) years -= 1;
  if (years < 0) throw new RangeError("Event precedes birth date");
  return years;
}

export function addDays(date: string, days: number): string {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (!isDateOnly(date) || !Number.isInteger(days)) throw new RangeError("Invalid date");
  return new Date(parsed.valueOf() + days * DAY_MS).toISOString().slice(0, 10);
}

/** Signed whole days from `from` to `to`. */
export function daysBetween(from: string, to: string): number {
  if (!isDateOnly(from) || !isDateOnly(to)) throw new RangeError("Invalid date");
  return Math.round(
    (Date.parse(`${to}T00:00:00.000Z`) - Date.parse(`${from}T00:00:00.000Z`)) / DAY_MS,
  );
}

// ---------------------------------------------------------------------------
// Ability ladder (DESIGN-025 D-01), consumed through an interface
// ---------------------------------------------------------------------------

/**
 * The family plan consumes a ladder, never a hard-coded table. WO107 exports
 * `abilitiesForAge` from `src/shared/abilities.ts`; adapt it to this interface
 * once it lands. The plan freezes the sampled result, so a later ladder change
 * never alters a published journey.
 */
export interface AbilityLadderSource {
  readonly version: string;
  abilitiesForAge(ageYears: number): readonly FamilyAbility[];
}

/**
 * Provisional DESIGN-025 D-01 table until WO107's `abilitiesForAge` merges:
 * jump from 0, high jump from 2, double jump from 4, glide from 8.
 */
export const PROVISIONAL_ABILITY_LADDER: AbilityLadderSource = Object.freeze({
  version: "design-025-ladder-provisional-v1",
  abilitiesForAge(ageYears: number): readonly FamilyAbility[] {
    if (!Number.isInteger(ageYears) || ageYears < 0) throw new RangeError("Invalid age");
    return [
      "move",
      "interact",
      "jump",
      ...(ageYears >= 2 ? (["high-jump"] as const) : []),
      ...(ageYears >= 4 ? (["double-jump"] as const) : []),
      ...(ageYears >= 8 ? (["glide"] as const) : []),
    ];
  },
});

export interface FrozenAbilityGrant {
  readonly fromAge: number;
  readonly abilities: readonly FamilyAbility[];
}

export interface FrozenAbilityLadder {
  readonly version: string;
  /** Sorted by `fromAge`, starting at 0; each entry holds every move from that age on. */
  readonly grants: readonly FrozenAbilityGrant[];
}

/** Sample a ladder from age 0 through `maxAge`, keeping only the ages where it changes. */
export function freezeAbilityLadder(source: AbilityLadderSource, maxAge: number): FrozenAbilityLadder {
  if (!Number.isInteger(maxAge) || maxAge < 0 || maxAge > FAMILY_MAX_AGE) {
    throw new RangeError("Invalid ladder age");
  }
  if (!/^[a-z0-9][a-z0-9._-]{0,79}$/.test(source.version)) throw new RangeError("Invalid ladder version");
  const grants: FrozenAbilityGrant[] = [];
  let prior: readonly FamilyAbility[] = [];
  for (let age = 0; age <= maxAge; age += 1) {
    const abilities = orderedAbilities(source.abilitiesForAge(age));
    if (prior.some((ability) => !abilities.includes(ability))) {
      throw new RangeError("Growth moves must be lasting");
    }
    if (age === 0 || abilities.length !== prior.length) {
      grants.push({ fromAge: age, abilities });
      prior = abilities;
    }
  }
  return { version: source.version, grants };
}

export function abilitiesAtAge(ladder: FrozenAbilityLadder, ageYears: number): FamilyAbility[] {
  let current: readonly FamilyAbility[] | undefined;
  for (const grant of ladder.grants) {
    if (grant.fromAge <= ageYears) current = grant.abilities;
  }
  if (!current) throw new RangeError("Ladder has no grant for this age");
  return [...current];
}

function orderedAbilities(input: readonly string[]): FamilyAbility[] {
  const known = new Set<string>(FAMILY_ABILITIES);
  if (input.some((ability) => !known.has(ability))) throw new RangeError("Unknown ability");
  if (new Set(input).size !== input.length) throw new RangeError("Duplicate ability");
  if (!input.includes("move")) throw new RangeError("A ladder always grants move");
  return FAMILY_ABILITIES.filter((ability) => input.includes(ability));
}

// ---------------------------------------------------------------------------
// Captions (DESIGN-024 D-05)
// ---------------------------------------------------------------------------

export const CAPTION_MAX_LENGTH = 60;
/** Frozen memory labels are bounded at 160 UTF-16 units by the save schema. */
const CAPTION_MAX_UTF16 = 160;

function season(month: number): string {
  // COPY: season names in default captions (coordinator may restyle).
  if (month === 12 || month <= 2) return "Winter";
  if (month <= 5) return "Spring";
  if (month <= 8) return "Summer";
  return "Fall";
}

/** Default captions never contain the display name. */
export function defaultCaption(slot: FamilyMemorySlot, date: string, ageYears: number): string {
  const [year, month] = dateParts(date);
  if (!Number.isInteger(ageYears) || ageYears < 0) throw new RangeError("Invalid age");
  // COPY: default caption formats from DESIGN-024 D-05.
  return slot === "major"
    ? `Turning ${ageYears}!`
    : `${season(month)} ${year} · age ${ageYears}`;
}

export type CaptionResult =
  | { readonly ok: true; readonly caption: string }
  | { readonly ok: false; readonly code: "CAPTION_EMPTY" | "CAPTION_TOO_LONG" | "CAPTION_INVALID" };

/**
 * Administrator captions: 1–60 user-perceived characters of plain text.
 * Whitespace runs collapse to one space; control and bidirectional override
 * characters are rejected. The result is only ever rendered as text.
 */
export function normalizeCaption(input: unknown): CaptionResult {
  if (typeof input !== "string" || input.length > CAPTION_MAX_UTF16) {
    return { ok: false, code: typeof input === "string" ? "CAPTION_TOO_LONG" : "CAPTION_INVALID" };
  }
  const caption = input.normalize("NFC").replace(/\s+/gu, " ").trim();
  if (caption.length === 0) return { ok: false, code: "CAPTION_EMPTY" };
  // Control characters, bidi overrides/isolates, and the replacement/non-characters.
  if (/[\p{Cc}‪-‮⁦-⁩￾￿�]/u.test(caption)) {
    return { ok: false, code: "CAPTION_INVALID" };
  }
  if (graphemeCount(caption) > CAPTION_MAX_LENGTH) return { ok: false, code: "CAPTION_TOO_LONG" };
  return { ok: true, caption };
}

function graphemeCount(value: string): number {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    let count = 0;
    for (const _segment of new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(value)) {
      count += 1;
    }
    return count;
  }
  return [...value].length;
}

// ---------------------------------------------------------------------------
// Frozen plan shape (DESIGN-024 D-07)
// ---------------------------------------------------------------------------

/** A private photo reference; `opaque` is an HMAC-derived id, never an upstream id. */
export interface FamilyMemorySource {
  readonly kind: "immich";
  readonly opaque: string;
}

export interface FamilyMemorySlotPlan {
  readonly slot: FamilyMemorySlot;
  readonly memoryId: string;
  readonly date: string;
  readonly ageYears: number;
  readonly caption: string;
  readonly source: FamilyMemorySource;
}

/**
 * A family chapter is an editor-world v2 level (same encounter, pickup, bonus
 * and route rules), plus the frozen authored geometry, the chapter's starting
 * moves and its three memory slots.
 */
export interface FrozenFamilyWorldLevelPlanV1 extends FrozenEditorWorldLevelPlanV2 {
  readonly chapterId: string;
  /** Moves in force at the chapter start; completion grants the ladder at `targetAgeYears`. */
  readonly abilities: readonly FamilyAbility[];
  readonly memorySlots: readonly [FamilyMemorySlotPlan, FamilyMemorySlotPlan, FamilyMemorySlotPlan];
  readonly authoredLevel: WorldEditorLevelDocument;
}

export interface FamilyWorldAdventurePlanV1 {
  readonly version: typeof FAMILY_WORLD_PLAN_VERSION;
  readonly catalogVersion: ParodyCatalogVersion;
  /** SHA-256 of the canonical frozen authored levels (geometry and anchors only). */
  readonly projectFingerprint: string;
  readonly template: {
    readonly id: string;
    readonly version: string;
    /** SHA-256 of the canonical checked-in template project. */
    readonly fingerprint: string;
  };
  readonly ageRule: typeof FAMILY_AGE_RULE;
  readonly abilityLadder: FrozenAbilityLadder;
  readonly levels: readonly FrozenFamilyWorldLevelPlanV1[];
}

export function familyMemoryId(routeId: string, slot: FamilyMemorySlot): string {
  return `${routeId}-memory-${slot}`;
}
