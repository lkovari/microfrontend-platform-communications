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
