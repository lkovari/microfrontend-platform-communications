import type { MessageBase } from '../contracts/message-base.js';

export type ObservabilityContext = 'dispatch' | 'subscriber' | 'observeAll' | 'request';

export interface ObservabilityAdapter {
  onPublish(message: MessageBase): void;
  onDeliver(message: MessageBase): void;
  onError(error: unknown, context: ObservabilityContext): void;
  onRequestTimeout(requestMessageId: string): void;
}

export class ConsoleObservabilityAdapter implements ObservabilityAdapter {
  onPublish(message: MessageBase): void {
    console.info('[mfe-bus] publish', message.messageName, message.messageId);
  }

  onDeliver(message: MessageBase): void {
    console.info('[mfe-bus] deliver', message.messageName, message.messageId);
  }

  onError(error: unknown, context: ObservabilityContext): void {
    console.error('[mfe-bus] error', context, error);
  }

  onRequestTimeout(requestMessageId: string): void {
    console.warn('[mfe-bus] request timeout', requestMessageId);
  }
}
