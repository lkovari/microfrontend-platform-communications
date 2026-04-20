export interface Ack {
  readonly ok: true;
  readonly correlationId: string;
  readonly receivedAtUtc: string;
}

export type BusErrorCode =
  | 'validation'
  | 'unauthorized'
  | 'incompatible-version'
  | 'delivery'
  | 'timeout'
  | 'dedupe'
  | 'unknown';

export interface Nack {
  readonly ok: false;
  readonly correlationId: string;
  readonly errorCode: BusErrorCode;
  readonly message: string;
  readonly receivedAtUtc: string;
}

export type AckResult = Ack | Nack;
