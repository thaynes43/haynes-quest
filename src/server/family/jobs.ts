/**
 * Background automatic picks and world updates. A full journey pick is bounded
 * per slot (D-04) but can outlast an HTTP request through the tunnel, so the
 * admin routes start it here and the Memories screen polls the draft. One job
 * runs per child; state is in-process, so a restart simply lets the
 * administrator start again.
 */
import { AppError } from '../errors.js';

/** What a background job does; failures are reported per kind. */
export type FamilyJobKind = 'auto-pick' | 'template-upgrade';

export interface AutoPickStatus {
  readonly picking: boolean;
  /** A fixed error code, never a message. */
  readonly lastError: string | null;
}

export class AutoPickJobs {
  private readonly running = new Map<string, Promise<void>>();
  private readonly failures = new Map<string, string>();

  constructor(private readonly onFailure: (code: string, kind: FamilyJobKind) => void = () => undefined) {}

  /**
   * Starts `task` for `childId` unless one is already running. An automatic
   * pick and a world update (DESIGN-024 D-11) share the one slot per child.
   */
  start(childId: string, task: () => Promise<unknown>, kind: FamilyJobKind = 'auto-pick'): void {
    if (this.running.has(childId)) throw new AppError(409, 'AUTO_PICK_RUNNING', 'Photos are being picked');
    this.failures.delete(childId);
    const job = (async () => {
      try {
        await task();
      } catch (error) {
        const code = error instanceof AppError ? error.code : 'AUTO_PICK_FAILED';
        this.failures.set(childId, code);
        this.onFailure(code, kind);
      } finally {
        this.running.delete(childId);
      }
    })();
    this.running.set(childId, job);
  }

  status(childId: string): AutoPickStatus {
    return { picking: this.running.has(childId), lastError: this.failures.get(childId) ?? null };
  }

  /** Resolves once the child's current pick, if any, has finished (tests, shutdown). */
  async settled(childId?: string): Promise<void> {
    const jobs = childId ? [this.running.get(childId)] : [...this.running.values()];
    await Promise.all(jobs.filter(Boolean));
  }
}
