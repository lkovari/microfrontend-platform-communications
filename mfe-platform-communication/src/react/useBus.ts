import { useContext } from 'react';
import type { Bus } from '../core/bus.js';
import { BusContext } from './BusContext.js';

export function useBus(): Bus {
  const bus = useContext(BusContext);
  if (!bus) {
    throw new Error('useBus must be used within BusProvider');
  }
  return bus;
}
