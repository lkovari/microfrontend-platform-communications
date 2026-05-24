import { useEffect, useRef } from 'react';
import type { MessageBase } from '../contracts/message-base.js';
import type { BusSubscribeOptions } from '../core/bus.js';
import { useBus } from './useBus.js';

export function useSubscribe(
  messageName: string,
  handler: (message: MessageBase) => void | Promise<void>,
  subscribeOptions?: BusSubscribeOptions,
): void {
  const bus = useBus();
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const off = bus.subscribe(
      messageName,
      (message) => handlerRef.current(message),
      subscribeOptions,
    );
    return () => {
      off();
    };
  }, [bus, messageName, subscribeOptions?.subscriberId]);
}
