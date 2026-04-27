import { useEffect, useRef, type ReactNode } from 'react';
import type { HostBridgeConflictPolicy } from '../core/host-bridge.js';
import type { StateSyncAttachOptions } from '../core/state-sync.js';
import { createHostBridge, type MfeBridgeHandle } from '../core/host-bridge.js';
import { useBus } from './useBus.js';

export function HostBridgeProvider(props: {
  readonly remotes: readonly string[];
  readonly stateSync?: StateSyncAttachOptions;
  readonly onConflict?: HostBridgeConflictPolicy;
  readonly children: ReactNode;
}) {
  const bus = useBus();
  const bridgeRef = useRef<MfeBridgeHandle | null>(null);
  const remotesKey = JSON.stringify(props.remotes);

  useEffect(() => {
    bridgeRef.current = createHostBridge({
      appId: bus.appId,
      bus,
      remotes: props.remotes,
      ...(props.stateSync ? { stateSync: props.stateSync } : {}),
      ...(props.onConflict ? { onConflict: props.onConflict } : {}),
    });
    return () => {
      bridgeRef.current?.dispose();
      bridgeRef.current = null;
    };
  }, [bus, remotesKey, props.stateSync, props.onConflict]);

  return props.children;
}
