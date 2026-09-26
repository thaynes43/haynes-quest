/**
 * Background automatic picks. A full journey pick is bounded per slot (D-04)
 * but can outlast an HTTP request through the tunnel, so the admin route starts
 * it here and the Memories screen polls the draft. One pick runs per child;
 * state is in-process, so a restart simply lets the administrator start again.
 */
import { AppError } from '../errors.js';

export interface AutoPickStatus {
  readonly picking: boolean;
  /** A fixed error code, never a message. */
  readonly lastError: string | null;
}

export class AutoPickJobs {
  private readonly running = new Map<string, Promise<void>>();
  private readonly failures = new Map<string, string>();

  constructor(private readonly onFailure: (code: string) => void = () => undefined) {}

  /** Starts `task` for `childId` unless one is already running. */
  start(childId: string, task: () => Promise<unknown>): void {
    if (this.running.has(childId)) throw new AppError(409, 'AUTO_PICK_RUNNING', 'Photos are being picked');
    this.failures.delete(childId);
    const job = (async () => {
      try {
        await task();
      } catch (error) {
        const code = error instanceof AppError ? error.code : 'AUTO_PICK_FAILED';
        this.failures.set(childId, code);
        this.onFailure(code);
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
