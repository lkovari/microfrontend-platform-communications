import { describe, expect, it } from 'vitest';
import { createBus } from '../src/core/bus.js';
import { attachStateSync } from '../src/core/state-sync.js';
import { StateMessageSchema } from '../src/schemas/state-message.schema.js';

function isoNow(): string {
  return new Date().toISOString();
}

describe('attachStateSync', () => {
  it('applies replace, patch, remove, reset', () => {
    const bus = createBus({
      appId: 'host',
      dispatch: 'sync',
      validators: {
        'person:updated': StateMessageSchema,
      },
    });
    const coord = attachStateSync(bus, {
      enabled: true,
      initialRevisions: { person: 0 },
      conflictStrategy: 'last-writer-wins',
    });
    bus.publish({
      messageName: 'person:updated',
      messageVersion: 1,
      messageId: crypto.randomUUID(),
      correlationId: crypto.randomUUID(),
      source: 'remote-profile',
      occurredAtUtc: isoNow(),
      kind: 'state',
      sensitivity: 'internal',
      stateKey: 'person',
      operation: 'replace',
      revision: 1,
      payload: { id: 'p-1', firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com' },
    });
    expect(coord.getRevision('person')).toBe(1);
    bus.publish({
      messageName: 'person:updated',
      messageVersion: 1,
      messageId: crypto.randomUUID(),
      correlationId: crypto.randomUUID(),
      source: 'remote-profile',
      occurredAtUtc: isoNow(),
      kind: 'state',
      sensitivity: 'internal',
      stateKey: 'person',
      operation: 'patch',
      revision: 2,
      payload: { firstName: 'Augusta' },
    });
    const snap = coord.getSnapshot('person');
    expect(snap).toMatchObject({ firstName: 'Augusta' });
    bus.publish({
      messageName: 'person:updated',
      messageVersion: 1,
      messageId: crypto.randomUUID(),
      correlationId: crypto.randomUUID(),
      source: 'remote-profile',
      occurredAtUtc: isoNow(),
      kind: 'state',
      sensitivity: 'internal',
      stateKey: 'person',
      operation: 'remove',
      revision: 3,
      payload: { id: 'p-1', firstName: 'x', lastName: 'x', email: 'x@example.com' },
    });
    expect(coord.getRevision('person')).toBeUndefined();
    bus.publish({
      messageName: 'person:updated',
      messageVersion: 1,
      messageId: crypto.randomUUID(),
      correlationId: crypto.randomUUID(),
      source: 'remote-profile',
      occurredAtUtc: isoNow(),
      kind: 'state',
      sensitivity: 'internal',
      stateKey: 'person',
      operation: 'reset',
      revision: 0,
      payload: { id: 'p-1', firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com' },
    });
    expect(coord.getRevision('person')).toBe(0);
    coord.dispose();
    bus.dispose();
  });

  it('patch performs deep object merge for nested fields', () => {
    const bus = createBus({
      appId: 'host',
      dispatch: 'sync',
      validators: {
        'person:updated': StateMessageSchema,
      },
    });
    const coord = attachStateSync(bus, {
      enabled: true,
      initialRevisions: { person: 0 },
      conflictStrategy: 'last-writer-wins',
    });
    bus.publish({
      messageName: 'person:updated',
      messageVersion: 1,
      messageId: crypto.randomUUID(),
      correlationId: crypto.randomUUID(),
      source: 'remote-profile',
      occurredAtUtc: isoNow(),
      kind: 'state',
      sensitivity: 'internal',
      stateKey: 'person',
      operation: 'replace',
      revision: 1,
      payload: { user: { firstName: 'Ada', lastName: 'Lovelace' }, age: 30 },
    });
    bus.publish({
      messageName: 'person:updated',
      messageVersion: 1,
      messageId: crypto.randomUUID(),
      correlationId: crypto.randomUUID(),
      source: 'remote-profile',
      occurredAtUtc: isoNow(),
      kind: 'state',
      sensitivity: 'internal',
      stateKey: 'person',
      operation: 'patch',
      revision: 2,
      payload: { user: { age: 31 } },
    });
    const snapshot = coord.getSnapshot('person');
    expect(snapshot).toMatchObject({
      user: { firstName: 'Ada', lastName: 'Lovelace', age: 31 },
      age: 30,
    });
    coord.dispose();
    bus.dispose();
  });

  it('patch follows merge-patch semantics for non-object payloads', () => {
    const bus = createBus({
      appId: 'host',
      dispatch: 'sync',
      validators: {
        'person:updated': StateMessageSchema,
      },
    });
    const coord = attachStateSync(bus, {
      enabled: true,
      initialRevisions: { person: 0 },
      conflictStrategy: 'last-writer-wins',
    });
    bus.publish({
      messageName: 'person:updated',
      messageVersion: 1,
      messageId: crypto.randomUUID(),
      correlationId: crypto.randomUUID(),
      source: 'remote-profile',
      occurredAtUtc: isoNow(),
      kind: 'state',
      sensitivity: 'internal',
      stateKey: 'person',
      operation: 'replace',
      revision: 1,
      payload: { id: 'p-1', firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com' },
    });
    bus.publish({
      messageName: 'person:updated',
      messageVersion: 1,
      messageId: crypto.randomUUID(),
      correlationId: crypto.randomUUID(),
      source: 'remote-profile',
      occurredAtUtc: isoNow(),
      kind: 'state',
      sensitivity: 'internal',
      stateKey: 'person',
      operation: 'patch',
      revision: 2,
      payload: 'invalid',
    });
    const snapshot = coord.getSnapshot('person');
    expect(snapshot).toBe('invalid');
    coord.dispose();
    bus.dispose();
  });

  it('patch deletes a top-level key when the value is null', () => {
    const bus = createBus({
      appId: 'host',
      dispatch: 'sync',
      validators: {
        'person:updated': StateMessageSchema,
      },
    });
    const coord = attachStateSync(bus, {
      enabled: true,
      initialRevisions: { person: 0 },
      conflictStrategy: 'last-writer-wins',
    });
    bus.publish({
      messageName: 'person:updated',
      messageVersion: 1,
      messageId: crypto.randomUUID(),
      correlationId: crypto.randomUUID(),
      source: 'remote-profile',
      occurredAtUtc: isoNow(),
      kind: 'state',
      sensitivity: 'internal',
      stateKey: 'person',
      operation: 'replace',
      revision: 1,
      payload: { id: 'p-1', firstName: 'Ada', email: 'ada@example.com' },
    });
    bus.publish({
      messageName: 'person:updated',
      messageVersion: 1,
      messageId: crypto.randomUUID(),
      correlationId: crypto.randomUUID(),
      source: 'remote-profile',
      occurredAtUtc: isoNow(),
      kind: 'state',
      sensitivity: 'internal',
      stateKey: 'person',
      operation: 'patch',
      revision: 2,
      payload: { email: null },
    });
    expect(coord.getSnapshot('person')).toEqual({ id: 'p-1', firstName: 'Ada' });
    coord.dispose();
    bus.dispose();
  });

  it('patch deletes only the targeted nested key when the nested value is null', () => {
    const bus = createBus({
      appId: 'host',
      dispatch: 'sync',
      validators: {
        'person:updated': StateMessageSchema,
      },
    });
    const coord = attachStateSync(bus, {
      enabled: true,
      initialRevisions: { person: 0 },
      conflictStrategy: 'last-writer-wins',
    });
    bus.publish({
      messageName: 'person:updated',
      messageVersion: 1,
      messageId: crypto.randomUUID(),
      correlationId: crypto.randomUUID(),
      source: 'remote-profile',
      occurredAtUtc: isoNow(),
      kind: 'state',
      sensitivity: 'internal',
      stateKey: 'person',
      operation: 'replace',
      revision: 1,
      payload: { user: { firstName: 'Ada', lastName: 'Lovelace' }, age: 30 },
    });
    bus.publish({
      messageName: 'person:updated',
      messageVersion: 1,
      messageId: crypto.randomUUID(),
      correlationId: crypto.randomUUID(),
      source: 'remote-profile',
      occurredAtUtc: isoNow(),
      kind: 'state',
      sensitivity: 'internal',
      stateKey: 'person',
      operation: 'patch',
      revision: 2,
      payload: { user: { lastName: null } },
    });
    expect(coord.getSnapshot('person')).toEqual({
      user: { firstName: 'Ada' },
      age: 30,
    });
    coord.dispose();
    bus.dispose();
  });

  it('patch cannot store a literal null value (replace is required for that)', () => {
    const bus = createBus({
      appId: 'host',
      dispatch: 'sync',
      validators: {
        'person:updated': StateMessageSchema,
      },
    });
    const coord = attachStateSync(bus, {
      enabled: true,
      initialRevisions: { person: 0 },
      conflictStrategy: 'last-writer-wins',
    });
    bus.publish({
      messageName: 'person:updated',
      messageVersion: 1,
      messageId: crypto.randomUUID(),
      correlationId: crypto.randomUUID(),
      source: 'remote-profile',
      occurredAtUtc: isoNow(),
      kind: 'state',
      sensitivity: 'internal',
      stateKey: 'person',
      operation: 'replace',
      revision: 1,
      payload: { id: 'p-1', nickname: 'Countess' },
    });
    bus.publish({
      messageName: 'person:updated',
      messageVersion: 1,
      messageId: crypto.randomUUID(),
      correlationId: crypto.randomUUID(),
      source: 'remote-profile',
      occurredAtUtc: isoNow(),
      kind: 'state',
      sensitivity: 'internal',
      stateKey: 'person',
      operation: 'patch',
      revision: 2,
      payload: { nickname: null },
    });
    const patched = coord.getSnapshot('person');
    expect(patched).toEqual({ id: 'p-1' });

    bus.publish({
      messageName: 'person:updated',
      messageVersion: 1,
      messageId: crypto.randomUUID(),
      correlationId: crypto.randomUUID(),
      source: 'remote-profile',
      occurredAtUtc: isoNow(),
      kind: 'state',
      sensitivity: 'internal',
      stateKey: 'person',
      operation: 'replace',
      revision: 3,
      payload: null,
    });
    expect(coord.getSnapshot('person')).toBeNull();
    coord.dispose();
    bus.dispose();
  });

  it('reject-if-stale blocks non-monotonic revisions', () => {
    const bus = createBus({
      appId: 'host',
      dispatch: 'sync',
      validators: {
        'person:updated': StateMessageSchema,
      },
    });
    const coord = attachStateSync(bus, {
      enabled: true,
      initialRevisions: { person: 5 },
      conflictStrategy: 'reject-if-stale',
    });
    expect(() =>
      bus.publish({
        messageName: 'person:updated',
        messageVersion: 1,
        messageId: crypto.randomUUID(),
        correlationId: crypto.randomUUID(),
        source: 'remote-profile',
        occurredAtUtc: isoNow(),
        kind: 'state',
        sensitivity: 'internal',
        stateKey: 'person',
        operation: 'replace',
        revision: 5,
        payload: { id: 'p-1', firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com' },
      }),
    ).toThrow();
    coord.dispose();
    bus.dispose();
  });

  it('custom conflict strategy can reject', () => {
    const bus = createBus({
      appId: 'host',
      dispatch: 'sync',
      validators: {
        'person:updated': StateMessageSchema,
      },
    });
    const coord = attachStateSync(bus, {
      enabled: true,
      initialRevisions: { person: 0 },
      conflictStrategy: 'custom',
      customConflict: () => 'reject',
    });
    expect(() =>
      bus.publish({
        messageName: 'person:updated',
        messageVersion: 1,
        messageId: crypto.randomUUID(),
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
    ).toThrow();
    coord.dispose();
    bus.dispose();
  });
});
