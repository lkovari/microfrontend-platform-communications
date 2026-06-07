import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDedupeGate } from '../src/core/dedupe.js';
import { createBus } from '../src/core/bus.js';
import type { EventMessage } from '../src/contracts/event-message.js';
import { OrdersFiltersEventSchema } from './helpers.js';

describe('createDedupeGate', () => {
  it('lets a new id pass and drops a repeat within the window', () => {
    const gate = createDedupeGate(1_000);
    expect(gate.shouldDrop('id-1', 0)).toBe(false);
    expect(gate.shouldDrop('id-1', 500)).toBe(true);
    expect(gate.shouldDrop('id-1', 999)).toBe(true);
  });

  it('allows the same id again once the window has elapsed since first sighting', () => {
    const gate = createDedupeGate(1_000);
    expect(gate.shouldDrop('id-1', 0)).toBe(false);
    expect(gate.shouldDrop('id-1', 1_001)).toBe(false);
    expect(gate.shouldDrop('id-1', 1_500)).toBe(true);
  });

  it('tracks distinct ids independently', () => {
    const gate = createDedupeGate(1_000);
    expect(gate.shouldDrop('a', 0)).toBe(false);
    expect(gate.shouldDrop('b', 0)).toBe(false);
    expect(gate.shouldDrop('a', 100)).toBe(true);
    expect(gate.shouldDrop('b', 100)).toBe(true);
  });
});

describe('createBus dedupe window (integration)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('re-accepts the same messageId after the dedupe window elapses', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    const bus = createBus({
      appId: 'a',
      dispatch: 'sync',
      dedupe: { enabled: true, windowMs: 1_000 },
      validators: {
        'orders:filters-changed': OrdersFiltersEventSchema,
      },
    });
    let count = 0;
    bus.subscribe('orders:filters-changed', () => {
      count += 1;
    });
    const messageId = crypto.randomUUID();
    const base: EventMessage<{ filter: string }> = {
      messageName: 'orders:filters-changed',
      messageVersion: 1,
      messageId,
      correlationId: crypto.randomUUID(),
      source: 'remote-orders',
      occurredAtUtc: new Date().toISOString(),
      kind: 'event',
      eventKind: 'orders.filters-changed',
      sensitivity: 'public',
      payload: { filter: 'open' },
    };
    bus.publish(base);
    bus.publish({ ...base, correlationId: crypto.randomUUID() });
    expect(count).toBe(1);

    vi.advanceTimersByTime(1_001);
    bus.publish({
      ...base,
      correlationId: crypto.randomUUID(),
      occurredAtUtc: new Date().toISOString(),
    });
    expect(count).toBe(2);
    bus.dispose();
  });
});
