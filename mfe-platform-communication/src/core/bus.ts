import type { ZodType, ZodTypeAny } from 'zod';
import type { MessageBase } from '../contracts/message-base.js';
import type { AckResult, Nack } from '../contracts/envelopes.js';
import { CommandMessageSchema } from '../schemas/command-message.schema.js';
import { QueryMessageSchema } from '../schemas/query-message.schema.js';
import { readBusMessageFromEvent } from './bus-event.js';
import { createDedupeGate } from './dedupe.js';
import { createMessageQueue, type DispatchMode } from './dispatcher.js';
import { BusPolicyError, BusValidationError } from './errors.js';
import type { ObservabilityAdapter } from './observability.js';
import { defaultSensitivityPolicy, composePolicies } from './policy.js';
import { TopicRegistry } from './registry.js';
import { RequestResponseCoordinator } from './request-response.js';

const DEFAULT_REQUEST_TIMEOUT_MS = 5_000;
const DEFAULT_ACK_TIMEOUT_MS = 5_000;

function extractQueryTimeoutMs(message: MessageBase): number | undefined {
  const parsed = QueryMessageSchema.safeParse(message);
  if (!parsed.success) {
    return undefined;
  }
  return parsed.data.timeoutMs;
}

function extractExpectedResult(message: MessageBase): string | undefined {
  const parsed = QueryMessageSchema.safeParse(message);
  if (!parsed.success) {
    return undefined;
  }
  return parsed.data.expectedResult;
}

function extractAckTimeoutMs(message: MessageBase): number | undefined {
  const parsed = CommandMessageSchema.safeParse(message);
  if (!parsed.success) {
    return undefined;
  }
  return parsed.data.ackTimeoutMs;
}

function errorToNack(correlationId: string, error: unknown): Nack {
  const receivedAtUtc = new Date().toISOString();
  if (error instanceof BusPolicyError || error instanceof BusValidationError) {
    return {
      accepted: false,
      correlationId,
      errorCode: error.code,
      message: error.message,
      receivedAtUtc,
    };
  }
  return {
    accepted: false,
    correlationId,
    errorCode: 'unknown',
    message: error instanceof Error ? error.message : 'unknown error',
    receivedAtUtc,
  };
}

export type Unsubscribe = () => void;

export type PublishOutcome =
  | { readonly status: 'delivered' }
  | { readonly status: 'dedupe' }
  | { readonly status: 'rejected' };

export interface BusPublisher {
  publish<M extends MessageBase>(message: M): void;
  attemptPublish<M extends MessageBase>(message: M): PublishOutcome;
  sendCommand<TCmd extends MessageBase>(command: TCmd): Promise<AckResult>;
  request<TReq extends MessageBase>(message: TReq, timeoutMs?: number): Promise<MessageBase>;
  request<TReq extends MessageBase, TRes extends MessageBase>(
    message: TReq,
    timeoutMs: number | undefined,
    responseValidator: ZodType<TRes>,
  ): Promise<TRes>;
}

export interface BusSubscribeOptions {
  readonly subscriberId?: string;
}

export interface BusSubscriber {
  subscribe(
    messageName: string,
    handler: (message: MessageBase) => void | Promise<void>,
    options?: BusSubscribeOptions,
  ): Unsubscribe;
}

export interface Bus extends BusPublisher, BusSubscriber {
  readonly appId: string;
  observeAll(handler: (message: MessageBase) => void): Unsubscribe;
  registerBeforeDeliver(handler: (message: MessageBase) => void): Unsubscribe;
  dispose(): void;
}

export interface CreateBusOptions {
  readonly appId: string;
  readonly defaultSubscriberId?: string;
  readonly dispatch?: DispatchMode;
  readonly dedupe?: { enabled: boolean; windowMs: number };
  readonly validators: Readonly<Record<string, ZodTypeAny>>;
  readonly policy?: (message: MessageBase) => void;
  readonly registry?: TopicRegistry;
  readonly autoRegisterTopics?: boolean;
  readonly allowUnregisteredMessageNames?: boolean;
  readonly messageTtlMs?: number;
  readonly enableDefaultSensitivityPolicy?: boolean;
  readonly onDispatchError?: (error: unknown) => void;
  readonly onSubscriberError?: (error: unknown) => void;
  readonly onDedupe?: (message: MessageBase) => void;
  readonly failFastOnDispatchError?: boolean;
  readonly observability?: ObservabilityAdapter;
}

const BUS_EVENT_TYPE = '@lkovari/microfrontend-platform-communication/message';

type PrepareSyncResult = 'deliver' | 'dedupe';

function assertIsoWithinTtl(occurredAtUtc: string, ttlMs: number): void {
  const t = Date.parse(occurredAtUtc);
  if (Number.isNaN(t)) {
    throw new BusValidationError('invalid occurredAtUtc', 'validation');
  }
  if (Date.now() - t > ttlMs) {
    throw new BusValidationError('message expired', 'timeout');
  }
}

function resolveRegistry(options: CreateBusOptions): TopicRegistry | undefined {
  if (options.autoRegisterTopics !== true) {
    return options.registry;
  }
  const registry = options.registry ?? new TopicRegistry();
  registry.registerFromValidators(options.validators);
  return registry;
}

export function createBus(options: CreateBusOptions): Bus {
  const defaultSubscriberId = options.defaultSubscriberId ?? options.appId;
  const target = new EventTarget();
  const queue = createMessageQueue(options.dispatch ?? 'microtask');
  const dedupe =
    options.dedupe?.enabled === true ? createDedupeGate(options.dedupe.windowMs) : undefined;
  const rr = new RequestResponseCoordinator();
  const allowUnregistered = options.allowUnregisteredMessageNames === true;
  const ttlMs = options.messageTtlMs;
  const observability = options.observability;

  const registry = resolveRegistry(options);

  const defaultPolicyOn = options.enableDefaultSensitivityPolicy ?? true;

  const policy = composePolicies(
    ...(defaultPolicyOn ? [defaultSensitivityPolicy] : []),
    ...(options.policy ? [options.policy] : []),
  );

  type Listener = (event: Event) => void;
  const listenerRecords: { readonly messageName: string; readonly listener: Listener }[] = [];
  const observeRecords: { readonly listener: Listener }[] = [];
  const beforeDeliverHooks: ((message: MessageBase) => void)[] = [];

  function notifySubscriberError(error: unknown): void {
    observability?.onError(error, 'subscriber');
    if (options.onSubscriberError) {
      options.onSubscriberError(error);
      return;
    }
    if (options.onDispatchError) {
      options.onDispatchError(error);
      return;
    }
    console.error('[mfe-bus] subscriber handler error', error);
  }

  function validate(message: MessageBase): void {
    const schema = options.validators[message.messageName];
    if (!schema) {
      if (!allowUnregistered) {
        throw new BusValidationError(
          `no validator registered for ${message.messageName}`,
          'validation',
        );
      }
      return;
    }
    const parsed = schema.safeParse(message);
    if (!parsed.success) {
      throw new BusValidationError(parsed.error.message, 'validation');
    }
  }

  function deliver(message: MessageBase): void {
    observability?.onDeliver(message);
    const event = new CustomEvent<MessageBase>(BUS_EVENT_TYPE, {
      detail: message,
      bubbles: false,
      cancelable: false,
    });

    target.dispatchEvent(event);
  }

  function prepareSync(message: MessageBase): PrepareSyncResult {
    if (ttlMs !== undefined) {
      assertIsoWithinTtl(message.occurredAtUtc, ttlMs);
    }

    validate(message);

    if (dedupe) {
      const now = Date.now();
      if (dedupe.shouldDrop(message.messageId, now)) {
        return 'dedupe';
      }
    }

    policy(message);
    registry?.assertCanPublish(message);

    for (const hook of beforeDeliverHooks) {
      hook(message);
    }

    return 'deliver';
  }

  function handlePublishError(err: unknown, fromRequest: boolean): void {
    observability?.onError(err, fromRequest ? 'request' : 'dispatch');
    if (options.onDispatchError) {
      options.onDispatchError(err);
      if (options.failFastOnDispatchError === true && fromRequest) {
        if (err instanceof Error) {
          throw err;
        }
        throw new BusValidationError('unknown publish failure', 'unknown');
      }
      return;
    }
    if (err instanceof Error) {
      throw err;
    }
    throw new BusValidationError('unknown publish failure', 'unknown');
  }

  function runPublish<M extends MessageBase>(message: M, fromRequest: boolean): PublishOutcome {
    observability?.onPublish(message);
    let prep: PrepareSyncResult;
    try {
      prep = prepareSync(message);
    } catch (err: unknown) {
      handlePublishError(err, fromRequest);
      return { status: 'rejected' };
    }

    if (prep === 'dedupe') {
      options.onDedupe?.(message);
      return { status: 'dedupe' };
    }

    queue.enqueue(() => {
      deliver(message);
      rr.tryResolve(message);
    });
    return { status: 'delivered' };
  }

  const bus: Bus = {
    appId: options.appId,

    publish<M extends MessageBase>(message: M): void {
      runPublish(message, false);
    },

    attemptPublish<M extends MessageBase>(message: M): PublishOutcome {
      return runPublish(message, false);
    },

    async sendCommand<TCmd extends MessageBase>(command: TCmd): Promise<AckResult> {
      const { correlationId } = command;
      const ackTimeoutMs = extractAckTimeoutMs(command) ?? DEFAULT_ACK_TIMEOUT_MS;
      const wait = rr.waitForResponse(command.messageId, ackTimeoutMs).catch((err: unknown) => {
        if (err instanceof BusValidationError && err.code === 'timeout') {
          observability?.onRequestTimeout(command.messageId);
        }
        throw err;
      });
      try {
        const outcome = runPublish(command, true);
        if (outcome.status === 'dedupe') {
          rr.cancelRequest(command.messageId, new BusValidationError('duplicate messageId', 'dedupe'));
        } else if (outcome.status === 'rejected') {
          rr.cancelRequest(command.messageId, new BusValidationError('command publish rejected', 'delivery'));
        }
      } catch (err: unknown) {
        const error =
          err instanceof Error ? err : new BusValidationError('command publish failed', 'delivery');
        rr.cancelRequest(command.messageId, error);
        void wait.catch(() => undefined);
        return errorToNack(correlationId, error);
      }
      try {
        const ack = await wait;
        return {
          accepted: true,
          correlationId: ack.correlationId ?? correlationId,
          receivedAtUtc: new Date().toISOString(),
        };
      } catch (err: unknown) {
        return errorToNack(correlationId, err);
      }
    },

    async request<TReq extends MessageBase, TRes extends MessageBase>(
      message: TReq,
      timeoutMs?: number,
      responseValidator?: ZodType<TRes>,
    ): Promise<MessageBase | TRes> {
      const effectiveTimeoutMs =
        timeoutMs ?? extractQueryTimeoutMs(message) ?? DEFAULT_REQUEST_TIMEOUT_MS;
      const wait = rr
        .waitForResponse(message.messageId, effectiveTimeoutMs)
        .catch((err: unknown) => {
          if (err instanceof BusValidationError && err.code === 'timeout') {
            observability?.onRequestTimeout(message.messageId);
          }
          throw err;
        });
      try {
        const outcome = runPublish(message, true);
        if (outcome.status === 'dedupe') {
          const dedupeError = new BusValidationError('duplicate messageId', 'dedupe');
          rr.cancelRequest(message.messageId, dedupeError);
          throw dedupeError;
        }
      } catch (err: unknown) {
        const error =
          err instanceof Error ? err : new BusValidationError('request publish failed', 'delivery');
        rr.cancelRequest(message.messageId, error);
        void wait.catch(() => undefined);
        throw error;
      }
      const result = await wait;
      if (result.causationId !== message.messageId) {
        throw new BusValidationError(
          'response causationId must equal request messageId',
          'validation',
        );
      }
      if (responseValidator) {
        const parsed = responseValidator.safeParse(result);
        if (!parsed.success) {
          throw new BusValidationError(parsed.error.message, 'validation');
        }
        return parsed.data;
      }
      const expectedResult = extractExpectedResult(message);
      if (expectedResult !== undefined && result.messageName !== expectedResult) {
        throw new BusValidationError(
          `response messageName must equal expectedResult "${expectedResult}"`,
          'validation',
        );
      }
      return result;
    },

    subscribe(
      messageName: string,
      handler: (message: MessageBase) => void | Promise<void>,
      subscribeOptions?: BusSubscribeOptions,
    ): Unsubscribe {
      const subscriberId = subscribeOptions?.subscriberId ?? defaultSubscriberId;
      registry?.assertCanSubscribe(messageName, subscriberId);

      const listener: Listener = (event: Event) => {
        const detail = readBusMessageFromEvent(event);
        if (detail === null) {
          return;
        }
        if (detail.messageName !== messageName) {
          return;
        }
        if (detail.target !== undefined && detail.target !== subscriberId) {
          return;
        }
        void Promise.resolve(handler(detail)).catch((err: unknown) => {
          notifySubscriberError(err);
        });
      };

      target.addEventListener(BUS_EVENT_TYPE, listener);
      listenerRecords.push({ messageName, listener });

      return () => {
        target.removeEventListener(BUS_EVENT_TYPE, listener);
        const idx = listenerRecords.findIndex((r) => r.listener === listener);
        if (idx >= 0) {
          listenerRecords.splice(idx, 1);
        }
      };
    },

    observeAll(handler: (message: MessageBase) => void): Unsubscribe {
      const listener: Listener = (event: Event) => {
        const detail = readBusMessageFromEvent(event);
        if (detail === null) {
          return;
        }
        try {
          handler(detail);
        } catch (err: unknown) {
          observability?.onError(err, 'observeAll');
          notifySubscriberError(err);
        }
      };
      target.addEventListener(BUS_EVENT_TYPE, listener);
      observeRecords.push({ listener });
      return () => {
        target.removeEventListener(BUS_EVENT_TYPE, listener);
        const idx = observeRecords.findIndex((r) => r.listener === listener);
        if (idx >= 0) {
          observeRecords.splice(idx, 1);
        }
      };
    },

    registerBeforeDeliver(handler: (message: MessageBase) => void): Unsubscribe {
      beforeDeliverHooks.push(handler);
      return () => {
        const idx = beforeDeliverHooks.indexOf(handler);
        if (idx >= 0) {
          beforeDeliverHooks.splice(idx, 1);
        }
      };
    },

    dispose(): void {
      rr.dispose();
      for (const record of listenerRecords) {
        target.removeEventListener(BUS_EVENT_TYPE, record.listener);
      }
      listenerRecords.length = 0;
      for (const record of observeRecords) {
        target.removeEventListener(BUS_EVENT_TYPE, record.listener);
      }
      observeRecords.length = 0;
      beforeDeliverHooks.length = 0;
    },
  };

  return bus;
}
