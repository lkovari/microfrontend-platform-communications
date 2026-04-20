import { useEffect, useRef, type ReactNode } from 'react';
import type { StateSyncAttachOptions } from '../core/state-sync.js';
import { createHostBridge, type MfeBridgeHandle } from '../core/host-bridge.js';
import { useBus } from './useBus.js';

export function HostBridgeProvider(props: {
  readonly remotes: readonly string[];
  readonly stateSync?: StateSyncAttachOptions;
  readonly children: ReactNode;
}) {
  const bus = useBus();
  const bridgeRef = useRef<MfeBridgeHandle | null>(null);

  useEffect(() => {
    bridgeRef.current = createHostBridge({
      appId: bus.appId,
      bus,
      remotes: props.remotes,
      ...(props.stateSync ? { stateSync: props.stateSync } : {}),
    });
    return () => {
      bridgeRef.current?.dispose();
      bridgeRef.current = null;
    };
  }, [bus, props.remotes, props.stateSync]);

  return props.children;
}
