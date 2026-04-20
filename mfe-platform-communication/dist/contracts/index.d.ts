import { M as MessageBase } from '../state-message-CmaW-XS3.js';
export { a as MessageKind, S as Sensitivity, b as StateMessage, c as StateOperation, V as ValidationDescriptor } from '../state-message-CmaW-XS3.js';
export { A as Ack, a as AckResult, B as BusErrorCode, N as Nack } from '../envelopes-77I3VM33.js';

interface EventMessage<TPayload = unknown> extends MessageBase {
    readonly kind: 'event';
    readonly eventKind: string;
    readonly payload: TPayload;
}

interface CommandMessage<TPayload = unknown> extends MessageBase {
    readonly kind: 'command';
    readonly commandName: string;
    readonly payload: TPayload;
    readonly ackTimeoutMs?: number;
}

interface QueryMessage<TPayload = unknown, _TResult = unknown> extends MessageBase {
    readonly kind: 'query';
    readonly queryName: string;
    readonly payload: TPayload;
    readonly expectedResult?: string;
    readonly timeoutMs?: number;
}

interface UserContext {
    readonly userId: string;
    readonly displayName: string;
    readonly avatarUrl?: string;
    readonly rolesForUi: readonly string[];
    readonly tenantId?: string;
    readonly locale?: string;
    readonly featureFlags?: Readonly<Record<string, boolean>>;
    readonly sessionVersion?: string;
}
interface UserContextMessage extends MessageBase {
    readonly kind: 'user-context';
    readonly payload: UserContext;
}

export { type CommandMessage, type EventMessage, MessageBase, type QueryMessage, type UserContext, type UserContextMessage };
