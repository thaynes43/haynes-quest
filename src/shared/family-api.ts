/**
 * Family journey API shapes (DESIGN-024 D-08), shared by the server routes and
 * the client screens. None of them carries an upstream Immich id: photos are
 * addressed by opaque candidate tokens and slot ids.
 */
import type { SaveView } from "./contracts.js";
import type { WorldEditorLevelDocument } from "./editor-project.js";
import type { FamilyMemorySlot } from "./family-plan.js";

export interface PersonChoice {
  /** Opaque, HMAC-derived choice id. */
  readonly id: string;
  readonly label: string;
  readonly birthDate: string | null;
}

export interface TemplateOffer {
  readonly id: string;
  readonly version: string;
  readonly name: string;
  readonly chapterCount: number;
}

export interface CreateChildInput {
  readonly immichName: string;
  /** A {@link PersonChoice.id} from the same name lookup. */
  readonly personChoiceId: string;
  readonly displayName: string;
  readonly birthDate: string;
  readonly templateId: string;
  readonly templateVersion: string;
}

export interface ChildView {
  readonly id: string;
  readonly displayName: string;
  readonly birthDate: string;
  readonly templateId: string;
  readonly templateVersion: string;
  readonly revision: number;
}

export interface DraftSlotView {
  readonly slot: FamilyMemorySlot;
  readonly status: "filled" | "needs-photo";
  readonly localDate: string | null;
  readonly ageYears: number | null;
  readonly caption: string | null;
  readonly captionEdited: boolean;
  /** Short-lived candidate token for the private thumbnail; never an upstream id. */
  readonly thumbnailToken: string | null;
  readonly source: "auto" | "admin" | null;
}

export interface DraftChapterView {
  readonly chapterId: string;
  readonly name: string;
  readonly subtitle: string;
  readonly startAge: number;
  readonly recoveredAge: number;
  readonly startDate: string;
  readonly targetDate: string;
  readonly slots: readonly DraftSlotView[];
}

export interface DraftView {
  readonly childId: string;
  readonly draftId: string;
  readonly revision: number;
  readonly templateId: string;
  readonly templateVersion: string;
  readonly publishable: boolean;
  readonly chapters: readonly DraftChapterView[];
}

export interface SuggestionView {
  readonly token: string;
  readonly localDate: string;
  readonly ageYears: number;
}

export interface SuggestionPageView {
  readonly suggestions: readonly SuggestionView[];
  readonly nextCursor: number | null;
}

export interface PublicationSummary {
  readonly publicationId: string;
  readonly childId: string;
  readonly revision: number;
  readonly chapterCount: number;
  readonly memoryCount: number;
}

/** One child's draft and publication state for the admin list. */
export interface AdminChildSummary {
  readonly child: ChildView;
  readonly draft: {
    readonly revision: number;
    readonly publishable: boolean;
    readonly filled: number;
    readonly needsPhoto: number;
  } | null;
  readonly publication: { readonly revision: number; readonly publishedAt: string } | null;
  /** An automatic pick (or a world update, which may pick) is running in the background. */
  readonly picking: boolean;
  /** Fixed error code from the last background pick or world update, if it failed. */
  readonly lastPickError: string | null;
  /** DESIGN-024 D-11: the newest offered version of the child's world, when newer than theirs. */
  readonly newerTemplate: TemplateOffer | null;
}

export interface AdminDraftResponse {
  readonly draft: DraftView | null;
  readonly picking: boolean;
  readonly lastPickError: string | null;
  /** DESIGN-024 D-11: a newer offered version of the child's world, if one exists. */
  readonly newerTemplate: TemplateOffer | null;
}

/** DESIGN-024 D-11 **Update world**: move the child to a newer version of the same world. */
export interface TemplateUpgradeRequest {
  readonly templateId: string;
  readonly templateVersion: string;
  /** The draft revision the administrator saw; null when the child has no draft yet. */
  readonly expectedRevision: number | null;
}

export type DraftEditRequest =
  | { readonly op: "auto-pick"; readonly expectedRevision: number | null; readonly reseed?: boolean }
  | {
      readonly op: "caption";
      readonly expectedRevision: number;
      readonly chapterId: string;
      readonly slot: FamilyMemorySlot;
      readonly caption: string;
    }
  | {
      readonly op: "swap";
      readonly expectedRevision: number;
      readonly chapterId: string;
      readonly slot: FamilyMemorySlot;
      readonly token: string;
    };

export interface PublishRequest {
  readonly expectedRevision: number;
  /** A UUID; replaying it returns the same publication. */
  readonly requestId: string;
}

/** A published journey on the household home screen. */
export interface FamilyJourneyCard {
  readonly childId: string;
  readonly displayName: string;
  readonly publicationRevision: number;
  readonly chapterCount: number;
  /** The child's current run, if one has started. */
  readonly run: {
    readonly saveId: string;
    readonly publicationRevision: number;
    readonly ageYears: number;
    /** Zero-based chapter in play; equals `chapterCount` once complete. */
    readonly chapterIndex: number;
    readonly chapterName: string | null;
    readonly completed: boolean;
  } | null;
  /** The run froze an older publication; an administrator can start fresh. */
  readonly newerPublication: boolean;
}

export interface FamilyJourneysResponse {
  readonly journeys: readonly FamilyJourneyCard[];
}

export interface FamilyWorldChapterView {
  readonly routeId: string;
  readonly chapterId: string;
  readonly name: string;
  readonly subtitle: string;
  readonly description: string;
  readonly level: WorldEditorLevelDocument;
}

/** The frozen, name-free geometry a family save plays. */
export interface FamilyWorldView {
  readonly saveId: string;
  readonly templateId: string;
  readonly templateVersion: string;
  readonly chapters: readonly FamilyWorldChapterView[];
}

export interface FamilyPlayRequest {
  /** Administrator only: "Start fresh with these photos". */
  readonly fresh?: boolean;
}

export interface FamilyPlayResponse {
  readonly save: SaveView;
  readonly world: FamilyWorldView;
  readonly created: boolean;
}
