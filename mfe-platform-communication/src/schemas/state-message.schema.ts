import { z } from 'zod';
import { MessageBaseSchema } from './message-base.schema.js';

export const StateOperationSchema = z.enum(['replace', 'patch', 'remove', 'reset']);

export const StateMessageSchema = MessageBaseSchema.extend({
  kind: z.literal('state'),
  stateKey: z.string().min(1),
  operation: StateOperationSchema,
  revision: z.number().int().nonnegative(),
  payload: z.unknown(),
}).strict();
