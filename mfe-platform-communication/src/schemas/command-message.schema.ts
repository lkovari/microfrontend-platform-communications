import { z } from 'zod';
import { MessageBaseSchema } from './message-base.schema.js';

export const CommandMessageSchema = MessageBaseSchema.extend({
  kind: z.literal('command'),
  commandName: z.string().min(1),
  payload: z.unknown(),
  ackTimeoutMs: z.number().int().positive().optional(),
}).strict();
