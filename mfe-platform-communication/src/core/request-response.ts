import type { MessageBase } from '../contracts/message-base.js';
import { BusValidationError } from './errors.js';

interface Pending {
  readonly resolve: (message: MessageBase) => void;
  readonly reject: (error: Error) => void;
  readonly timer: ReturnType<typeof setTimeout>;
}

export class RequestResponseCoordinator {
  private readonly pendingByCausationId = new Map<string, Pending>();

  waitForResponse(causationId: string, timeoutMs: number): Promise<MessageBase> {
    return new Promise<MessageBase>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingByCausationId.delete(causationId);
        reject(new BusValidationError('request timed out', 'timeout'));
      }, timeoutMs);
      this.pendingByCausationId.set(causationId, {
        resolve,
        reject,
        timer,
      });
    });
  }

  tryResolve(incoming: MessageBase): boolean {
    if (!incoming.causationId) {
      return false;
    }
    const pending = this.pendingByCausationId.get(incoming.causationId);
    if (!pending) {
      return false;
    }
    clearTimeout(pending.timer);
    this.pendingByCausationId.delete(incoming.causationId);
    pending.resolve(incoming);
    return true;
  }

  dispose(): void {
    for (const p of this.pendingByCausationId.values()) {
      clearTimeout(p.timer);
      p.reject(new BusValidationError('bus disposed', 'delivery'));
    }
    this.pendingByCausationId.clear();
  }
}
