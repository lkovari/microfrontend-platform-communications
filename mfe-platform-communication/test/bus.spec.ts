import { describe, expect, it, vi } from 'vitest';
import { createBus } from '../src/core/bus.js';
import { BusValidationError } from '../src/core/errors.js';
import type { CommandMessage } from '../src/contracts/command-message.js';
import type { EventMessage } from '../src/contracts/event-message.js';
import type { QueryMessage } from '../src/contracts/query-message.js';
import type { UserContextMessage } from '../src/contracts/user-context-message.js';
import { OrdersFiltersEventSchema, PersonStateMessageSchema } from './helpers.js';
import { CommandMessageSchema } from '../src/schemas/command-message.schema.js';
import { QueryMessageSchema } from '../src/schemas/query-message.schema.js';
import { StateMessageSchema } from '../src/schemas/state-message.schema.js';
import { UserContextMessageSchema } from '../src/schemas/user-context-message.schema.js';

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
    bus.subscribe<EventMessage<{ filter: string }>>('orders:filters-changed', (m) => {
      received.push(m.payload.filter);
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
    syncBus.subscribe<EventMessage<{ filter: string }>>('orders:filters-changed', () => {
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
    asyncBus.subscribe<EventMessage<{ filter: string }>>('orders:filters-changed', () => {
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
    const off = bus.subscribe<EventMessage<{ filter: string }>>('orders:filters-changed', () => {
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
    bus.subscribe<EventMessage<{ filter: string }>>('orders:filters-changed', () => {
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
    bus.subscribe<EventMessage<{ filter: string }>>('orders:filters-changed', (m) => {
      trace.push(`a:${m.payload.filter}`);
      if (m.payload.filter === 'first') {
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
    bus.subscribe<EventMessage<{ filter: string }>>('orders:filters-changed', (m) => {
      observed += 1;
      const next = Number(m.payload.filter);
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
    bus.subscribe<EventMessage<{ filter: string }>>('orders:filters-changed', () => {
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
    bus.subscribe<EventMessage<{ filter: string }>>('orders:filters-changed', () => {
      hostCount += 1;
    });
    bus.subscribe<EventMessage<{ filter: string }>>(
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
    bus.subscribe<EventMessage<{ filter: string }>>(
      'orders:filters-changed',
      () => {
        remoteACount += 1;
      },
      { subscriberId: 'remote-a' },
    );
    bus.subscribe<EventMessage<{ filter: string }>>(
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
    bus.subscribe<EventMessage<{ filter: string }>>('orders:filters-changed', () => {
      hostCount += 1;
    });
    bus.subscribe<EventMessage<{ filter: string }>>(
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
    bus.subscribe<CommandMessage<{ force: boolean }>>('orders:refresh', (message) => {
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
    bus.subscribe<QueryMessage<{ q: string }>>('orders:query', (message) => {
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
    bus.subscribe<UserContextMessage>('user:context-updated', (message) => {
      userId = message.payload.userId;
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
    bus.subscribe<EventMessage<{ filter: string }>>('q:demo', (m) => {
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
    const resPromise = bus.request<EventMessage<{ filter: string }>, EventMessage<{ filter: string }>>(
      req,
      1000,
    );
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
    bus.subscribe<EventMessage<{ filter: string }>>('q:demo2', (m) => {
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
      bus.request<EventMessage<{ filter: string }>, EventMessage<{ filter: string }>>(req, 25),
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
    bus.subscribe<EventMessage<{ filter: string }>>('q:timeout', () => {
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
      bus.request<EventMessage<{ filter: string }>, EventMessage<{ filter: string }>>(req, 25),
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
    bus.subscribe<EventMessage<{ filter: string }>>('q:fallback', (m) => {
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
      bus.request<EventMessage<{ filter: string }>, EventMessage<{ filter: string }>>(req, 25),
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
    bus.subscribe<EventMessage<{ filter: string }>>('q:dup', (m) => {
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
    const res = await bus.request<EventMessage<{ filter: string }>, EventMessage<{ filter: string }>>(req, 1000);
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
    bus.subscribe<EventMessage<{ filter: string }>>('orders:filters-changed', () => {
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
    bus.subscribe<EventMessage<{ filter: string }>>('orders:filters-changed', () => {
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
    bus.subscribe<EventMessage<{ filter: string }>>('orders:filters-changed', () => {
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
    if (first) {
      expect(String(first[0])).toContain('mfe-bus');
    }
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
    bus.subscribe<EventMessage<{ filter: string }>>('q:validated', (m) => {
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
    bus.subscribe<EventMessage<{ filter: string }>>('orders:filters-changed', () => {
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
});
