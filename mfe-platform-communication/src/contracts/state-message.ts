import type { z } from 'zod';
import type { StateMessageSchema, StateOperationSchema } from '../schemas/state-message.schema.js';

export type StateOperation = z.infer<typeof StateOperationSchema>;
export type StateMessage = z.infer<typeof StateMessageSchema>;
