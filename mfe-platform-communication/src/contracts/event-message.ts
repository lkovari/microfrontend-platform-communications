import type { MessageBase } from './message-base.js';

export interface EventMessage<TPayload = unknown> extends MessageBase {
  readonly kind: 'event';
  readonly eventKind: string;
  readonly payload: TPayload;
}
