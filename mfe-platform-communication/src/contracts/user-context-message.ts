import type { z } from 'zod';
import type {
  UserContextMessageSchema,
  UserContextSchema,
} from '../schemas/user-context-message.schema.js';

export type UserContext = z.infer<typeof UserContextSchema>;
export type UserContextMessage = z.infer<typeof UserContextMessageSchema>;
