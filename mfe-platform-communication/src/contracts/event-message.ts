import type { z } from 'zod';
import type { EventMessageSchema } from '../schemas/event-message.schema.js';

type EventMessageBase = z.infer<typeof EventMessageSchema>;
export type EventMessage<TPayload = unknown> = Omit<EventMessageBase, 'payload'> & { payload: TPayload };
