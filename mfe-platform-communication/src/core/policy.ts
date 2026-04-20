import type { MessageBase } from '../contracts/message-base.js';
import { BusPolicyError } from './errors.js';

export function defaultSensitivityPolicy(message: MessageBase): void {
  if (message.sensitivity === 'restricted') {
    throw new BusPolicyError('restricted messages are not allowed on the bus', 'unauthorized');
  }
}

export function composePolicies(
  ...policies: ((message: MessageBase) => void)[]
): (message: MessageBase) => void {
  return (message: MessageBase) => {
    for (const p of policies) {
      p(message);
    }
  };
}
