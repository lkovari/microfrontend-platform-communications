import { useCallback } from 'react';
import type { MessageBase } from '../contracts/message-base.js';
import { useBus } from './useBus.js';

export function usePublish(): <M extends MessageBase>(message: M) => void {
  const bus = useBus();
  return useCallback(
    <M extends MessageBase>(message: M) => {
      bus.publish(message);
    },
    [bus],
  );
}
