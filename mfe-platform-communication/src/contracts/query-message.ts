import type { z } from 'zod';
import type { QueryMessageSchema } from '../schemas/query-message.schema.js';

type QueryMessageBase = z.infer<typeof QueryMessageSchema>;
export type QueryMessage<TPayload = unknown> = Omit<QueryMessageBase, 'payload'> & {
  payload: TPayload;
};
