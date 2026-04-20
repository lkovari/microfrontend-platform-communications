import { z } from 'zod';
import { EventMessageSchema } from '../src/schemas/event-message.schema.js';
import { StateMessageSchema } from '../src/schemas/state-message.schema.js';

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
