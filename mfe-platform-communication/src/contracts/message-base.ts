import type { z } from 'zod';
import type {
  MessageBaseSchema,
  MessageKindSchema,
  SensitivitySchema,
} from '../schemas/message-base.schema.js';

export type MessageKind = z.infer<typeof MessageKindSchema>;
export type Sensitivity = z.infer<typeof SensitivitySchema>;
export type MessageBase = z.infer<typeof MessageBaseSchema>;
export type ValidationDescriptor = NonNullable<MessageBase['validationDescriptor']>;
