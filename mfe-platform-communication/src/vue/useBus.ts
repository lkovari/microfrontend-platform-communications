import { inject } from 'vue';
import type { Bus } from '../core/bus.js';
import { BusKey } from './createBusPlugin.js';

export function useBus(): Bus {
  const bus = inject(BusKey);
  if (!bus) {
    throw new Error('useBus must be used after createBusPlugin');
  }
  return bus;
}
