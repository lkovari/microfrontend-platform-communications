import { describe, expect, it } from 'vitest';
import { MessageBaseSchema } from '../src/schemas/message-base.schema.js';
import { EventMessageSchema } from '../src/schemas/event-message.schema.js';
import { StateMessageSchema } from '../src/schemas/state-message.schema.js';
import { UserContextMessageSchema } from '../src/schemas/user-context-message.schema.js';

describe('Zod schemas', () => {
  const validBase = {
    messageName: 'x:y',
    messageVersion: 1,
    messageId: crypto.randomUUID(),
    correlationId: crypto.randomUUID(),
    source: 's',
    occurredAtUtc: new Date().toISOString(),
    kind: 'event',
    sensitivity: 'public',
  } as const;

  it('accepts valid envelopes', () => {
    expect(
      EventMessageSchema.safeParse({
        ...validBase,
        kind: 'event',
        eventKind: 'x',
        payload: {},
      }).success,
    ).toBe(true);
  });

  it('rejects bad uuid', () => {
    const r = MessageBaseSchema.safeParse({
      ...validBase,
      messageId: 'nope',
    });
    expect(r.success).toBe(false);
  });

  it('rejects bad occurredAtUtc', () => {
    const r = MessageBaseSchema.safeParse({
      ...validBase,
      occurredAtUtc: 'not-a-date',
    });
    expect(r.success).toBe(false);
  });

  it('rejects missing kind', () => {
    const r = MessageBaseSchema.safeParse({
      messageName: 'x:y',
      messageVersion: 1,
      messageId: crypto.randomUUID(),
      correlationId: crypto.randomUUID(),
      source: 's',
      occurredAtUtc: new Date().toISOString(),
      sensitivity: 'public',
    });
    expect(r.success).toBe(false);
  });

  it('rejects wrong sensitivity', () => {
    const r = MessageBaseSchema.safeParse({
      ...validBase,
      sensitivity: 'top-secret',
    });
    expect(r.success).toBe(false);
  });

  it('rejects negative revision for state messages', () => {
    const r = StateMessageSchema.safeParse({
      ...validBase,
      kind: 'state',
      stateKey: 'person',
      operation: 'replace',
      revision: -1,
      payload: {},
    });
    expect(r.success).toBe(false);
  });

  it('ValidationDescriptor metadata is not validated structurally beyond unknown', () => {
    const r = UserContextMessageSchema.safeParse({
      ...validBase,
      kind: 'user-context',
      validationDescriptor: { required: ['nope'] },
      payload: {
        userId: 'u1',
        displayName: 'Ada',
        rolesForUi: [],
      },
    });
    expect(r.success).toBe(true);
  });
});
