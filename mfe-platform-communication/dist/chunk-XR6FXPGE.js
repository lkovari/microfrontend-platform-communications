import { z } from 'zod';

// src/schemas/message-base.schema.ts
var MessageKindSchema = z.enum(["event", "command", "query", "state", "user-context"]);
var SensitivitySchema = z.enum(["public", "internal", "restricted"]);
var MessageBaseSchema = z.object({
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
  validationDescriptor: z.unknown().optional()
}).strict();
var EventMessageSchema = MessageBaseSchema.extend({
  kind: z.literal("event"),
  eventKind: z.string().min(1),
  payload: z.unknown()
}).strict();
var StateOperationSchema = z.enum(["replace", "patch", "remove", "reset"]);
var StateMessageSchema = MessageBaseSchema.extend({
  kind: z.literal("state"),
  stateKey: z.string().min(1),
  operation: StateOperationSchema,
  revision: z.number().int().nonnegative(),
  payload: z.unknown()
}).strict();
var CommandMessageSchema = MessageBaseSchema.extend({
  kind: z.literal("command"),
  commandName: z.string().min(1),
  payload: z.unknown(),
  ackTimeoutMs: z.number().int().positive().optional()
}).strict();
var QueryMessageSchema = MessageBaseSchema.extend({
  kind: z.literal("query"),
  queryName: z.string().min(1),
  payload: z.unknown(),
  expectedResult: z.string().optional(),
  timeoutMs: z.number().int().positive().optional()
}).strict();
var UserContextSchema = z.object({
  userId: z.string().min(1),
  displayName: z.string().min(1),
  avatarUrl: z.string().optional(),
  rolesForUi: z.array(z.string()),
  tenantId: z.string().optional(),
  locale: z.string().optional(),
  featureFlags: z.record(z.boolean()).optional(),
  sessionVersion: z.string().optional()
}).strict();
var UserContextMessageSchema = MessageBaseSchema.extend({
  kind: z.literal("user-context"),
  payload: UserContextSchema
}).strict();

export { CommandMessageSchema, EventMessageSchema, MessageBaseSchema, MessageKindSchema, QueryMessageSchema, SensitivitySchema, StateMessageSchema, StateOperationSchema, UserContextMessageSchema, UserContextSchema };
//# sourceMappingURL=chunk-XR6FXPGE.js.map
//# sourceMappingURL=chunk-XR6FXPGE.js.map