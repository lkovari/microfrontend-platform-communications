import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBus } from '../src/core/bus.js';
import { HostBridgeError } from '../src/core/errors.js';
import {
  createHostBridge,
  isValidMfeBridgeHandle,
  MFE_BRIDGE_PROTOCOL_VERSION,
} from '../src/core/host-bridge.js';
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

  it('tryPublish rejects empty string ids and reports Nack', () => {
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
    expect(result.accepted).toBe(false);
    if (!result.accepted) {
      expect(result.errorCode).toBe('validation');
    }
    bridge.dispose();
    bus.dispose();
  });

  it('tryPublish returns accepted ack for valid messages', () => {
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
    const result = bridge.tryPublish({
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
    expect(result.accepted).toBe(true);
    if (result.accepted) {
      expect(result.accepted).toBe(true);
    }
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
    expect(result.accepted).toBe(false);
    if (!result.accepted) {
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

  it('default onConflict throws when a valid bridge is already on window', () => {
    const bus = createBus({
      appId: 'shell-host',
      dispatch: 'sync',
      validators: {},
      allowUnregisteredMessageNames: true,
    });
    const first = createHostBridge({ appId: 'shell-host', bus, remotes: ['a'] });
    expect(() => createHostBridge({ appId: 'shell-host', bus, remotes: ['a'] })).toThrow(
      HostBridgeError,
    );
    first.dispose();
    bus.dispose();
  });

  it('onConflict return-existing returns the same handle when options match', () => {
    const bus = createBus({
      appId: 'shell-host',
      dispatch: 'sync',
      validators: {},
      allowUnregisteredMessageNames: true,
    });
    const first = createHostBridge({
      appId: 'shell-host',
      bus,
      remotes: ['a', 'b'],
      onConflict: 'return-existing',
    });
    const second = createHostBridge({
      appId: 'shell-host',
      bus,
      remotes: ['a', 'b'],
      onConflict: 'return-existing',
    });
    expect(second).toBe(first);
    expect(window.__MFE_BRIDGE__).toBe(first);
    first.dispose();
    bus.dispose();
  });

  it('onConflict return-existing throws when remotes differ', () => {
    const bus = createBus({
      appId: 'shell-host',
      dispatch: 'sync',
      validators: {},
      allowUnregisteredMessageNames: true,
    });
    const first = createHostBridge({
      appId: 'shell-host',
      bus,
      remotes: ['a'],
      onConflict: 'return-existing',
    });
    expect(() =>
      createHostBridge({
        appId: 'shell-host',
        bus,
        remotes: ['b'],
        onConflict: 'return-existing',
      }),
    ).toThrow(HostBridgeError);
    first.dispose();
    bus.dispose();
  });

  it('onConflict replace disposes the previous handle and sets a new bridge', () => {
    const bus1 = createBus({
      appId: 'shell-host',
      dispatch: 'sync',
      validators: {},
      allowUnregisteredMessageNames: true,
    });
    const h1 = createHostBridge({ appId: 'shell-host', bus: bus1, remotes: ['a'] });
    const bus2 = createBus({
      appId: 'shell-host',
      dispatch: 'sync',
      validators: {},
      allowUnregisteredMessageNames: true,
    });
    const h2 = createHostBridge({
      appId: 'shell-host',
      bus: bus2,
      remotes: ['a'],
      onConflict: 'replace',
    });
    expect(window.__MFE_BRIDGE__).toBe(h2);
    expect(h1).not.toBe(h2);
    h2.dispose();
    bus2.dispose();
    bus1.dispose();
  });

  it('throws when window has an invalid global and onConflict is throw', () => {
    Reflect.set(window, '__MFE_BRIDGE__', { getBus: () => ({}) });
    const bus = createBus({
      appId: 'shell-host',
      dispatch: 'sync',
      validators: {},
      allowUnregisteredMessageNames: true,
    });
    expect(() => createHostBridge({ appId: 'shell-host', bus, remotes: ['a'] })).toThrow(
      HostBridgeError,
    );
    bus.dispose();
  });

  it('onConflict replace removes invalid value from window and creates a real bridge', () => {
    Reflect.set(window, '__MFE_BRIDGE__', { getBus: () => ({}) });
    const bus = createBus({
      appId: 'shell-host',
      dispatch: 'sync',
      validators: {},
      allowUnregisteredMessageNames: true,
    });
    const h = createHostBridge({ appId: 'shell-host', bus, remotes: ['a'], onConflict: 'replace' });
    expect(isValidMfeBridgeHandle(h)).toBe(true);
    expect(getBusReturnsPublish(h)).toBe(true);
    h.dispose();
    bus.dispose();
  });

  it('isValidMfeBridgeHandle rejects plain objects and accepts real handles', () => {
    expect(isValidMfeBridgeHandle(null)).toBe(false);
    expect(isValidMfeBridgeHandle({})).toBe(false);
    const bus = createBus({
      appId: 'shell-host',
      dispatch: 'sync',
      validators: {},
      allowUnregisteredMessageNames: true,
    });
    const h = createHostBridge({ appId: 'shell-host', bus, remotes: [] });
    expect(isValidMfeBridgeHandle(h)).toBe(true);
    h.dispose();
    bus.dispose();
  });
});

function getBusReturnsPublish(bridge: { getBus: () => unknown }): boolean {
  const b = bridge.getBus();
  if (b === null || typeof b !== 'object') {
    return false;
  }
  if (!('publish' in b)) {
    return false;
  }
  return typeof Reflect.get(b, 'publish') === 'function';
}
