import type { MessageBase } from './message-base.js';

export type StateOperation = 'replace' | 'patch' | 'remove' | 'reset';

export interface StateMessage<TState = unknown> extends MessageBase {
  readonly kind: 'state';
  readonly stateKey: string;
  readonly operation: StateOperation;
  readonly revision: number;
  readonly payload: TState;
}
