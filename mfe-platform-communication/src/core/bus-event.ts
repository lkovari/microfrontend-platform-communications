import type { MessageBase } from '../contracts/message-base.js';
import { MessageBaseSchema } from '../schemas/message-base.schema.js';

const BusEventDetailSchema = MessageBaseSchema.passthrough();

export function readBusMessageFromEvent(event: Event): MessageBase | null {
  if (!(event instanceof CustomEvent)) {
    return null;
  }
  const parsed = BusEventDetailSchema.safeParse(event.detail);
  if (!parsed.success) {
    return null;
  }
  return parsed.data;
}
