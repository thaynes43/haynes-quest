/**
 * Family journey persistence (DESIGN-024 D-02). Children, drafts and
 * publications are household data: every admitted person sees the same
 * children (ADR-005 D-04). Actor ids are audit fields only; `null` records the
 * operator CLI (D-09), which acts without a player session.
 */
import type { RuleVersions } from '../../shared/contracts.js';
import type { FamilyMemorySlot, FamilyWorldAdventurePlanV1 } from '../../shared/family-plan.js';
import type { FrozenMemory } from '../domain.js';
import type { RebasedChapter } from './rebase.js';

export interface ChildProfile {
  /** Friendly name shown to the household. Private. */
  readonly displayName: string;
  /** The name used to look the child up in Immich. Private. */
  readonly immichName: string;
  /** Upstream Immich person id. Private and server-only. */
  readonly immichPersonId: string;
  /** Explicit, administrator-confirmed birthday. Private. */
  readonly birthDate: string;
  readonly templateId: string;
  readonly templateVersion: string;
}

export interface ChildRecord extends ChildProfile {
  readonly id: string;
  readonly revision: number;
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export type DraftChapter = RebasedChapter;

export interface DraftSlotReason {
  readonly source: 'auto' | 'admin';
  readonly window?: 'preferred' | 'widened';
  readonly query?: string | null;
  readonly score?: number;
  readonly faces?: number | null;
  readonly timedOut?: boolean;
  readonly degraded?: boolean;
}

export interface DraftSlot {
  readonly chapterId: string;
  readonly slot: FamilyMemorySlot;
  readonly status: 'filled' | 'needs-photo';
  /** Upstream Immich asset id. Private and server-only. */
  readonly assetId: string | null;
  readonly localDate: string | null;
  readonly caption: string | null;
  readonly captionEdited: boolean;
  readonly reason: DraftSlotReason | null;
}

export interface DraftContent {
  readonly templateId: string;
  readonly templateVersion: string;
  /** Makes the automatic picks deterministic (D-04). */
  readonly seed: string;
  /** The birthday the chapters were rebased with. */
  readonly birthDate: string;
  /** The day the draft was rebased; it fixes the final chapter's birthday. */
  readonly rebasedOn: string;
  readonly chapters: readonly DraftChapter[];
  readonly slots: readonly DraftSlot[];
}

export interface DraftRecord extends DraftContent {
  readonly id: string;
  readonly childId: string;
  readonly revision: number;
  readonly updatedBy: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface PublicationRecord {
  readonly id: string;
  readonly childId: string;
  /** Monotonic per child, starting at 1. */
  readonly revision: number;
  readonly requestId: string;
  readonly draftRevision: number;
  readonly birthDate: string;
  readonly plan: FamilyWorldAdventurePlanV1;
  /** Private save manifest with upstream Immich references. */
  readonly memories: readonly FrozenMemory[];
  readonly versions: RuleVersions;
  readonly publishedBy: string | null;
  readonly publishedAt: Date;
}

export interface BuiltPublication {
  readonly plan: FamilyWorldAdventurePlanV1;
  readonly memories: readonly FrozenMemory[];
  readonly versions: RuleVersions;
}

export interface PublishCommand {
  readonly childId: string;
  /** Idempotency key: the same id returns the same publication. */
  readonly requestId: string;
  readonly expectedDraftRevision: number;
  readonly actorId: string | null;
  /** Pure and synchronous; runs inside the publish transaction. */
  build(child: ChildRecord, draft: DraftRecord): BuiltPublication;
}

/**
 * DESIGN-024 D-11: move a child to another template version and replace its
 * draft in one step. Both writes are compare-and-set; either conflict leaves
 * the child and the draft unchanged.
 */
export interface TemplateChangeCommand {
  readonly childId: string;
  readonly expectedChildRevision: number;
  /** `null` when the child has no draft yet: the rebuilt draft is its first. */
  readonly expectedDraftRevision: number | null;
  readonly templateId: string;
  readonly templateVersion: string;
  readonly draft: DraftContent;
  readonly actorId: string | null;
}

export interface FamilyStore {
  createChild(profile: ChildProfile, actorId: string | null): Promise<ChildRecord>;
  getChild(childId: string): Promise<ChildRecord | null>;
  listChildren(): Promise<ChildRecord[]>;
  /** Compare-and-set on the child revision. */
  updateChild(
    childId: string,
    expectedRevision: number,
    patch: Partial<ChildProfile>,
    actorId: string | null,
  ): Promise<ChildRecord>;
  getDraft(childId: string): Promise<DraftRecord | null>;
  /**
   * `expectedRevision: null` creates the child's first draft; a number is a
   * compare-and-set on the current draft revision.
   */
  saveDraft(
    childId: string,
    expectedRevision: number | null,
    content: DraftContent,
    actorId: string | null,
  ): Promise<DraftRecord>;
  /** Atomic template change plus draft rebuild (D-11); publications are untouched. */
  changeTemplate(command: TemplateChangeCommand): Promise<{ child: ChildRecord; draft: DraftRecord }>;
  publish(command: PublishCommand): Promise<PublicationRecord>;
  getPublication(publicationId: string): Promise<PublicationRecord | null>;
  latestPublication(childId: string): Promise<PublicationRecord | null>;
  /** The latest publication of every child that has one. */
  listLatestPublications(): Promise<PublicationRecord[]>;
}

export const FAMILY_LIMITS = Object.freeze({
  displayNameMax: 40,
  immichNameMax: 120,
  maxChildren: 12,
});
