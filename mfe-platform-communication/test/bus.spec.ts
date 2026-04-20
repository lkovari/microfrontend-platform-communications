import { describe, expect, it, vi } from 'vitest';
import { createBus } from '../src/core/bus.js';
import { BusValidationError } from '../src/core/errors.js';
import type { EventMessage } from '../src/contracts/event-message.js';
import { OrdersFiltersEventSchema, PersonStateMessageSchema } from './helpers.js';

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
});
