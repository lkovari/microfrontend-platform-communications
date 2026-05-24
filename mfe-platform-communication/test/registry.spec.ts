import { describe, expect, it } from 'vitest';
import type { MessageBase } from '../src/contracts/message-base.js';
import { BusPolicyError } from '../src/core/errors.js';
import { TopicRegistry } from '../src/core/registry.js';

function baseMessage(overrides: Partial<MessageBase> = {}): MessageBase {
  return {
    messageName: 'orders:filters-changed',
    messageVersion: 1,
    messageId: crypto.randomUUID(),
    correlationId: crypto.randomUUID(),
    source: 'remote-orders',
    occurredAtUtc: new Date().toISOString(),
    kind: 'event',
    sensitivity: 'public',
    ...overrides,
  };
}

describe('TopicRegistry', () => {
  it('allows publish when topic is unknown', () => {
    const registry = new TopicRegistry();
    expect(() => registry.assertCanPublish(baseMessage())).not.toThrow();
  });

  it('allows publish when publisher is in allowedPublishers', () => {
    const registry = new TopicRegistry();
    registry.register({
      messageName: 'orders:filters-changed',
      allowedPublishers: ['remote-orders'],
    });
    expect(() =>
      registry.assertCanPublish(baseMessage({ source: 'remote-orders' })),
    ).not.toThrow();
  });

  it('rejects publish when publisher is not in allowedPublishers', () => {
    const registry = new TopicRegistry();
    registry.register({
      messageName: 'orders:filters-changed',
      allowedPublishers: ['remote-orders'],
    });
    expect(() => registry.assertCanPublish(baseMessage({ source: 'remote-profile' }))).toThrow(
      expect.objectContaining({ code: 'unauthorized' }),
    );
  });

  it('allows subscribe when topic is unknown', () => {
    const registry = new TopicRegistry();
    expect(() => registry.assertCanSubscribe('orders:filters-changed', 'remote-a')).not.toThrow();
  });

  it('allows subscribe when subscriber is in allowedSubscribers', () => {
    const registry = new TopicRegistry();
    registry.register({
      messageName: 'orders:filters-changed',
      allowedSubscribers: ['remote-a', 'remote-b'],
    });
    expect(() => registry.assertCanSubscribe('orders:filters-changed', 'remote-a')).not.toThrow();
  });

  it('rejects subscribe when subscriber is not in allowedSubscribers', () => {
    const registry = new TopicRegistry();
    registry.register({
      messageName: 'orders:filters-changed',
      allowedSubscribers: ['remote-a'],
    });
    expect(() => registry.assertCanSubscribe('orders:filters-changed', 'remote-b')).toThrow(
      BusPolicyError,
    );
  });

  it('rejects messageVersion below minMessageVersion', () => {
    const registry = new TopicRegistry();
    registry.register({
      messageName: 'orders:filters-changed',
      minMessageVersion: 2,
    });
    expect(() => registry.assertCanPublish(baseMessage({ messageVersion: 1 }))).toThrow(
      expect.objectContaining({ code: 'incompatible-version' }),
    );
  });

  it('rejects messageVersion above maxMessageVersion', () => {
    const registry = new TopicRegistry();
    registry.register({
      messageName: 'orders:filters-changed',
      maxMessageVersion: 1,
    });
    expect(() => registry.assertCanPublish(baseMessage({ messageVersion: 2 }))).toThrow(
      expect.objectContaining({ code: 'incompatible-version' }),
    );
  });

  it('allows messageVersion within min and max window', () => {
    const registry = new TopicRegistry();
    registry.register({
      messageName: 'orders:filters-changed',
      minMessageVersion: 1,
      maxMessageVersion: 3,
    });
    expect(() => registry.assertCanPublish(baseMessage({ messageVersion: 2 }))).not.toThrow();
  });
});
