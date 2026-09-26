import { randomUUID } from 'node:crypto';
import { AppError } from '../errors.js';
import type {
  ChildProfile,
  ChildRecord,
  DraftContent,
  DraftRecord,
  FamilyStore,
  PublicationRecord,
  PublishCommand,
  TemplateChangeCommand,
} from './store.js';

/** In-process family store with the same compare-and-set and idempotency rules as Postgres. */
export class InMemoryFamilyStore implements FamilyStore {
  private readonly children = new Map<string, ChildRecord>();
  private readonly drafts = new Map<string, DraftRecord>();
  private readonly publications = new Map<string, PublicationRecord>();
  private locked: Promise<void> = Promise.resolve();

  constructor(private readonly now: () => Date = () => new Date()) {}

  async createChild(profile: ChildProfile, actorId: string | null): Promise<ChildRecord> {
    return this.exclusive(() => {
      if ([...this.children.values()].some((child) => child.immichPersonId === profile.immichPersonId)) {
        throw new AppError(409, 'CHILD_EXISTS', 'Child already configured');
      }
      const now = this.now();
      const child: ChildRecord = {
        ...structuredClone(profile),
        id: randomUUID(),
        revision: 0,
        createdBy: actorId,
        updatedBy: actorId,
        createdAt: now,
        updatedAt: now,
      };
      this.children.set(child.id, child);
      return cloneRecord(child);
    });
  }

  async getChild(childId: string): Promise<ChildRecord | null> {
    const child = this.children.get(childId);
    return child ? cloneRecord(child) : null;
  }

  async listChildren(): Promise<ChildRecord[]> {
    return [...this.children.values()]
      .sort((left, right) => left.createdAt.valueOf() - right.createdAt.valueOf() || left.id.localeCompare(right.id))
      .map(cloneRecord);
  }

  async updateChild(
    childId: string,
    expectedRevision: number,
    patch: Partial<ChildProfile>,
    actorId: string | null,
  ): Promise<ChildRecord> {
    return this.exclusive(() => {
      const child = this.children.get(childId);
      if (!child) throw new AppError(404, 'CHILD_NOT_FOUND', 'Child not found');
      if (child.revision !== expectedRevision) throw new AppError(409, 'CHILD_CONFLICT', 'Child changed');
      if (
        patch.immichPersonId !== undefined &&
        [...this.children.values()].some((other) => other.id !== childId && other.immichPersonId === patch.immichPersonId)
      ) throw new AppError(409, 'CHILD_EXISTS', 'Child already configured');
      const next: ChildRecord = {
        ...child,
        ...definedOnly(structuredClone(patch)),
        revision: child.revision + 1,
        updatedBy: actorId,
        updatedAt: this.now(),
      };
      this.children.set(childId, next);
      return cloneRecord(next);
    });
  }

  async getDraft(childId: string): Promise<DraftRecord | null> {
    const draft = this.drafts.get(childId);
    return draft ? cloneRecord(draft) : null;
  }

  async saveDraft(
    childId: string,
    expectedRevision: number | null,
    content: DraftContent,
    actorId: string | null,
  ): Promise<DraftRecord> {
    return this.exclusive(() => {
      if (!this.children.has(childId)) throw new AppError(404, 'CHILD_NOT_FOUND', 'Child not found');
      const current = this.drafts.get(childId);
      if (expectedRevision === null ? current !== undefined : current?.revision !== expectedRevision) {
        throw new AppError(409, 'DRAFT_CONFLICT', 'Draft changed');
      }
      const now = this.now();
      const draft: DraftRecord = {
        ...structuredClone(content),
        id: current?.id ?? randomUUID(),
        childId,
        revision: current ? current.revision + 1 : 0,
        updatedBy: actorId,
        createdAt: current?.createdAt ?? now,
        updatedAt: now,
      };
      this.drafts.set(childId, draft);
      return cloneRecord(draft);
    });
  }

  async changeTemplate(command: TemplateChangeCommand): Promise<{ child: ChildRecord; draft: DraftRecord }> {
    return this.exclusive(() => {
      const child = this.children.get(command.childId);
      if (!child) throw new AppError(404, 'CHILD_NOT_FOUND', 'Child not found');
      if (child.revision !== command.expectedChildRevision) throw new AppError(409, 'CHILD_CONFLICT', 'Child changed');
      const current = this.drafts.get(command.childId);
      if (command.expectedDraftRevision === null ? current !== undefined : current?.revision !== command.expectedDraftRevision) {
        throw new AppError(409, 'DRAFT_CONFLICT', 'Draft changed');
      }
      const now = this.now();
      const nextChild: ChildRecord = {
        ...child,
        templateId: command.templateId,
        templateVersion: command.templateVersion,
        revision: child.revision + 1,
        updatedBy: command.actorId,
        updatedAt: now,
      };
      const draft: DraftRecord = {
        ...structuredClone(command.draft),
        id: current?.id ?? randomUUID(),
        childId: command.childId,
        revision: current ? current.revision + 1 : 0,
        updatedBy: command.actorId,
        createdAt: current?.createdAt ?? now,
        updatedAt: now,
      };
      this.children.set(command.childId, nextChild);
      this.drafts.set(command.childId, draft);
      return { child: cloneRecord(nextChild), draft: cloneRecord(draft) };
    });
  }

  async publish(command: PublishCommand): Promise<PublicationRecord> {
    return this.exclusive(() => {
      const child = this.children.get(command.childId);
      if (!child) throw new AppError(404, 'CHILD_NOT_FOUND', 'Child not found');
      const prior = [...this.publications.values()].filter((entry) => entry.childId === command.childId);
      const replay = prior.find((entry) => entry.requestId === command.requestId);
      if (replay) {
        if (replay.draftRevision !== command.expectedDraftRevision) {
          throw new AppError(409, 'REQUEST_ID_REUSED', 'Request already used');
        }
        return cloneRecord(replay);
      }
      const draft = this.drafts.get(command.childId);
      if (!draft) throw new AppError(404, 'DRAFT_NOT_FOUND', 'Draft not found');
      if (draft.revision !== command.expectedDraftRevision) {
        throw new AppError(409, 'DRAFT_CONFLICT', 'Draft changed');
      }
      const built = command.build(cloneRecord(child), cloneRecord(draft));
      const publication: PublicationRecord = {
        id: randomUUID(),
        childId: command.childId,
        revision: prior.reduce((max, entry) => Math.max(max, entry.revision), 0) + 1,
        requestId: command.requestId,
        draftRevision: draft.revision,
        birthDate: draft.birthDate,
        plan: structuredClone(built.plan),
        memories: structuredClone(built.memories),
        versions: structuredClone(built.versions),
        publishedBy: command.actorId,
        publishedAt: this.now(),
      };
      this.publications.set(publication.id, publication);
      return cloneRecord(publication);
    });
  }

  async getPublication(publicationId: string): Promise<PublicationRecord | null> {
    const publication = this.publications.get(publicationId);
    return publication ? cloneRecord(publication) : null;
  }

  async latestPublication(childId: string): Promise<PublicationRecord | null> {
    const latest = [...this.publications.values()]
      .filter((entry) => entry.childId === childId)
      .sort((left, right) => right.revision - left.revision)[0];
    return latest ? cloneRecord(latest) : null;
  }

  async listLatestPublications(): Promise<PublicationRecord[]> {
    const latest = new Map<string, PublicationRecord>();
    for (const publication of this.publications.values()) {
      const current = latest.get(publication.childId);
      if (!current || publication.revision > current.revision) latest.set(publication.childId, publication);
    }
    const order = new Map([...this.children.values()].map((child) => [child.id, child.createdAt.valueOf()]));
    return [...latest.values()]
      .sort((left, right) => (order.get(left.childId) ?? 0) - (order.get(right.childId) ?? 0))
      .map(cloneRecord);
  }

  private async exclusive<T>(callback: () => T | Promise<T>): Promise<T> {
    const previous = this.locked;
    let release!: () => void;
    this.locked = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await callback();
    } finally {
      release();
    }
  }
}

function cloneRecord<T>(record: T): T {
  return structuredClone(record);
}

function definedOnly<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as Partial<T>;
}
