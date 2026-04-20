import type { MessageBase } from './message-base.js';

export interface CommandMessage<TPayload = unknown> extends MessageBase {
  readonly kind: 'command';
  readonly commandName: string;
  readonly payload: TPayload;
  readonly ackTimeoutMs?: number;
}
