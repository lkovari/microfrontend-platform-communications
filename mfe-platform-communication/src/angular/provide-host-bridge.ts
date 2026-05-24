import {
  DestroyRef,
  inject,
  InjectionToken,
  makeEnvironmentProviders,
  type EnvironmentProviders,
} from '@angular/core';
import type { CreateHostBridgeOptions } from '../core/host-bridge.js';
import { createHostBridge, type MfeBridgeHandle } from '../core/host-bridge.js';
import { BUS_TOKEN } from './provide-bus.js';

export const HOST_BRIDGE_TOKEN = new InjectionToken<MfeBridgeHandle>(
  '@lkovari/microfrontend-platform-communication/host-bridge',
);

export function provideHostBridge(
  options: Omit<CreateHostBridgeOptions, 'bus' | 'appId'>,
): EnvironmentProviders {
  return makeEnvironmentProviders([
    {
      provide: HOST_BRIDGE_TOKEN,
      useFactory: () => {
        const bus = inject(BUS_TOKEN);
        const bridge = createHostBridge({
          appId: bus.appId,
          bus,
          remotes: options.remotes,
          ...(options.stateSync ? { stateSync: options.stateSync } : {}),
          ...(options.onConflict ? { onConflict: options.onConflict } : {}),
        });
        const destroyRef = inject(DestroyRef);
        destroyRef.onDestroy(() => {
          bridge.dispose();
        });
        return bridge;
      },
    },
  ]);
}

export function injectHostBridge(): MfeBridgeHandle {
  return inject(HOST_BRIDGE_TOKEN);
}
