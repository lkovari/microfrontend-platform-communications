import { z } from 'zod';
import { MessageBaseSchema } from './message-base.schema.js';

export const EventMessageSchema = MessageBaseSchema.extend({
  kind: z.literal('event'),
  eventKind: z.string().min(1),
  payload: z.unknown(),
}).strict();
