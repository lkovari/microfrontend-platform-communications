export type MessageKind = 'event' | 'command' | 'query' | 'state' | 'user-context';
export type Sensitivity = 'public' | 'internal' | 'restricted';

export interface ValidationDescriptor {
  readonly required?: readonly string[];
  readonly min?: Readonly<Record<string, number>>;
  readonly max?: Readonly<Record<string, number>>;
}

export interface MessageBase {
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
