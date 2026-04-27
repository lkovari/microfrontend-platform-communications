import type { ZodTypeAny } from 'zod';
import type { MessageBase } from '../contracts/message-base.js';
import { createDedupeGate } from './dedupe.js';
import { createMessageQueue, type DispatchMode } from './dispatcher.js';
import { BusValidationError } from './errors.js';
import { defaultSensitivityPolicy, composePolicies } from './policy.js';
import type { TopicRegistry } from './registry.js';
import { RequestResponseCoordinator } from './request-response.js';

export type Unsubscribe = () => void;

export interface BusPublisher {
  publish<M extends MessageBase>(message: M): void;
  request<TReq extends MessageBase, TRes extends MessageBase>(
    message: TReq,
    timeoutMs?: number,
    responseValidator?: ZodTypeAny,
  ): Promise<TRes>;
}

export interface BusSubscribeOptions {
  readonly subscriberId?: string;
}

export interface BusSubscriber {
  subscribe<M extends MessageBase>(
    messageName: string,
    handler: (message: M) => void | Promise<void>,
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
  readonly allowUnregisteredMessageNames?: boolean;
  readonly messageTtlMs?: number;
  readonly enableDefaultSensitivityPolicy?: boolean;
  readonly onDispatchError?: (error: unknown) => void;
  readonly onSubscriberError?: (error: unknown) => void;
}

const BUS_EVENT_TYPE = '@lkovari/microfrontend-platform-communication/message';

function assertIsoWithinTtl(occurredAtUtc: string, ttlMs: number): void {
  const t = Date.parse(occurredAtUtc);
  if (Number.isNaN(t)) {
    throw new BusValidationError('invalid occurredAtUtc', 'validation');
  }
  if (Date.now() - t > ttlMs) {
    throw new BusValidationError('message expired', 'timeout');
  }
}

export function createBus(options: CreateBusOptions): Bus {
  const defaultSubscriberId = options.defaultSubscriberId ?? options.appId;
  const target = new EventTarget();
  const queue = createMessageQueue(options.dispatch ?? 'microtask');
  const dedupe =
    options.dedupe?.enabled === true
      ? createDedupeGate(options.dedupe.windowMs)
      : undefined;
  const rr = new RequestResponseCoordinator();
  const allowUnregistered = options.allowUnregisteredMessageNames === true;
  const ttlMs = options.messageTtlMs;

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
        throw new BusValidationError(`no validator registered for ${message.messageName}`, 'validation');
      }
      return;
    }
    const parsed = schema.safeParse(message);
    if (!parsed.success) {
      throw new BusValidationError(parsed.error.message, 'validation');
    }
  }

  function deliver(message: MessageBase): void {
    const event = new CustomEvent<MessageBase>(BUS_EVENT_TYPE, {
      detail: message,
      bubbles: false,
      cancelable: false,
    });

    target.dispatchEvent(event);
  }

  function prepareSync(message: MessageBase): boolean {
    if (ttlMs !== undefined) {
      assertIsoWithinTtl(message.occurredAtUtc, ttlMs);
    }

    validate(message);

    if (dedupe) {
      const now = Date.now();
      if (dedupe.shouldDrop(message.messageId, now)) {
        return false;
      }
    }

    policy(message);
    options.registry?.assertCanPublish(message);

    for (const hook of beforeDeliverHooks) {
      hook(message);
    }

    return true;
  }

  const bus: Bus = {
    appId: options.appId,

    publish<M extends MessageBase>(message: M): void {
      try {
        if (!prepareSync(message)) {
          return;
        }
      } catch (err) {
        if (options.onDispatchError) {
          options.onDispatchError(err);
          return;
        }
        if (err instanceof Error) {
          throw err;
        }
        throw new BusValidationError('unknown publish failure', 'unknown');
      }

      queue.enqueue(() => {
        deliver(message);
        rr.tryResolve(message);
      });
    },

    async request<TReq extends MessageBase, TRes extends MessageBase>(
      message: TReq,
      timeoutMs = 5_000,
      responseValidator?: ZodTypeAny,
    ): Promise<TRes> {
      const wait = rr.waitForResponse(message.messageId, timeoutMs);
      bus.publish(message);
      const result = await wait;
      if (result.causationId !== message.messageId) {
        throw new BusValidationError('response causationId must equal request messageId', 'validation');
      }
      if (responseValidator) {
        const parsed = responseValidator.safeParse(result);
        if (!parsed.success) {
          throw new BusValidationError(parsed.error.message, 'validation');
        }
      }
      return result as TRes;
    },

    subscribe<M extends MessageBase>(
      messageName: string,
      handler: (message: M) => void | Promise<void>,
      subscribeOptions?: BusSubscribeOptions,
    ): Unsubscribe {
      const subscriberId = subscribeOptions?.subscriberId ?? defaultSubscriberId;
      options.registry?.assertCanSubscribe(messageName, subscriberId);

      const listener: Listener = (event: Event) => {
        const ce = event as CustomEvent<MessageBase>;
        const detail = ce.detail;
        if (detail.messageName !== messageName) {
          return;
        }
        if (detail.target !== undefined && detail.target !== subscriberId) {
          return;
        }
        void Promise.resolve(handler(detail as M)).catch((err: unknown) => {
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
        const ce = event as CustomEvent<MessageBase>;
        try {
          handler(ce.detail);
        } catch (err: unknown) {
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
