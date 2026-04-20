import { z } from 'zod';

export const MessageKindSchema = z.enum(['event', 'command', 'query', 'state', 'user-context']);
export const SensitivitySchema = z.enum(['public', 'internal', 'restricted']);

export const MessageBaseSchema = z
  .object({
    messageName: z.string().min(1),
    messageVersion: z.number().int().positive(),
    messageId: z.string().uuid(),
    correlationId: z.string().uuid(),
    causationId: z.string().uuid().optional(),
    source: z.string().min(1),
    target: z.string().min(1).optional(),
    occurredAtUtc: z.string().datetime({ offset: true }),
    kind: MessageKindSchema,
    sensitivity: SensitivitySchema,
    validationDescriptor: z.unknown().optional(),
  })
  .strict();
