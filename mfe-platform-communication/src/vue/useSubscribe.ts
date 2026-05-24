import { onMounted, onUnmounted } from 'vue';
import type { MessageBase } from '../contracts/message-base.js';
import type { BusSubscribeOptions } from '../core/bus.js';
import { useBus } from './useBus.js';

export function useSubscribe(
  messageName: string,
  handler: (message: MessageBase) => void | Promise<void>,
  subscribeOptions?: BusSubscribeOptions,
): void {
  const bus = useBus();
  let off: (() => void) | undefined;
  onMounted(() => {
    off = bus.subscribe(messageName, handler, subscribeOptions);
  });
  onUnmounted(() => {
    off?.();
  });
}
