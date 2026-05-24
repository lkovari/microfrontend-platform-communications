import type { z } from 'zod';
import type { CommandMessageSchema } from '../schemas/command-message.schema.js';

type CommandMessageBase = z.infer<typeof CommandMessageSchema>;
export type CommandMessage<TPayload = unknown> = Omit<CommandMessageBase, 'payload'> & {
  payload: TPayload;
};
