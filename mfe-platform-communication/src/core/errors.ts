import type { BusErrorCode } from '../contracts/envelopes.js';

export class BusPolicyError extends Error {
  readonly code: BusErrorCode;

  constructor(message: string, code: BusErrorCode = 'unauthorized') {
    super(message);
    this.name = 'BusPolicyError';
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class BusValidationError extends Error {
  readonly code: BusErrorCode;

  constructor(message: string, code: BusErrorCode = 'validation') {
    super(message);
    this.name = 'BusValidationError';
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export type HostBridgeErrorCode = 'conflict' | 'invalid-global' | 'mismatch' | 'unauthorized';

export class HostBridgeError extends Error {
  readonly code: HostBridgeErrorCode;

  constructor(message: string, code: HostBridgeErrorCode = 'conflict') {
    super(message);
    this.name = 'HostBridgeError';
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
