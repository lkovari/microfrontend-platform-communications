import { describe, expect, it, vi } from 'vitest';
import { createBus } from '../src/core/bus.js';
import { BusPolicyError, BusValidationError } from '../src/core/errors.js';
import { ConsoleObservabilityAdapter } from '../src/core/observability.js';
import { TopicRegistry } from '../src/core/registry.js';
import type { CommandMessage } from '../src/contracts/command-message.js';
import type { EventMessage } from '../src/contracts/event-message.js';
import type { QueryMessage } from '../src/contracts/query-message.js';
import type { UserContextMessage } from '../src/contracts/user-context-message.js';
import { expectParsedMessage, OrdersFiltersEventSchema, PersonStateMessageSchema } from './helpers.js';
import { CommandMessageSchema } from '../src/schemas/command-message.schema.js';
import { QueryMessageSchema } from '../src/schemas/query-message.schema.js';
import { StateMessageSchema } from '../src/schemas/state-message.schema.js';
import { UserContextMessageSchema } from '../src/schemas/user-context-message.schema.js';
import { versionedMessageSchema } from '../src/schemas/message-base.schema.js';

function isoNow(): string {
  return new Date().toISOString();
}

describe('createBus', () => {
  it('publish/subscribe roundtrip', async () => {
    const bus = createBus({
      appId: 'a',
      dispatch: 'microtask',
      validators: {
        'orders:filters-changed': OrdersFiltersEventSchema,
      },
    });
    const received: string[] = [];
    bus.subscribe('orders:filters-changed', (m) => {
      received.push(expectParsedMessage(m, OrdersFiltersEventSchema).payload.filter);
    });
    bus.publish<EventMessage<{ filter: string }>>({
      messageName: 'orders:filters-changed',
      messageVersion: 1,
      messageId: crypto.randomUUID(),
      correlationId: crypto.randomUUID(),
      source: 'remote-orders',
      occurredAtUtc: isoNow(),
      kind: 'event',
      eventKind: 'orders.filters-changed',
      sensitivity: 'public',
      payload: { filter: 'open' },
    });
    await Promise.resolve();
    expect(received).toEqual(['open']);
    bus.dispose();
  });

  it('microtask vs synchronous ordering', async () => {
    const syncBus = createBus({
      appId: 'a',
      dispatch: 'sync',
      validators: {
        'orders:filters-changed': OrdersFiltersEventSchema,
      },
    });
    const order: string[] = [];
    syncBus.subscribe('orders:filters-changed', () => {
      order.push('handler');
    });
    order.push('before');
    syncBus.publish<EventMessage<{ filter: string }>>({
      messageName: 'orders:filters-changed',
      messageVersion: 1,
      messageId: crypto.randomUUID(),
      correlationId: crypto.randomUUID(),
      source: 'remote-orders',
      occurredAtUtc: isoNow(),
      kind: 'event',
      eventKind: 'orders.filters-changed',
      sensitivity: 'public',
      payload: { filter: 'open' },
    });
    order.push('after');
    expect(order).toEqual(['before', 'handler', 'after']);
    syncBus.dispose();

    const asyncBus = createBus({
      appId: 'a',
      dispatch: 'microtask',
      validators: {
        'orders:filters-changed': OrdersFiltersEventSchema,
      },
    });
    const order2: string[] = [];
    asyncBus.subscribe('orders:filters-changed', () => {
      order2.push('handler');
    });
    order2.push('before');
    asyncBus.publish<EventMessage<{ filter: string }>>({
      messageName: 'orders:filters-changed',
      messageVersion: 1,
      messageId: crypto.randomUUID(),
      correlationId: crypto.randomUUID(),
      source: 'remote-orders',
      occurredAtUtc: isoNow(),
      kind: 'event',
      eventKind: 'orders.filters-changed',
      sensitivity: 'public',
      payload: { filter: 'open' },
    });
    order2.push('after');
    expect(order2).toEqual(['before', 'after']);
    await Promise.resolve();
    expect(order2).toEqual(['before', 'after', 'handler']);
    asyncBus.dispose();
  });

  it('subscribe returns Unsubscribe and dispose clears listeners', () => {
    const bus = createBus({
      appId: 'a',
      dispatch: 'sync',
      validators: {
        'orders:filters-changed': OrdersFiltersEventSchema,
      },
    });
    let count = 0;
    const off = bus.subscribe('orders:filters-changed', () => {
      count += 1;
    });
    bus.publish<EventMessage<{ filter: string }>>({
      messageName: 'orders:filters-changed',
      messageVersion: 1,
      messageId: crypto.randomUUID(),
      correlationId: crypto.randomUUID(),
      source: 'remote-orders',
      occurredAtUtc: isoNow(),
      kind: 'event',
      eventKind: 'orders.filters-changed',
      sensitivity: 'public',
      payload: { filter: 'open' },
    });
    expect(count).toBe(1);
    off();
    bus.publish<EventMessage<{ filter: string }>>({
      messageName: 'orders:filters-changed',
      messageVersion: 1,
      messageId: crypto.randomUUID(),
      correlationId: crypto.randomUUID(),
      source: 'remote-orders',
      occurredAtUtc: isoNow(),
      kind: 'event',
      eventKind: 'orders.filters-changed',
      sensitivity: 'public',
      payload: { filter: 'open' },
    });
    expect(count).toBe(1);
    bus.subscribe('orders:filters-changed', () => {
      count += 1;
    });
    bus.dispose();
    bus.publish<EventMessage<{ filter: string }>>({
      messageName: 'orders:filters-changed',
      messageVersion: 1,
      messageId: crypto.randomUUID(),
      correlationId: crypto.randomUUID(),
      source: 'remote-orders',
      occurredAtUtc: isoNow(),
      kind: 'event',
      eventKind: 'orders.filters-changed',
      sensitivity: 'public',
      payload: { filter: 'open' },
    });
    expect(count).toBe(1);
  });

  it('reentrancy-safe nested publish via queue', async () => {
    const bus = createBus({
      appId: 'a',
      dispatch: 'microtask',
      validators: {
        'orders:filters-changed': OrdersFiltersEventSchema,
      },
    });
    const trace: string[] = [];
    bus.subscribe('orders:filters-changed', (m) => {
      const event = expectParsedMessage(m, OrdersFiltersEventSchema);
      trace.push(`a:${event.payload.filter}`);
      if (event.payload.filter === 'first') {
        bus.publish<EventMessage<{ filter: string }>>({
          messageName: 'orders:filters-changed',
          messageVersion: 1,
          messageId: crypto.randomUUID(),
          correlationId: crypto.randomUUID(),
          source: 'remote-orders',
          occurredAtUtc: isoNow(),
          kind: 'event',
          eventKind: 'orders.filters-changed',
          sensitivity: 'public',
          payload: { filter: 'second' },
        });
      }
    });
    bus.publish<EventMessage<{ filter: string }>>({
      messageName: 'orders:filters-changed',
      messageVersion: 1,
      messageId: crypto.randomUUID(),
      correlationId: crypto.randomUUID(),
      source: 'remote-orders',
      occurredAtUtc: isoNow(),
      kind: 'event',
      eventKind: 'orders.filters-changed',
      sensitivity: 'public',
      payload: { filter: 'first' },
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(trace).toEqual(['a:first', 'a:second']);
    bus.dispose();
  });

  it('sync dispatch handles long re-entrant chains without stack overflow', () => {
    const bus = createBus({
      appId: 'a',
      dispatch: 'sync',
      validators: {
        'orders:filters-changed': OrdersFiltersEventSchema,
      },
    });
    const maxDepth = 3000;
    let observed = 0;
    bus.subscribe('orders:filters-changed', (m) => {
      observed += 1;
      const next = Number(expectParsedMessage(m, OrdersFiltersEventSchema).payload.filter);
      if (next < maxDepth) {
        bus.publish<EventMessage<{ filter: string }>>({
          messageName: 'orders:filters-changed',
          messageVersion: 1,
          messageId: crypto.randomUUID(),
          correlationId: m.correlationId,
          source: 'remote-orders',
          occurredAtUtc: isoNow(),
          kind: 'event',
          eventKind: 'orders.filters-changed',
          sensitivity: 'public',
          payload: { filter: String(next + 1) },
        });
      }
    });
    bus.publish<EventMessage<{ filter: string }>>({
      messageName: 'orders:filters-changed',
      messageVersion: 1,
      messageId: crypto.randomUUID(),
      correlationId: crypto.randomUUID(),
      source: 'remote-orders',
      occurredAtUtc: isoNow(),
      kind: 'event',
      eventKind: 'orders.filters-changed',
      sensitivity: 'public',
      payload: { filter: '1' },
    });
    expect(observed).toBe(maxDepth);
    bus.dispose();
  });

  it('dedupe drops duplicate messageId within window', () => {
    const bus = createBus({
      appId: 'a',
      dispatch: 'sync',
      dedupe: { enabled: true, windowMs: 5_000 },
      validators: {
        'orders:filters-changed': OrdersFiltersEventSchema,
      },
    });
    let count = 0;
    bus.subscribe('orders:filters-changed', () => {
      count += 1;
    });
    const id = crypto.randomUUID();
    const base = {
      messageName: 'orders:filters-changed',
      messageVersion: 1,
      messageId: id,
      correlationId: crypto.randomUUID(),
      source: 'remote-orders',
      occurredAtUtc: isoNow(),
      kind: 'event' as const,
      eventKind: 'orders.filters-changed',
      sensitivity: 'public' as const,
      payload: { filter: 'open' },
    };
    bus.publish<EventMessage<{ filter: string }>>(base);
    bus.publish<EventMessage<{ filter: string }>>({ ...base, correlationId: crypto.randomUUID() });
    expect(count).toBe(1);
    bus.dispose();
  });

  it('validator rejects invalid envelopes', () => {
    const bus = createBus({
      appId: 'a',
      dispatch: 'sync',
      validators: {
        'person:updated': PersonStateMessageSchema,
      },
    });
    expect(() =>
      bus.publish({
        messageName: 'person:updated',
        messageVersion: 1,
        messageId: 'not-a-uuid',
        correlationId: crypto.randomUUID(),
        source: 'remote-profile',
        occurredAtUtc: isoNow(),
        kind: 'state',
        sensitivity: 'internal',
        stateKey: 'person',
        operation: 'replace',
        revision: 1,
        payload: { id: 'p-1', firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com' },
      }),
    ).toThrow(BusValidationError);
    bus.dispose();
  });

  it('targeted delivery only reaches matching subscriberId on shared bus', () => {
    const bus = createBus({
      appId: 'shell-host',
      defaultSubscriberId: 'shell-host',
      dispatch: 'sync',
      validators: {
        'orders:filters-changed': OrdersFiltersEventSchema,
      },
    });
    let hostCount = 0;
    let remoteCount = 0;
    bus.subscribe('orders:filters-changed', () => {
      hostCount += 1;
    });
    bus.subscribe(
      'orders:filters-changed',
      () => {
        remoteCount += 1;
      },
      { subscriberId: 'remote-orders' },
    );
    bus.publish<EventMessage<{ filter: string }>>({
      messageName: 'orders:filters-changed',
      messageVersion: 1,
      messageId: crypto.randomUUID(),
      correlationId: crypto.randomUUID(),
      source: 'host',
      target: 'remote-orders',
      occurredAtUtc: isoNow(),
      kind: 'event',
      eventKind: 'orders.filters-changed',
      sensitivity: 'public',
      payload: { filter: 'open' },
    });
    expect(hostCount).toBe(0);
    expect(remoteCount).toBe(1);
    bus.dispose();
  });

  it('broadcast from host reaches all remotes on shared bus', () => {
    const bus = createBus({
      appId: 'shell-host',
      defaultSubscriberId: 'shell-host',
      dispatch: 'sync',
      validators: {
        'orders:filters-changed': OrdersFiltersEventSchema,
      },
    });
    let remoteACount = 0;
    let remoteBCount = 0;
    bus.subscribe(
      'orders:filters-changed',
      () => {
        remoteACount += 1;
      },
      { subscriberId: 'remote-a' },
    );
    bus.subscribe(
      'orders:filters-changed',
      () => {
        remoteBCount += 1;
      },
      { subscriberId: 'remote-b' },
    );
    bus.publish<EventMessage<{ filter: string }>>({
      messageName: 'orders:filters-changed',
      messageVersion: 1,
      messageId: crypto.randomUUID(),
      correlationId: crypto.randomUUID(),
      source: 'host',
      occurredAtUtc: isoNow(),
      kind: 'event',
      eventKind: 'orders.filters-changed',
      sensitivity: 'public',
      payload: { filter: 'open' },
    });
    expect(remoteACount).toBe(1);
    expect(remoteBCount).toBe(1);
    bus.dispose();
  });

  it('targeted remote-to-host delivery reaches only host subscriber', () => {
    const bus = createBus({
      appId: 'shell-host',
      defaultSubscriberId: 'shell-host',
      dispatch: 'sync',
      validators: {
        'orders:filters-changed': OrdersFiltersEventSchema,
      },
    });
    let hostCount = 0;
    let remoteCount = 0;
    bus.subscribe('orders:filters-changed', () => {
      hostCount += 1;
    });
    bus.subscribe(
      'orders:filters-changed',
      () => {
        remoteCount += 1;
      },
      { subscriberId: 'remote-a' },
    );
    bus.publish<EventMessage<{ filter: string }>>({
      messageName: 'orders:filters-changed',
      messageVersion: 1,
      messageId: crypto.randomUUID(),
      correlationId: crypto.randomUUID(),
      source: 'remote-a',
      target: 'shell-host',
      occurredAtUtc: isoNow(),
      kind: 'event',
      eventKind: 'orders.filters-changed',
      sensitivity: 'public',
      payload: { filter: 'open' },
    });
    expect(hostCount).toBe(1);
    expect(remoteCount).toBe(0);
    bus.dispose();
  });

  it('supports command messages via runtime publish-subscribe', () => {
    const bus = createBus({
      appId: 'shell-host',
      dispatch: 'sync',
      validators: {
        'orders:refresh': CommandMessageSchema,
      },
    });
    let commandName = '';
    bus.subscribe('orders:refresh', (message) => {
      commandName = message.messageName;
    });
    bus.publish<CommandMessage<{ force: boolean }>>({
      messageName: 'orders:refresh',
      messageVersion: 1,
      messageId: crypto.randomUUID(),
      correlationId: crypto.randomUUID(),
      source: 'host',
      occurredAtUtc: isoNow(),
      kind: 'command',
      commandName: 'orders.refresh',
      sensitivity: 'internal',
      payload: { force: true },
    });
    expect(commandName).toBe('orders:refresh');
    bus.dispose();
  });

  it('supports query messages via runtime publish-subscribe', () => {
    const bus = createBus({
      appId: 'shell-host',
      dispatch: 'sync',
      validators: {
        'orders:query': QueryMessageSchema,
      },
    });
    let queryName = '';
    bus.subscribe('orders:query', (message) => {
      queryName = message.messageName;
    });
    bus.publish<QueryMessage<{ q: string }>>({
      messageName: 'orders:query',
      messageVersion: 1,
      messageId: crypto.randomUUID(),
      correlationId: crypto.randomUUID(),
      source: 'remote-orders',
      occurredAtUtc: isoNow(),
      kind: 'query',
      queryName: 'orders.query',
      sensitivity: 'public',
      payload: { q: 'open' },
      expectedResult: 'orders-result',
      timeoutMs: 1000,
    });
    expect(queryName).toBe('orders:query');
    bus.dispose();
  });

  it('supports user-context messages via runtime publish-subscribe', () => {
    const bus = createBus({
      appId: 'shell-host',
      dispatch: 'sync',
      validators: {
        'user:context-updated': UserContextMessageSchema,
      },
    });
    let userId = '';
    bus.subscribe('user:context-updated', (message) => {
      userId = expectParsedMessage(message, UserContextMessageSchema).payload.userId;
    });
    bus.publish<UserContextMessage>({
      messageName: 'user:context-updated',
      messageVersion: 1,
      messageId: crypto.randomUUID(),
      correlationId: crypto.randomUUID(),
      source: 'host',
      occurredAtUtc: isoNow(),
      kind: 'user-context',
      sensitivity: 'internal',
      payload: {
        userId: 'u-1',
        displayName: 'Ada',
        rolesForUi: ['admin'],
      },
    });
    expect(userId).toBe('u-1');
    bus.dispose();
  });

  it('request resolves when response references causationId', async () => {
    const bus = createBus({
      appId: 'a',
      dispatch: 'microtask',
      validators: {
        'q:demo': OrdersFiltersEventSchema,
        'q:demo:result': OrdersFiltersEventSchema,
      },
    });
    bus.subscribe('q:demo', (m) => {
      bus.publish<EventMessage<{ filter: string }>>({
        messageName: 'q:demo:result',
        messageVersion: 1,
        messageId: crypto.randomUUID(),
        correlationId: m.correlationId,
        causationId: m.messageId,
        source: 'b',
        occurredAtUtc: isoNow(),
        kind: 'event',
        eventKind: 'q.demo.result',
        sensitivity: 'public',
        payload: { filter: 'done' },
      });
    });
    const req: EventMessage<{ filter: string }> = {
      messageName: 'q:demo',
      messageVersion: 1,
      messageId: crypto.randomUUID(),
      correlationId: crypto.randomUUID(),
      source: 'a',
      occurredAtUtc: isoNow(),
      kind: 'event',
      eventKind: 'q.demo',
      sensitivity: 'public',
      payload: { filter: 'ask' },
    };
    const resPromise = bus.request(req, 1000, OrdersFiltersEventSchema);
    await Promise.resolve();
    await Promise.resolve();
    const res = await resPromise;
    expect(res.payload.filter).toBe('done');
    bus.dispose();
  });

  it('request times out when response only references correlationId', async () => {
    const bus = createBus({
      appId: 'a',
      dispatch: 'microtask',
      validators: {
        'q:demo2': OrdersFiltersEventSchema,
        'q:demo2:result': OrdersFiltersEventSchema,
      },
    });
    bus.subscribe('q:demo2', (m) => {
      bus.publish<EventMessage<{ filter: string }>>({
        messageName: 'q:demo2:result',
        messageVersion: 1,
        messageId: crypto.randomUUID(),
        correlationId: m.correlationId,
        source: 'b',
        occurredAtUtc: isoNow(),
        kind: 'event',
        eventKind: 'q.demo2.result',
        sensitivity: 'public',
        payload: { filter: 'done' },
      });
    });
    const req: EventMessage<{ filter: string }> = {
      messageName: 'q:demo2',
      messageVersion: 1,
      messageId: crypto.randomUUID(),
      correlationId: crypto.randomUUID(),
      source: 'a',
      occurredAtUtc: isoNow(),
      kind: 'event',
      eventKind: 'q.demo2',
      sensitivity: 'public',
      payload: { filter: 'ask' },
    };
    await expect(
      bus.request(req, 25),
    ).rejects.toThrow('request timed out');
    bus.dispose();
  });

  it('request times out when response has no matching causationId or correlationId', async () => {
    const bus = createBus({
      appId: 'a',
      dispatch: 'microtask',
      validators: {
        'q:timeout': OrdersFiltersEventSchema,
        'q:timeout:result': OrdersFiltersEventSchema,
      },
    });
    bus.subscribe('q:timeout', () => {
      bus.publish<EventMessage<{ filter: string }>>({
        messageName: 'q:timeout:result',
        messageVersion: 1,
        messageId: crypto.randomUUID(),
        correlationId: crypto.randomUUID(),
        causationId: crypto.randomUUID(),
        source: 'b',
        occurredAtUtc: isoNow(),
        kind: 'event',
        eventKind: 'q.timeout.result',
        sensitivity: 'public',
        payload: { filter: 'done' },
      });
    });
    const req: EventMessage<{ filter: string }> = {
      messageName: 'q:timeout',
      messageVersion: 1,
      messageId: crypto.randomUUID(),
      correlationId: crypto.randomUUID(),
      source: 'a',
      occurredAtUtc: isoNow(),
      kind: 'event',
      eventKind: 'q.timeout',
      sensitivity: 'public',
      payload: { filter: 'ask' },
    };
    await expect(
      bus.request(req, 25),
    ).rejects.toThrow('request timed out');
    bus.dispose();
  });

  it('request times out when causationId does not match request messageId', async () => {
    const bus = createBus({
      appId: 'a',
      dispatch: 'microtask',
      validators: {
        'q:fallback': OrdersFiltersEventSchema,
        'q:fallback:result': OrdersFiltersEventSchema,
      },
    });
    bus.subscribe('q:fallback', (m) => {
      bus.publish<EventMessage<{ filter: string }>>({
        messageName: 'q:fallback:result',
        messageVersion: 1,
        messageId: crypto.randomUUID(),
        correlationId: m.correlationId,
        causationId: crypto.randomUUID(),
        source: 'b',
        occurredAtUtc: isoNow(),
        kind: 'event',
        eventKind: 'q.fallback.result',
        sensitivity: 'public',
        payload: { filter: 'done' },
      });
    });
    const req: EventMessage<{ filter: string }> = {
      messageName: 'q:fallback',
      messageVersion: 1,
      messageId: crypto.randomUUID(),
      correlationId: crypto.randomUUID(),
      source: 'a',
      occurredAtUtc: isoNow(),
      kind: 'event',
      eventKind: 'q.fallback',
      sensitivity: 'public',
      payload: { filter: 'ask' },
    };
    await expect(
      bus.request(req, 25),
    ).rejects.toThrow('request timed out');
    bus.dispose();
  });

  it('request resolves with first matching response when duplicate responses arrive', async () => {
    const bus = createBus({
      appId: 'a',
      dispatch: 'microtask',
      validators: {
        'q:dup': OrdersFiltersEventSchema,
        'q:dup:result': OrdersFiltersEventSchema,
      },
    });
    bus.subscribe('q:dup', (m) => {
      bus.publish<EventMessage<{ filter: string }>>({
        messageName: 'q:dup:result',
        messageVersion: 1,
        messageId: crypto.randomUUID(),
        correlationId: m.correlationId,
        causationId: m.messageId,
        source: 'b',
        occurredAtUtc: isoNow(),
        kind: 'event',
        eventKind: 'q.dup.result',
        sensitivity: 'public',
        payload: { filter: 'first' },
      });
      bus.publish<EventMessage<{ filter: string }>>({
        messageName: 'q:dup:result',
        messageVersion: 1,
        messageId: crypto.randomUUID(),
        correlationId: m.correlationId,
        causationId: m.messageId,
        source: 'b',
        occurredAtUtc: isoNow(),
        kind: 'event',
        eventKind: 'q.dup.result',
        sensitivity: 'public',
        payload: { filter: 'second' },
      });
    });
    const req: EventMessage<{ filter: string }> = {
      messageName: 'q:dup',
      messageVersion: 1,
      messageId: crypto.randomUUID(),
      correlationId: crypto.randomUUID(),
      source: 'a',
      occurredAtUtc: isoNow(),
      kind: 'event',
      eventKind: 'q.dup',
      sensitivity: 'public',
      payload: { filter: 'ask' },
    };
    const res = await bus.request(req, 1000, OrdersFiltersEventSchema);
    expect(res.payload.filter).toBe('first');
    bus.dispose();
  });

  it('onDispatchError captures microtask validation failures', async () => {
    const onDispatchError = vi.fn();
    const bus = createBus({
      appId: 'a',
      dispatch: 'microtask',
      validators: {
        'orders:filters-changed': OrdersFiltersEventSchema,
      },
      onDispatchError,
    });
    bus.publish<EventMessage<{ filter: string }>>({
      messageName: 'orders:filters-changed',
      messageVersion: 1,
      messageId: 'bad',
      correlationId: crypto.randomUUID(),
      source: 'remote-orders',
      occurredAtUtc: isoNow(),
      kind: 'event',
      eventKind: 'orders.filters-changed',
      sensitivity: 'public',
      payload: { filter: 'open' },
    });
    await Promise.resolve();
    expect(onDispatchError).toHaveBeenCalledTimes(1);
    bus.dispose();
  });

  it('onSubscriberError is invoked when subscribe handler returns a rejected Promise', async () => {
    const subscriberErrors: unknown[] = [];
    const onSubscriberError = (error: unknown): void => {
      subscriberErrors.push(error);
    };
    const bus = createBus({
      appId: 'a',
      dispatch: 'microtask',
      validators: {
        'orders:filters-changed': OrdersFiltersEventSchema,
      },
      onSubscriberError,
    });
    bus.subscribe('orders:filters-changed', () => {
      return Promise.reject(new Error('async subscriber failure'));
    });
    bus.publish<EventMessage<{ filter: string }>>({
      messageName: 'orders:filters-changed',
      messageVersion: 1,
      messageId: crypto.randomUUID(),
      correlationId: crypto.randomUUID(),
      source: 'remote-orders',
      occurredAtUtc: isoNow(),
      kind: 'event',
      eventKind: 'orders.filters-changed',
      sensitivity: 'public',
      payload: { filter: 'open' },
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(subscriberErrors).toHaveLength(1);
    const first = subscriberErrors[0];
    expect(String(first instanceof Error ? first.message : first)).toBe('async subscriber failure');
    bus.dispose();
  });

  it('onSubscriberError is preferred over onDispatchError for subscribe failures', async () => {
    const onDispatchError = vi.fn();
    const subscriberErrors: unknown[] = [];
    const onSubscriberError = (error: unknown): void => {
      subscriberErrors.push(error);
    };
    const bus = createBus({
      appId: 'a',
      dispatch: 'microtask',
      validators: {
        'orders:filters-changed': OrdersFiltersEventSchema,
      },
      onDispatchError,
      onSubscriberError,
    });
    bus.subscribe('orders:filters-changed', () => {
      return Promise.reject(new Error('x'));
    });
    bus.publish<EventMessage<{ filter: string }>>({
      messageName: 'orders:filters-changed',
      messageVersion: 1,
      messageId: crypto.randomUUID(),
      correlationId: crypto.randomUUID(),
      source: 'remote-orders',
      occurredAtUtc: isoNow(),
      kind: 'event',
      eventKind: 'orders.filters-changed',
      sensitivity: 'public',
      payload: { filter: 'open' },
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(subscriberErrors).toHaveLength(1);
    expect(onDispatchError).not.toHaveBeenCalled();
    bus.dispose();
  });

  it('logs to console when subscribe fails and no error handlers are set', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const bus = createBus({
      appId: 'a',
      dispatch: 'microtask',
      validators: {
        'orders:filters-changed': OrdersFiltersEventSchema,
      },
    });
    bus.subscribe('orders:filters-changed', () => {
      return Promise.reject(new Error('unhandled sub'));
    });
    bus.publish<EventMessage<{ filter: string }>>({
      messageName: 'orders:filters-changed',
      messageVersion: 1,
      messageId: crypto.randomUUID(),
      correlationId: crypto.randomUUID(),
      source: 'remote-orders',
      occurredAtUtc: isoNow(),
      kind: 'event',
      eventKind: 'orders.filters-changed',
      sensitivity: 'public',
      payload: { filter: 'open' },
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(errSpy).toHaveBeenCalled();
    const first = errSpy.mock.calls[0];
    expect(first).toBeDefined();
    expect(String(first?.[0])).toContain('mfe-bus');
    errSpy.mockRestore();
    bus.dispose();
  });

  it('observeAll forwards sync handler throws to onSubscriberError', () => {
    const onSubscriberError = vi.fn();
    const bus = createBus({
      appId: 'a',
      dispatch: 'sync',
      validators: {
        'orders:filters-changed': OrdersFiltersEventSchema,
      },
      onSubscriberError,
    });
    bus.observeAll(() => {
      throw new Error('observe all boom');
    });
    bus.publish<EventMessage<{ filter: string }>>({
      messageName: 'orders:filters-changed',
      messageVersion: 1,
      messageId: crypto.randomUUID(),
      correlationId: crypto.randomUUID(),
      source: 'remote-orders',
      occurredAtUtc: isoNow(),
      kind: 'event',
      eventKind: 'orders.filters-changed',
      sensitivity: 'public',
      payload: { filter: 'open' },
    });
    expect(onSubscriberError).toHaveBeenCalledOnce();
    bus.dispose();
  });

  it('request validates response when validator is provided', async () => {
    const bus = createBus({
      appId: 'a',
      dispatch: 'microtask',
      validators: {
        'q:validated': OrdersFiltersEventSchema,
        'q:validated:result': OrdersFiltersEventSchema,
      },
    });
    bus.subscribe('q:validated', (m) => {
      bus.publish<EventMessage<{ filter: string }>>({
        messageName: 'q:validated:result',
        messageVersion: 1,
        messageId: crypto.randomUUID(),
        correlationId: m.correlationId,
        causationId: m.messageId,
        source: 'b',
        occurredAtUtc: isoNow(),
        kind: 'event',
        eventKind: 'q.validated.result',
        sensitivity: 'public',
        payload: { filter: 'done' },
      });
    });
    const req: EventMessage<{ filter: string }> = {
      messageName: 'q:validated',
      messageVersion: 1,
      messageId: crypto.randomUUID(),
      correlationId: crypto.randomUUID(),
      source: 'a',
      occurredAtUtc: isoNow(),
      kind: 'event',
      eventKind: 'q.validated',
      sensitivity: 'public',
      payload: { filter: 'ask' },
    };
    await expect(bus.request(req, 1000, StateMessageSchema)).rejects.toThrow(BusValidationError);
    bus.dispose();
  });

  it('TTL rejects expired and invalid timestamps', () => {
    const bus = createBus({
      appId: 'a',
      dispatch: 'sync',
      validators: {
        'orders:filters-changed': OrdersFiltersEventSchema,
      },
      messageTtlMs: 1,
    });
    expect(() =>
      bus.publish<EventMessage<{ filter: string }>>({
        messageName: 'orders:filters-changed',
        messageVersion: 1,
        messageId: crypto.randomUUID(),
        correlationId: crypto.randomUUID(),
        source: 'remote-orders',
        occurredAtUtc: new Date(Date.now() - 50).toISOString(),
        kind: 'event',
        eventKind: 'orders.filters-changed',
        sensitivity: 'public',
        payload: { filter: 'open' },
      }),
    ).toThrow('message expired');
    expect(() =>
      bus.publish<EventMessage<{ filter: string }>>({
        messageName: 'orders:filters-changed',
        messageVersion: 1,
        messageId: crypto.randomUUID(),
        correlationId: crypto.randomUUID(),
        source: 'remote-orders',
        occurredAtUtc: 'bad-date',
        kind: 'event',
        eventKind: 'orders.filters-changed',
        sensitivity: 'public',
        payload: { filter: 'open' },
      }),
    ).toThrow('invalid occurredAtUtc');
    bus.dispose();
  });

  it('TTL accepts future timestamps and non-expired messages', () => {
    const bus = createBus({
      appId: 'a',
      dispatch: 'sync',
      validators: {
        'orders:filters-changed': OrdersFiltersEventSchema,
      },
      messageTtlMs: 5_000,
    });
    let count = 0;
    bus.subscribe('orders:filters-changed', () => {
      count += 1;
    });
    bus.publish<EventMessage<{ filter: string }>>({
      messageName: 'orders:filters-changed',
      messageVersion: 1,
      messageId: crypto.randomUUID(),
      correlationId: crypto.randomUUID(),
      source: 'remote-orders',
      occurredAtUtc: new Date(Date.now() + 2_000).toISOString(),
      kind: 'event',
      eventKind: 'orders.filters-changed',
      sensitivity: 'public',
      payload: { filter: 'open' },
    });
    expect(count).toBe(1);
    bus.dispose();
  });

  it('TopicRegistry blocks publish from unauthorized source', () => {
    const registry = new TopicRegistry();
    registry.register({
      messageName: 'orders:filters-changed',
      allowedPublishers: ['remote-orders'],
    });
    const bus = createBus({
      appId: 'shell',
      dispatch: 'sync',
      registry,
      validators: {
        'orders:filters-changed': OrdersFiltersEventSchema,
      },
    });
    expect(() =>
      bus.publish<EventMessage<{ filter: string }>>({
        messageName: 'orders:filters-changed',
        messageVersion: 1,
        messageId: crypto.randomUUID(),
        correlationId: crypto.randomUUID(),
        source: 'remote-profile',
        occurredAtUtc: isoNow(),
        kind: 'event',
        eventKind: 'orders.filters-changed',
        sensitivity: 'public',
        payload: { filter: 'open' },
      }),
    ).toThrow(BusPolicyError);
    bus.dispose();
  });

  it('TopicRegistry blocks subscribe from unauthorized subscriberId', () => {
    const registry = new TopicRegistry();
    registry.register({
      messageName: 'orders:filters-changed',
      allowedSubscribers: ['remote-orders'],
    });
    const bus = createBus({
      appId: 'shell',
      dispatch: 'sync',
      registry,
      validators: {
        'orders:filters-changed': OrdersFiltersEventSchema,
      },
    });
    expect(() =>
      bus.subscribe('orders:filters-changed', () => undefined, { subscriberId: 'remote-profile' }),
    ).toThrow(BusPolicyError);
    bus.dispose();
  });

  it('attemptPublish returns dedupe when messageId repeats within window', () => {
    const onDedupe = vi.fn();
    const bus = createBus({
      appId: 'a',
      dispatch: 'sync',
      dedupe: { enabled: true, windowMs: 5_000 },
      onDedupe,
      validators: {
        'orders:filters-changed': OrdersFiltersEventSchema,
      },
    });
    const id = crypto.randomUUID();
    const base = {
      messageName: 'orders:filters-changed',
      messageVersion: 1,
      messageId: id,
      correlationId: crypto.randomUUID(),
      source: 'remote-orders',
      occurredAtUtc: isoNow(),
      kind: 'event' as const,
      eventKind: 'orders.filters-changed',
      sensitivity: 'public' as const,
      payload: { filter: 'open' },
    };
    expect(bus.attemptPublish(base)).toEqual({ status: 'delivered' });
    expect(bus.attemptPublish({ ...base, correlationId: crypto.randomUUID() })).toEqual({
      status: 'dedupe',
    });
    expect(onDedupe).toHaveBeenCalledTimes(1);
    bus.dispose();
  });

  it('failFastOnDispatchError rejects request immediately on publish validation failure', async () => {
    const onDispatchError = vi.fn();
    const bus = createBus({
      appId: 'a',
      dispatch: 'microtask',
      validators: {
        'orders:filters-changed': OrdersFiltersEventSchema,
      },
      onDispatchError,
      failFastOnDispatchError: true,
    });
    const requestMessage: EventMessage<{ filter: string }> = {
      messageName: 'orders:filters-changed',
      messageVersion: 1,
      messageId: 'bad',
      correlationId: crypto.randomUUID(),
      source: 'remote-orders',
      occurredAtUtc: isoNow(),
      kind: 'event',
      eventKind: 'orders.filters-changed',
      sensitivity: 'public',
      payload: { filter: 'open' },
    };
    await expect(bus.request(requestMessage, 100)).rejects.toBeInstanceOf(BusValidationError);
    expect(onDispatchError).toHaveBeenCalledTimes(1);
    bus.dispose();
  });

  it('observability adapter receives publish and deliver events', () => {
    const adapter = {
      onPublish: vi.fn(),
      onDeliver: vi.fn(),
      onError: vi.fn(),
      onRequestTimeout: vi.fn(),
    };
    const bus = createBus({
      appId: 'a',
      dispatch: 'sync',
      observability: adapter,
      validators: {
        'orders:filters-changed': OrdersFiltersEventSchema,
      },
    });
    bus.subscribe('orders:filters-changed', () => undefined);
    bus.publish<EventMessage<{ filter: string }>>({
      messageName: 'orders:filters-changed',
      messageVersion: 1,
      messageId: crypto.randomUUID(),
      correlationId: crypto.randomUUID(),
      source: 'remote-orders',
      occurredAtUtc: isoNow(),
      kind: 'event',
      eventKind: 'orders.filters-changed',
      sensitivity: 'public',
      payload: { filter: 'open' },
    });
    expect(adapter.onPublish).toHaveBeenCalledTimes(1);
    expect(adapter.onDeliver).toHaveBeenCalledTimes(1);
    bus.dispose();
  });

  it('ConsoleObservabilityAdapter can be wired without throwing', () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const bus = createBus({
      appId: 'a',
      dispatch: 'sync',
      observability: new ConsoleObservabilityAdapter(),
      validators: {
        'orders:filters-changed': OrdersFiltersEventSchema,
      },
    });
    bus.publish<EventMessage<{ filter: string }>>({
      messageName: 'orders:filters-changed',
      messageVersion: 1,
      messageId: crypto.randomUUID(),
      correlationId: crypto.randomUUID(),
      source: 'remote-orders',
      occurredAtUtc: isoNow(),
      kind: 'event',
      eventKind: 'orders.filters-changed',
      sensitivity: 'public',
      payload: { filter: 'open' },
    });
    expect(infoSpy).toHaveBeenCalled();
    infoSpy.mockRestore();
    bus.dispose();
  });

  it('blocks restricted messages by default via the sensitivity policy', () => {
    const bus = createBus({
      appId: 'a',
      dispatch: 'sync',
      validators: {
        'orders:filters-changed': OrdersFiltersEventSchema,
      },
    });
    expect(() =>
      bus.publish<EventMessage<{ filter: string }>>({
        messageName: 'orders:filters-changed',
        messageVersion: 1,
        messageId: crypto.randomUUID(),
        correlationId: crypto.randomUUID(),
        source: 'remote-orders',
        occurredAtUtc: isoNow(),
        kind: 'event',
        eventKind: 'orders.filters-changed',
        sensitivity: 'restricted',
        payload: { filter: 'open' },
      }),
    ).toThrow(BusPolicyError);
    bus.dispose();
  });

  it('allows restricted messages when the default sensitivity policy is disabled', () => {
    const bus = createBus({
      appId: 'a',
      dispatch: 'sync',
      enableDefaultSensitivityPolicy: false,
      validators: {
        'orders:filters-changed': OrdersFiltersEventSchema,
      },
    });
    let count = 0;
    bus.subscribe('orders:filters-changed', () => {
      count += 1;
    });
    bus.publish<EventMessage<{ filter: string }>>({
      messageName: 'orders:filters-changed',
      messageVersion: 1,
      messageId: crypto.randomUUID(),
      correlationId: crypto.randomUUID(),
      source: 'remote-orders',
      occurredAtUtc: isoNow(),
      kind: 'event',
      eventKind: 'orders.filters-changed',
      sensitivity: 'restricted',
      payload: { filter: 'open' },
    });
    expect(count).toBe(1);
    bus.dispose();
  });

  it('runs a custom policy and composes it with the default sensitivity policy', () => {
    const customPolicy = vi.fn();
    const bus = createBus({
      appId: 'a',
      dispatch: 'sync',
      policy: customPolicy,
      validators: {
        'orders:filters-changed': OrdersFiltersEventSchema,
      },
    });
    bus.publish<EventMessage<{ filter: string }>>({
      messageName: 'orders:filters-changed',
      messageVersion: 1,
      messageId: crypto.randomUUID(),
      correlationId: crypto.randomUUID(),
      source: 'remote-orders',
      occurredAtUtc: isoNow(),
      kind: 'event',
      eventKind: 'orders.filters-changed',
      sensitivity: 'public',
      payload: { filter: 'open' },
    });
    expect(customPolicy).toHaveBeenCalledTimes(1);
    expect(() =>
      bus.publish<EventMessage<{ filter: string }>>({
        messageName: 'orders:filters-changed',
        messageVersion: 1,
        messageId: crypto.randomUUID(),
        correlationId: crypto.randomUUID(),
        source: 'remote-orders',
        occurredAtUtc: isoNow(),
        kind: 'event',
        eventKind: 'orders.filters-changed',
        sensitivity: 'restricted',
        payload: { filter: 'open' },
      }),
    ).toThrow(BusPolicyError);
    expect(customPolicy).toHaveBeenCalledTimes(1);
    bus.dispose();
  });

  it('throws when publishing a messageName with no registered validator', () => {
    const bus = createBus({
      appId: 'a',
      dispatch: 'sync',
      validators: {},
    });
    expect(() =>
      bus.publish<EventMessage<{ filter: string }>>({
        messageName: 'unknown:topic',
        messageVersion: 1,
        messageId: crypto.randomUUID(),
        correlationId: crypto.randomUUID(),
        source: 'remote-orders',
        occurredAtUtc: isoNow(),
        kind: 'event',
        eventKind: 'unknown.topic',
        sensitivity: 'public',
        payload: { filter: 'open' },
      }),
    ).toThrow(BusValidationError);
    bus.dispose();
  });

  it('allows unregistered messageNames when allowUnregisteredMessageNames is true', () => {
    const bus = createBus({
      appId: 'a',
      dispatch: 'sync',
      validators: {},
      allowUnregisteredMessageNames: true,
    });
    let count = 0;
    bus.subscribe('unknown:topic', () => {
      count += 1;
    });
    bus.publish<EventMessage<{ filter: string }>>({
      messageName: 'unknown:topic',
      messageVersion: 1,
      messageId: crypto.randomUUID(),
      correlationId: crypto.randomUUID(),
      source: 'remote-orders',
      occurredAtUtc: isoNow(),
      kind: 'event',
      eventKind: 'unknown.topic',
      sensitivity: 'public',
      payload: { filter: 'open' },
    });
    expect(count).toBe(1);
    bus.dispose();
  });

  it('disposing the bus rejects an in-flight request', async () => {
    const bus = createBus({
      appId: 'a',
      dispatch: 'microtask',
      validators: {
        'q:hang': OrdersFiltersEventSchema,
      },
    });
    const req: EventMessage<{ filter: string }> = {
      messageName: 'q:hang',
      messageVersion: 1,
      messageId: crypto.randomUUID(),
      correlationId: crypto.randomUUID(),
      source: 'a',
      occurredAtUtc: isoNow(),
      kind: 'event',
      eventKind: 'q.hang',
      sensitivity: 'public',
      payload: { filter: 'ask' },
    };
    const pending = bus.request(req, 1000);
    bus.dispose();
    await expect(pending).rejects.toThrow('bus disposed');
  });

  it('resolves concurrent requests independently by causationId', async () => {
    const bus = createBus({
      appId: 'a',
      dispatch: 'microtask',
      validators: {
        'q:multi': OrdersFiltersEventSchema,
        'q:multi:result': OrdersFiltersEventSchema,
      },
    });
    bus.subscribe('q:multi', (m) => {
      const echo = expectParsedMessage(m, OrdersFiltersEventSchema).payload.filter;
      bus.publish<EventMessage<{ filter: string }>>({
        messageName: 'q:multi:result',
        messageVersion: 1,
        messageId: crypto.randomUUID(),
        correlationId: m.correlationId,
        causationId: m.messageId,
        source: 'b',
        occurredAtUtc: isoNow(),
        kind: 'event',
        eventKind: 'q.multi.result',
        sensitivity: 'public',
        payload: { filter: echo },
      });
    });
    function makeRequest(filter: string): EventMessage<{ filter: string }> {
      return {
        messageName: 'q:multi',
        messageVersion: 1,
        messageId: crypto.randomUUID(),
        correlationId: crypto.randomUUID(),
        source: 'a',
        occurredAtUtc: isoNow(),
        kind: 'event',
        eventKind: 'q.multi',
        sensitivity: 'public',
        payload: { filter },
      };
    }
    const [r1, r2, r3] = await Promise.all([
      bus.request(makeRequest('one'), 1000, OrdersFiltersEventSchema),
      bus.request(makeRequest('two'), 1000, OrdersFiltersEventSchema),
      bus.request(makeRequest('three'), 1000, OrdersFiltersEventSchema),
    ]);
    expect([r1.payload.filter, r2.payload.filter, r3.payload.filter]).toEqual([
      'one',
      'two',
      'three',
    ]);
    bus.dispose();
  });
});

describe('createBus kind-aware behavior', () => {
  it('sendCommand resolves an Ack when an acknowledgment references the command messageId', async () => {
    const bus = createBus({
      appId: 'host',
      dispatch: 'sync',
      validators: {
        'orders:refresh': CommandMessageSchema,
        'orders:refresh:ack': OrdersFiltersEventSchema,
      },
    });
    bus.subscribe('orders:refresh', (m) => {
      bus.publish<EventMessage<{ filter: string }>>({
        messageName: 'orders:refresh:ack',
        messageVersion: 1,
        messageId: crypto.randomUUID(),
        correlationId: m.correlationId,
        causationId: m.messageId,
        source: 'remote-orders',
        occurredAtUtc: isoNow(),
        kind: 'event',
        eventKind: 'orders.refresh.ack',
        sensitivity: 'public',
        payload: { filter: 'ok' },
      });
    });
    const command: CommandMessage<{ force: boolean }> = {
      messageName: 'orders:refresh',
      messageVersion: 1,
      messageId: crypto.randomUUID(),
      correlationId: crypto.randomUUID(),
      source: 'host',
      occurredAtUtc: isoNow(),
      kind: 'command',
      commandName: 'orders.refresh',
      sensitivity: 'internal',
      payload: { force: true },
      ackTimeoutMs: 1000,
    };
    const ack = await bus.sendCommand(command);
    expect(ack.accepted).toBe(true);
    bus.dispose();
  });

  it('sendCommand returns a timeout Nack when no acknowledgment arrives within ackTimeoutMs', async () => {
    const bus = createBus({
      appId: 'host',
      dispatch: 'sync',
      validators: {
        'orders:refresh': CommandMessageSchema,
      },
    });
    const command: CommandMessage<{ force: boolean }> = {
      messageName: 'orders:refresh',
      messageVersion: 1,
      messageId: crypto.randomUUID(),
      correlationId: crypto.randomUUID(),
      source: 'host',
      occurredAtUtc: isoNow(),
      kind: 'command',
      commandName: 'orders.refresh',
      sensitivity: 'internal',
      payload: { force: true },
      ackTimeoutMs: 20,
    };
    const nack = await bus.sendCommand(command);
    expect(nack).toMatchObject({ accepted: false, errorCode: 'timeout' });
    bus.dispose();
  });

  it('sendCommand returns a validation Nack when the command fails schema validation', async () => {
    const bus = createBus({
      appId: 'host',
      dispatch: 'sync',
      validators: {
        'orders:refresh': CommandMessageSchema,
      },
    });
    const command: CommandMessage<{ force: boolean }> = {
      messageName: 'orders:refresh',
      messageVersion: 1,
      messageId: 'not-a-uuid',
      correlationId: crypto.randomUUID(),
      source: 'host',
      occurredAtUtc: isoNow(),
      kind: 'command',
      commandName: 'orders.refresh',
      sensitivity: 'internal',
      payload: { force: true },
      ackTimeoutMs: 50,
    };
    const nack = await bus.sendCommand(command);
    expect(nack).toMatchObject({ accepted: false, errorCode: 'validation' });
    bus.dispose();
  });

  it('sendCommand returns a dedupe Nack for a duplicate command messageId', async () => {
    const bus = createBus({
      appId: 'host',
      dispatch: 'sync',
      dedupe: { enabled: true, windowMs: 5_000 },
      validators: {
        'orders:refresh': CommandMessageSchema,
        'orders:refresh:ack': OrdersFiltersEventSchema,
      },
    });
    bus.subscribe('orders:refresh', (m) => {
      bus.publish<EventMessage<{ filter: string }>>({
        messageName: 'orders:refresh:ack',
        messageVersion: 1,
        messageId: crypto.randomUUID(),
        correlationId: m.correlationId,
        causationId: m.messageId,
        source: 'remote-orders',
        occurredAtUtc: isoNow(),
        kind: 'event',
        eventKind: 'orders.refresh.ack',
        sensitivity: 'public',
        payload: { filter: 'ok' },
      });
    });
    const messageId = crypto.randomUUID();
    const command: CommandMessage<{ force: boolean }> = {
      messageName: 'orders:refresh',
      messageVersion: 1,
      messageId,
      correlationId: crypto.randomUUID(),
      source: 'host',
      occurredAtUtc: isoNow(),
      kind: 'command',
      commandName: 'orders.refresh',
      sensitivity: 'internal',
      payload: { force: true },
      ackTimeoutMs: 1000,
    };
    const first = await bus.sendCommand(command);
    expect(first.accepted).toBe(true);
    const second = await bus.sendCommand({ ...command, correlationId: crypto.randomUUID() });
    expect(second).toMatchObject({ accepted: false, errorCode: 'dedupe' });
    bus.dispose();
  });

  it('request falls back to the query message timeoutMs when no timeout argument is given', async () => {
    const bus = createBus({
      appId: 'a',
      dispatch: 'sync',
      validators: {
        'orders:query': QueryMessageSchema,
      },
    });
    const req: QueryMessage<{ q: string }> = {
      messageName: 'orders:query',
      messageVersion: 1,
      messageId: crypto.randomUUID(),
      correlationId: crypto.randomUUID(),
      source: 'remote-orders',
      occurredAtUtc: isoNow(),
      kind: 'query',
      queryName: 'orders.query',
      sensitivity: 'public',
      payload: { q: 'open' },
      timeoutMs: 20,
    };
    await expect(bus.request(req)).rejects.toThrow(expect.objectContaining({ code: 'timeout' }));
    bus.dispose();
  });

  it('request rejects when the response messageName does not match the query expectedResult', async () => {
    const bus = createBus({
      appId: 'a',
      dispatch: 'sync',
      validators: {
        'orders:query': QueryMessageSchema,
        'orders:wrong': OrdersFiltersEventSchema,
      },
    });
    bus.subscribe('orders:query', (m) => {
      bus.publish<EventMessage<{ filter: string }>>({
        messageName: 'orders:wrong',
        messageVersion: 1,
        messageId: crypto.randomUUID(),
        correlationId: m.correlationId,
        causationId: m.messageId,
        source: 'host',
        occurredAtUtc: isoNow(),
        kind: 'event',
        eventKind: 'orders.wrong',
        sensitivity: 'public',
        payload: { filter: 'x' },
      });
    });
    const req: QueryMessage<{ q: string }> = {
      messageName: 'orders:query',
      messageVersion: 1,
      messageId: crypto.randomUUID(),
      correlationId: crypto.randomUUID(),
      source: 'remote-orders',
      occurredAtUtc: isoNow(),
      kind: 'query',
      queryName: 'orders.query',
      sensitivity: 'public',
      payload: { q: 'open' },
      expectedResult: 'orders:result',
      timeoutMs: 1000,
    };
    await expect(bus.request(req)).rejects.toThrow(expect.objectContaining({ code: 'validation' }));
    bus.dispose();
  });

  it('request resolves when the response messageName matches the query expectedResult', async () => {
    const bus = createBus({
      appId: 'a',
      dispatch: 'sync',
      validators: {
        'orders:query': QueryMessageSchema,
        'orders:result': OrdersFiltersEventSchema,
      },
    });
    bus.subscribe('orders:query', (m) => {
      bus.publish<EventMessage<{ filter: string }>>({
        messageName: 'orders:result',
        messageVersion: 1,
        messageId: crypto.randomUUID(),
        correlationId: m.correlationId,
        causationId: m.messageId,
        source: 'host',
        occurredAtUtc: isoNow(),
        kind: 'event',
        eventKind: 'orders.result',
        sensitivity: 'public',
        payload: { filter: 'done' },
      });
    });
    const req: QueryMessage<{ q: string }> = {
      messageName: 'orders:query',
      messageVersion: 1,
      messageId: crypto.randomUUID(),
      correlationId: crypto.randomUUID(),
      source: 'remote-orders',
      occurredAtUtc: isoNow(),
      kind: 'query',
      queryName: 'orders.query',
      sensitivity: 'public',
      payload: { q: 'open' },
      expectedResult: 'orders:result',
      timeoutMs: 1000,
    };
    const res = await bus.request(req);
    expect(res.messageName).toBe('orders:result');
    bus.dispose();
  });

  it('autoRegisterTopics populates the provided registry with version ranges from validators', () => {
    const registry = new TopicRegistry();
    const bus = createBus({
      appId: 'host',
      dispatch: 'sync',
      autoRegisterTopics: true,
      registry,
      validators: {
        'orders:v2': versionedMessageSchema(OrdersFiltersEventSchema, 2),
      },
    });
    expect(registry.getRegistration('orders:v2')).toMatchObject({
      messageName: 'orders:v2',
      minMessageVersion: 2,
      maxMessageVersion: 2,
    });
    bus.dispose();
  });
});
