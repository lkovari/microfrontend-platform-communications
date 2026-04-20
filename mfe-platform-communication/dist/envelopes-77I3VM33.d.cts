interface Ack {
    readonly ok: true;
    readonly correlationId: string;
    readonly receivedAtUtc: string;
}
type BusErrorCode = 'validation' | 'unauthorized' | 'incompatible-version' | 'delivery' | 'timeout' | 'dedupe' | 'unknown';
interface Nack {
    readonly ok: false;
    readonly correlationId: string;
    readonly errorCode: BusErrorCode;
    readonly message: string;
    readonly receivedAtUtc: string;
}
type AckResult = Ack | Nack;

export type { Ack as A, BusErrorCode as B, Nack as N, AckResult as a };
