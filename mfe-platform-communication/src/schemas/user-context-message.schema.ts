import { z } from 'zod';
import { MessageBaseSchema } from './message-base.schema.js';

export const UserContextSchema = z
  .object({
    userId: z.string().min(1),
    displayName: z.string().min(1),
    avatarUrl: z.string().url().optional(),
    rolesForUi: z.array(z.string()),
    tenantId: z.string().optional(),
    locale: z.string().optional(),
    featureFlags: z.record(z.boolean()).optional(),
    sessionVersion: z.string().optional(),
  })
  .strict();

export const UserContextMessageSchema = MessageBaseSchema.extend({
  kind: z.literal('user-context'),
  payload: UserContextSchema,
}).strict();
