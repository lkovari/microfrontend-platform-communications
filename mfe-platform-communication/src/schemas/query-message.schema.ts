import { z } from 'zod';
import { MessageBaseSchema } from './message-base.schema.js';

export const QueryMessageSchema = MessageBaseSchema.extend({
  kind: z.literal('query'),
  queryName: z.string().min(1),
  payload: z.unknown(),
  expectedResult: z.string().optional(),
  timeoutMs: z.number().int().positive().optional(),
}).strict();
