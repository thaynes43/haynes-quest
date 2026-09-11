import type { SaveView } from '../shared/contracts';
import type { RequestError, RequestState } from './types';

export interface ProgressionState {
  requestState: RequestState;
  requestError: RequestError;
}

export interface ProgressionCallbacks {
  onRecover: (memoryId: string) => Promise<SaveView>;
  onFinish: () => Promise<SaveView>;
  onApply: (save: SaveView) => void;
  onState: (state: ProgressionState) => void;
}

export class AuthoritativeProgression {
  private alive = true;
  private epoch = 0;
  private state: ProgressionState = { requestState: 'idle', requestError: null };

  constructor(private readonly callbacks: ProgressionCallbacks) {}

  inspect(): ProgressionState {
    return { ...this.state };
  }

  recover(memoryId: string): void {
    this.request('recover', () => this.callbacks.onRecover(memoryId));
  }

  finish(): void {
    this.request('finish', this.callbacks.onFinish);
  }

  authoritativeUpdate(save: SaveView): void {
    if (!this.alive) return;
    this.epoch += 1;
    this.setState('idle', null);
    this.callbacks.onApply(save);
  }

  dispose(): void {
    this.alive = false;
    this.epoch += 1;
  }

  private request(kind: 'recover' | 'finish', request: () => Promise<SaveView>): void {
    if (!this.alive || this.state.requestState === 'recovering' || this.state.requestState === 'finishing') return;
    const requestEpoch = ++this.epoch;
    this.setState(kind === 'recover' ? 'recovering' : 'finishing', null);
    void Promise.resolve().then(request).then(
      (save) => {
        if (!this.alive || requestEpoch !== this.epoch) return;
        this.setState('idle', null);
        this.callbacks.onApply(save);
      },
      () => {
        if (!this.alive || requestEpoch !== this.epoch) return;
        this.setState('error', kind);
      },
    );
  }

  private setState(requestState: RequestState, requestError: RequestError): void {
    this.state = { requestState, requestError };
    if (this.alive) this.callbacks.onState(this.inspect());
  }
}
