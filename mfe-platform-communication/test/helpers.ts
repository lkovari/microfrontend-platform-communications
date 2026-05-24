import { expect } from 'vitest';
import type { ZodType } from 'zod';
import { z } from 'zod';
import type { MessageBase } from '../src/contracts/message-base.js';
import { EventMessageSchema } from '../src/schemas/event-message.schema.js';
import { StateMessageSchema } from '../src/schemas/state-message.schema.js';

export function expectParsedMessage<M>(message: MessageBase, schema: ZodType<M>): M {
  const parsed = schema.safeParse(message);
  expect(parsed.success).toBe(true);
  if (!parsed.success) {
    throw new Error(parsed.error.message);
  }
  return parsed.data;
}

export const PersonSchema = z.object({
  id: z.string(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
});

export const PersonStateMessageSchema = StateMessageSchema.extend({
  stateKey: z.literal('person'),
  payload: PersonSchema,
});

export const OrdersFiltersEventSchema = EventMessageSchema.extend({
  payload: z.object({ filter: z.string() }),
});
