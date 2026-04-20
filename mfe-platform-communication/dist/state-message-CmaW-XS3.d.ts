type MessageKind = 'event' | 'command' | 'query' | 'state' | 'user-context';
type Sensitivity = 'public' | 'internal' | 'restricted';
interface ValidationDescriptor {
    readonly required?: readonly string[];
    readonly min?: Readonly<Record<string, number>>;
    readonly max?: Readonly<Record<string, number>>;
}
interface MessageBase {
    readonly messageName: string;
    readonly messageVersion: number;
    readonly messageId: string;
    readonly correlationId: string;
    readonly causationId?: string;
    readonly source: string;
    readonly target?: string;
    readonly occurredAtUtc: string;
    readonly kind: MessageKind;
    readonly sensitivity: Sensitivity;
    readonly validationDescriptor?: ValidationDescriptor;
}

type StateOperation = 'replace' | 'patch' | 'remove' | 'reset';
interface StateMessage<TState = unknown> extends MessageBase {
    readonly kind: 'state';
    readonly stateKey: string;
    readonly operation: StateOperation;
    readonly revision: number;
    readonly payload: TState;
}

export type { MessageBase as M, Sensitivity as S, ValidationDescriptor as V, MessageKind as a, StateMessage as b, StateOperation as c };
