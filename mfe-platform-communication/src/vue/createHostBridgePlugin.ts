import type { App, InjectionKey } from 'vue';
import type { CreateHostBridgeOptions } from '../core/host-bridge.js';
import { createHostBridge, type MfeBridgeHandle } from '../core/host-bridge.js';
import { getBusForApp } from './internal-app-bus.js';

export const HostBridgeKey: InjectionKey<MfeBridgeHandle> = Symbol(
  '@lkovari/microfrontend-platform-communication/host-bridge',
);

export function createHostBridgePlugin(options: Omit<CreateHostBridgeOptions, 'bus' | 'appId'>) {
  return {
    install(app: App) {
      const bus = getBusForApp(app);
      if (!bus) {
        throw new Error('createBusPlugin must be installed before createHostBridgePlugin');
      }
      const bridge = createHostBridge({
        appId: bus.appId,
        bus,
        remotes: options.remotes,
        ...(options.stateSync ? { stateSync: options.stateSync } : {}),
        ...(options.onConflict ? { onConflict: options.onConflict } : {}),
      });
      app.provide(HostBridgeKey, bridge);
    },
  };
}
