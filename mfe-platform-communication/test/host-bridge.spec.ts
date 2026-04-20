import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBus } from '../src/core/bus.js';
import { createHostBridge, MFE_BRIDGE_PROTOCOL_VERSION } from '../src/core/host-bridge.js';
import type { EventMessage } from '../src/contracts/event-message.js';
import { OrdersFiltersEventSchema } from './helpers.js';
import { StateMessageSchema } from '../src/schemas/state-message.schema.js';

function isoNow(): string {
  return new Date().toISOString();
}

describe('createHostBridge', () => {
  afterEach(() => {
    if (typeof window !== 'undefined') {
      delete window.__MFE_BRIDGE__;
    }
  });

  it('exposes window.__MFE_BRIDGE__ with versioned handshake', () => {
    const bus = createBus({
      appId: 'shell-host',
      dispatch: 'sync',
      validators: {},
      allowUnregisteredMessageNames: true,
    });
    const bridge = createHostBridge({
      appId: 'shell-host',
      bus,
      remotes: ['remote-orders'],
    });
    expect(window.__MFE_BRIDGE__).toBe(bridge);
    expect(window.__MFE_BRIDGE__?.protocolVersion).toBe(MFE_BRIDGE_PROTOCOL_VERSION);
    expect(window.__MFE_BRIDGE__?.appId).toBe('shell-host');
    bridge.dispose();
    bus.dispose();
  });

  it('tryPublish assigns missing metadata', () => {
    const bus = createBus({
      appId: 'shell-host',
      dispatch: 'sync',
      validators: {
        'orders:filters-changed': OrdersFiltersEventSchema,
      },
    });
    const bridge = createHostBridge({
      appId: 'shell-host',
      bus,
      remotes: ['remote-orders'],
    });
    let received = '';
    bus.subscribe<EventMessage<{ filter: string }>>('orders:filters-changed', (m) => {
      received = m.messageId;
    });
    const inbound: EventMessage<{ filter: string }> = {
      messageName: 'orders:filters-changed',
      messageVersion: 1,
      messageId: '',
      correlationId: '',
      source: 'remote-orders',
      occurredAtUtc: '',
      kind: 'event',
      eventKind: 'orders.filters-changed',
      sensitivity: 'public',
      payload: { filter: 'open' },
    };
    const result = bridge.tryPublish(inbound);
    expect(result.ok).toBe(true);
    expect(received.length).toBeGreaterThan(10);
    bridge.dispose();
    bus.dispose();
  });

  it('restricted sensitivity returns unauthorized Nack', () => {
    const bus = createBus({
      appId: 'shell-host',
      dispatch: 'sync',
      validators: {
        'orders:filters-changed': OrdersFiltersEventSchema,
      },
    });
    const bridge = createHostBridge({
      appId: 'shell-host',
      bus,
      remotes: ['remote-orders'],
    });
    const restricted: EventMessage<{ filter: string }> = {
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
    };
    const result = bridge.tryPublish(restricted);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errorCode).toBe('unauthorized');
    }
    bridge.dispose();
    bus.dispose();
  });

  it('policy hook runs on publish path', () => {
    const policy = vi.fn();
    const bus = createBus({
      appId: 'shell-host',
      dispatch: 'sync',
      validators: {
        'orders:filters-changed': OrdersFiltersEventSchema,
      },
      policy,
    });
    const bridge = createHostBridge({
      appId: 'shell-host',
      bus,
      remotes: ['remote-orders'],
    });
    const evt: EventMessage<{ filter: string }> = {
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
    };
    bridge.tryPublish(evt);
    expect(policy).toHaveBeenCalled();
    bridge.dispose();
    bus.dispose();
  });

  it('remote-to-remote is host-mediated: separate buses do not cross-deliver', () => {
    const busA = createBus({
      appId: 'remote-a',
      dispatch: 'sync',
      validators: {
        'person:updated': StateMessageSchema,
      },
    });
    const busB = createBus({
      appId: 'remote-b',
      dispatch: 'sync',
      validators: {
        'person:updated': StateMessageSchema,
      },
    });
    let bCount = 0;
    busB.subscribe('person:updated', () => {
      bCount += 1;
    });
    busA.publish({
      messageName: 'person:updated',
      messageVersion: 1,
      messageId: crypto.randomUUID(),
      correlationId: crypto.randomUUID(),
      source: 'remote-a',
      target: 'remote-b',
      occurredAtUtc: isoNow(),
      kind: 'state',
      sensitivity: 'internal',
      stateKey: 'person',
      operation: 'replace',
      revision: 1,
      payload: { id: 'p-1', firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com' },
    });
    expect(bCount).toBe(0);
    busA.dispose();
    busB.dispose();
  });

  it('remote-to-remote works when sharing host bus instance', () => {
    const bus = createBus({
      appId: 'shell-host',
      dispatch: 'sync',
      validators: {
        'person:updated': StateMessageSchema,
      },
    });
    const bridge = createHostBridge({
      appId: 'shell-host',
      bus,
      remotes: ['remote-a', 'remote-b'],
    });
    const shared = bridge.getBus();
    let bCount = 0;
    shared.subscribe(
      'person:updated',
      () => {
        bCount += 1;
      },
      { subscriberId: 'remote-b' },
    );
    shared.publish({
      messageName: 'person:updated',
      messageVersion: 1,
      messageId: crypto.randomUUID(),
      correlationId: crypto.randomUUID(),
      source: 'remote-a',
      target: 'remote-b',
      occurredAtUtc: isoNow(),
      kind: 'state',
      sensitivity: 'internal',
      stateKey: 'person',
      operation: 'replace',
      revision: 1,
      payload: { id: 'p-1', firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com' },
    });
    expect(bCount).toBe(1);
    bridge.dispose();
    bus.dispose();
  });
});
