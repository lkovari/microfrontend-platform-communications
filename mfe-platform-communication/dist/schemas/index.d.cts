import { z } from 'zod';

declare const MessageKindSchema: z.ZodEnum<["event", "command", "query", "state", "user-context"]>;
declare const SensitivitySchema: z.ZodEnum<["public", "internal", "restricted"]>;
declare const MessageBaseSchema: z.ZodObject<{
    messageName: z.ZodString;
    messageVersion: z.ZodNumber;
    messageId: z.ZodString;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    source: z.ZodString;
    target: z.ZodOptional<z.ZodString>;
    occurredAtUtc: z.ZodString;
    kind: z.ZodEnum<["event", "command", "query", "state", "user-context"]>;
    sensitivity: z.ZodEnum<["public", "internal", "restricted"]>;
    validationDescriptor: z.ZodOptional<z.ZodUnknown>;
}, "strict", z.ZodTypeAny, {
    messageName: string;
    messageVersion: number;
    messageId: string;
    correlationId: string;
    source: string;
    occurredAtUtc: string;
    kind: "event" | "command" | "query" | "state" | "user-context";
    sensitivity: "public" | "internal" | "restricted";
    causationId?: string | undefined;
    target?: string | undefined;
    validationDescriptor?: unknown;
}, {
    messageName: string;
    messageVersion: number;
    messageId: string;
    correlationId: string;
    source: string;
    occurredAtUtc: string;
    kind: "event" | "command" | "query" | "state" | "user-context";
    sensitivity: "public" | "internal" | "restricted";
    causationId?: string | undefined;
    target?: string | undefined;
    validationDescriptor?: unknown;
}>;

declare const EventMessageSchema: z.ZodObject<{
    messageName: z.ZodString;
    messageVersion: z.ZodNumber;
    messageId: z.ZodString;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    source: z.ZodString;
    target: z.ZodOptional<z.ZodString>;
    occurredAtUtc: z.ZodString;
    sensitivity: z.ZodEnum<["public", "internal", "restricted"]>;
    validationDescriptor: z.ZodOptional<z.ZodUnknown>;
} & {
    kind: z.ZodLiteral<"event">;
    eventKind: z.ZodString;
    payload: z.ZodUnknown;
}, "strict", z.ZodTypeAny, {
    messageName: string;
    messageVersion: number;
    messageId: string;
    correlationId: string;
    source: string;
    occurredAtUtc: string;
    kind: "event";
    sensitivity: "public" | "internal" | "restricted";
    eventKind: string;
    causationId?: string | undefined;
    target?: string | undefined;
    validationDescriptor?: unknown;
    payload?: unknown;
}, {
    messageName: string;
    messageVersion: number;
    messageId: string;
    correlationId: string;
    source: string;
    occurredAtUtc: string;
    kind: "event";
    sensitivity: "public" | "internal" | "restricted";
    eventKind: string;
    causationId?: string | undefined;
    target?: string | undefined;
    validationDescriptor?: unknown;
    payload?: unknown;
}>;

declare const StateOperationSchema: z.ZodEnum<["replace", "patch", "remove", "reset"]>;
declare const StateMessageSchema: z.ZodObject<{
    messageName: z.ZodString;
    messageVersion: z.ZodNumber;
    messageId: z.ZodString;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    source: z.ZodString;
    target: z.ZodOptional<z.ZodString>;
    occurredAtUtc: z.ZodString;
    sensitivity: z.ZodEnum<["public", "internal", "restricted"]>;
    validationDescriptor: z.ZodOptional<z.ZodUnknown>;
} & {
    kind: z.ZodLiteral<"state">;
    stateKey: z.ZodString;
    operation: z.ZodEnum<["replace", "patch", "remove", "reset"]>;
    revision: z.ZodNumber;
    payload: z.ZodUnknown;
}, "strict", z.ZodTypeAny, {
    messageName: string;
    messageVersion: number;
    messageId: string;
    correlationId: string;
    source: string;
    occurredAtUtc: string;
    kind: "state";
    sensitivity: "public" | "internal" | "restricted";
    stateKey: string;
    operation: "replace" | "patch" | "remove" | "reset";
    revision: number;
    causationId?: string | undefined;
    target?: string | undefined;
    validationDescriptor?: unknown;
    payload?: unknown;
}, {
    messageName: string;
    messageVersion: number;
    messageId: string;
    correlationId: string;
    source: string;
    occurredAtUtc: string;
    kind: "state";
    sensitivity: "public" | "internal" | "restricted";
    stateKey: string;
    operation: "replace" | "patch" | "remove" | "reset";
    revision: number;
    causationId?: string | undefined;
    target?: string | undefined;
    validationDescriptor?: unknown;
    payload?: unknown;
}>;

declare const CommandMessageSchema: z.ZodObject<{
    messageName: z.ZodString;
    messageVersion: z.ZodNumber;
    messageId: z.ZodString;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    source: z.ZodString;
    target: z.ZodOptional<z.ZodString>;
    occurredAtUtc: z.ZodString;
    sensitivity: z.ZodEnum<["public", "internal", "restricted"]>;
    validationDescriptor: z.ZodOptional<z.ZodUnknown>;
} & {
    kind: z.ZodLiteral<"command">;
    commandName: z.ZodString;
    payload: z.ZodUnknown;
    ackTimeoutMs: z.ZodOptional<z.ZodNumber>;
}, "strict", z.ZodTypeAny, {
    messageName: string;
    messageVersion: number;
    messageId: string;
    correlationId: string;
    source: string;
    occurredAtUtc: string;
    kind: "command";
    sensitivity: "public" | "internal" | "restricted";
    commandName: string;
    causationId?: string | undefined;
    target?: string | undefined;
    validationDescriptor?: unknown;
    payload?: unknown;
    ackTimeoutMs?: number | undefined;
}, {
    messageName: string;
    messageVersion: number;
    messageId: string;
    correlationId: string;
    source: string;
    occurredAtUtc: string;
    kind: "command";
    sensitivity: "public" | "internal" | "restricted";
    commandName: string;
    causationId?: string | undefined;
    target?: string | undefined;
    validationDescriptor?: unknown;
    payload?: unknown;
    ackTimeoutMs?: number | undefined;
}>;

declare const QueryMessageSchema: z.ZodObject<{
    messageName: z.ZodString;
    messageVersion: z.ZodNumber;
    messageId: z.ZodString;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    source: z.ZodString;
    target: z.ZodOptional<z.ZodString>;
    occurredAtUtc: z.ZodString;
    sensitivity: z.ZodEnum<["public", "internal", "restricted"]>;
    validationDescriptor: z.ZodOptional<z.ZodUnknown>;
} & {
    kind: z.ZodLiteral<"query">;
    queryName: z.ZodString;
    payload: z.ZodUnknown;
    expectedResult: z.ZodOptional<z.ZodString>;
    timeoutMs: z.ZodOptional<z.ZodNumber>;
}, "strict", z.ZodTypeAny, {
    messageName: string;
    messageVersion: number;
    messageId: string;
    correlationId: string;
    source: string;
    occurredAtUtc: string;
    kind: "query";
    sensitivity: "public" | "internal" | "restricted";
    queryName: string;
    causationId?: string | undefined;
    target?: string | undefined;
    validationDescriptor?: unknown;
    payload?: unknown;
    expectedResult?: string | undefined;
    timeoutMs?: number | undefined;
}, {
    messageName: string;
    messageVersion: number;
    messageId: string;
    correlationId: string;
    source: string;
    occurredAtUtc: string;
    kind: "query";
    sensitivity: "public" | "internal" | "restricted";
    queryName: string;
    causationId?: string | undefined;
    target?: string | undefined;
    validationDescriptor?: unknown;
    payload?: unknown;
    expectedResult?: string | undefined;
    timeoutMs?: number | undefined;
}>;

declare const UserContextSchema: z.ZodObject<{
    userId: z.ZodString;
    displayName: z.ZodString;
    avatarUrl: z.ZodOptional<z.ZodString>;
    rolesForUi: z.ZodArray<z.ZodString, "many">;
    tenantId: z.ZodOptional<z.ZodString>;
    locale: z.ZodOptional<z.ZodString>;
    featureFlags: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodBoolean>>;
    sessionVersion: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    userId: string;
    displayName: string;
    rolesForUi: string[];
    avatarUrl?: string | undefined;
    tenantId?: string | undefined;
    locale?: string | undefined;
    featureFlags?: Record<string, boolean> | undefined;
    sessionVersion?: string | undefined;
}, {
    userId: string;
    displayName: string;
    rolesForUi: string[];
    avatarUrl?: string | undefined;
    tenantId?: string | undefined;
    locale?: string | undefined;
    featureFlags?: Record<string, boolean> | undefined;
    sessionVersion?: string | undefined;
}>;
declare const UserContextMessageSchema: z.ZodObject<{
    messageName: z.ZodString;
    messageVersion: z.ZodNumber;
    messageId: z.ZodString;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    source: z.ZodString;
    target: z.ZodOptional<z.ZodString>;
    occurredAtUtc: z.ZodString;
    sensitivity: z.ZodEnum<["public", "internal", "restricted"]>;
    validationDescriptor: z.ZodOptional<z.ZodUnknown>;
} & {
    kind: z.ZodLiteral<"user-context">;
    payload: z.ZodObject<{
        userId: z.ZodString;
        displayName: z.ZodString;
        avatarUrl: z.ZodOptional<z.ZodString>;
        rolesForUi: z.ZodArray<z.ZodString, "many">;
        tenantId: z.ZodOptional<z.ZodString>;
        locale: z.ZodOptional<z.ZodString>;
        featureFlags: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodBoolean>>;
        sessionVersion: z.ZodOptional<z.ZodString>;
    }, "strict", z.ZodTypeAny, {
        userId: string;
        displayName: string;
        rolesForUi: string[];
        avatarUrl?: string | undefined;
        tenantId?: string | undefined;
        locale?: string | undefined;
        featureFlags?: Record<string, boolean> | undefined;
        sessionVersion?: string | undefined;
    }, {
        userId: string;
        displayName: string;
        rolesForUi: string[];
        avatarUrl?: string | undefined;
        tenantId?: string | undefined;
        locale?: string | undefined;
        featureFlags?: Record<string, boolean> | undefined;
        sessionVersion?: string | undefined;
    }>;
}, "strict", z.ZodTypeAny, {
    messageName: string;
    messageVersion: number;
    messageId: string;
    correlationId: string;
    source: string;
    occurredAtUtc: string;
    kind: "user-context";
    sensitivity: "public" | "internal" | "restricted";
    payload: {
        userId: string;
        displayName: string;
        rolesForUi: string[];
        avatarUrl?: string | undefined;
        tenantId?: string | undefined;
        locale?: string | undefined;
        featureFlags?: Record<string, boolean> | undefined;
        sessionVersion?: string | undefined;
    };
    causationId?: string | undefined;
    target?: string | undefined;
    validationDescriptor?: unknown;
}, {
    messageName: string;
    messageVersion: number;
    messageId: string;
    correlationId: string;
    source: string;
    occurredAtUtc: string;
    kind: "user-context";
    sensitivity: "public" | "internal" | "restricted";
    payload: {
        userId: string;
        displayName: string;
        rolesForUi: string[];
        avatarUrl?: string | undefined;
        tenantId?: string | undefined;
        locale?: string | undefined;
        featureFlags?: Record<string, boolean> | undefined;
        sessionVersion?: string | undefined;
    };
    causationId?: string | undefined;
    target?: string | undefined;
    validationDescriptor?: unknown;
}>;

export { CommandMessageSchema, EventMessageSchema, MessageBaseSchema, MessageKindSchema, QueryMessageSchema, SensitivitySchema, StateMessageSchema, StateOperationSchema, UserContextMessageSchema, UserContextSchema };
