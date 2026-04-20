'use strict';

var zod = require('zod');

// src/schemas/message-base.schema.ts
var MessageKindSchema = zod.z.enum(["event", "command", "query", "state", "user-context"]);
var SensitivitySchema = zod.z.enum(["public", "internal", "restricted"]);
var MessageBaseSchema = zod.z.object({
  messageName: zod.z.string().min(1),
  messageVersion: zod.z.number().int().positive(),
  messageId: zod.z.string().uuid(),
  correlationId: zod.z.string().uuid(),
  causationId: zod.z.string().uuid().optional(),
  source: zod.z.string().min(1),
  target: zod.z.string().min(1).optional(),
  occurredAtUtc: zod.z.string().datetime({ offset: true }),
  kind: MessageKindSchema,
  sensitivity: SensitivitySchema,
  validationDescriptor: zod.z.unknown().optional()
}).strict();
var EventMessageSchema = MessageBaseSchema.extend({
  kind: zod.z.literal("event"),
  eventKind: zod.z.string().min(1),
  payload: zod.z.unknown()
}).strict();
var StateOperationSchema = zod.z.enum(["replace", "patch", "remove", "reset"]);
var StateMessageSchema = MessageBaseSchema.extend({
  kind: zod.z.literal("state"),
  stateKey: zod.z.string().min(1),
  operation: StateOperationSchema,
  revision: zod.z.number().int().nonnegative(),
  payload: zod.z.unknown()
}).strict();
var CommandMessageSchema = MessageBaseSchema.extend({
  kind: zod.z.literal("command"),
  commandName: zod.z.string().min(1),
  payload: zod.z.unknown(),
  ackTimeoutMs: zod.z.number().int().positive().optional()
}).strict();
var QueryMessageSchema = MessageBaseSchema.extend({
  kind: zod.z.literal("query"),
  queryName: zod.z.string().min(1),
  payload: zod.z.unknown(),
  expectedResult: zod.z.string().optional(),
  timeoutMs: zod.z.number().int().positive().optional()
}).strict();
var UserContextSchema = zod.z.object({
  userId: zod.z.string().min(1),
  displayName: zod.z.string().min(1),
  avatarUrl: zod.z.string().optional(),
  rolesForUi: zod.z.array(zod.z.string()),
  tenantId: zod.z.string().optional(),
  locale: zod.z.string().optional(),
  featureFlags: zod.z.record(zod.z.boolean()).optional(),
  sessionVersion: zod.z.string().optional()
}).strict();
var UserContextMessageSchema = MessageBaseSchema.extend({
  kind: zod.z.literal("user-context"),
  payload: UserContextSchema
}).strict();

exports.CommandMessageSchema = CommandMessageSchema;
exports.EventMessageSchema = EventMessageSchema;
exports.MessageBaseSchema = MessageBaseSchema;
exports.MessageKindSchema = MessageKindSchema;
exports.QueryMessageSchema = QueryMessageSchema;
exports.SensitivitySchema = SensitivitySchema;
exports.StateMessageSchema = StateMessageSchema;
exports.StateOperationSchema = StateOperationSchema;
exports.UserContextMessageSchema = UserContextMessageSchema;
exports.UserContextSchema = UserContextSchema;
//# sourceMappingURL=chunk-E6I7W7EI.cjs.map
//# sourceMappingURL=chunk-E6I7W7EI.cjs.map