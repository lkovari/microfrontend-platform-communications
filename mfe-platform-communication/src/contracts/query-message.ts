import type { MessageBase } from './message-base.js';

export interface QueryMessage<TPayload = unknown, _TResult = unknown> extends MessageBase {
  readonly kind: 'query';
  readonly queryName: string;
  readonly payload: TPayload;
  readonly expectedResult?: string;
  readonly timeoutMs?: number;
}
