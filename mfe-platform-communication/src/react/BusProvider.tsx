import { useRef, type ReactNode } from 'react';
import type { CreateBusOptions } from '../core/bus.js';
import { createBus } from '../core/bus.js';
import { BusContext } from './BusContext.js';

export type BusProviderProps = CreateBusOptions & {
  readonly children: ReactNode;
};

export function BusProvider(props: BusProviderProps) {
  const { children, ...opts } = props;
  const busRef = useRef<ReturnType<typeof createBus> | null>(null);
  busRef.current ??= createBus(opts);
  return <BusContext.Provider value={busRef.current}>{children}</BusContext.Provider>;
}
