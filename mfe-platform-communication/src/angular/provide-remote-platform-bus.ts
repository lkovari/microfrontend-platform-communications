import { makeEnvironmentProviders, type EnvironmentProviders } from '@angular/core';
import { isValidMfeBridgeHandle } from '../core/host-bridge.js';
import { BUS_TOKEN } from './provide-bus.js';

export interface RemotePlatformBusOptions {
  readonly accessToken?: string;
}

export function provideRemotePlatformBus(options?: RemotePlatformBusOptions): EnvironmentProviders {
  return makeEnvironmentProviders([
    {
      provide: BUS_TOKEN,
      useFactory: () => {
        if (typeof window === 'undefined') {
          throw new Error(
            'provideRemotePlatformBus() requires a browser runtime with window.__MFE_BRIDGE__.',
          );
        }
        const bridge = window.__MFE_BRIDGE__;
        if (!isValidMfeBridgeHandle(bridge)) {
          throw new Error(
            'provideRemotePlatformBus() requires a valid window.__MFE_BRIDGE__ from the host. Ensure the host called createHostBridge() before loading this remote.',
          );
        }
        return bridge.getBus(options?.accessToken);
      },
    },
  ]);
}
