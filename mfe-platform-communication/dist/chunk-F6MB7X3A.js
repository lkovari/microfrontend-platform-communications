import { createBus, createHostBridge } from './chunk-X57D7T3Z.js';
import { __decorateClass } from './chunk-EUXUH3YW.js';
import { InjectionToken, Injectable, inject, makeEnvironmentProviders } from '@angular/core';
import { Observable } from 'rxjs';

var BUS_TOKEN = new InjectionToken("@lkovari/microfrontend-platform-communication/bus");
function provideBus(options) {
  return makeEnvironmentProviders([
    {
      provide: BUS_TOKEN,
      useFactory: () => createBus(options)
    }
  ]);
}
function injectBus() {
  return inject(BUS_TOKEN);
}
var HOST_BRIDGE_TOKEN = new InjectionToken(
  "@lkovari/microfrontend-platform-communication/host-bridge"
);
function provideHostBridge(options) {
  return makeEnvironmentProviders([
    {
      provide: HOST_BRIDGE_TOKEN,
      useFactory: () => {
        const bus = inject(BUS_TOKEN);
        return createHostBridge({
          appId: bus.appId,
          bus,
          remotes: options.remotes,
          ...options.stateSync ? { stateSync: options.stateSync } : {}
        });
      }
    }
  ]);
}
var BusService = class {
  bus = inject(BUS_TOKEN);
  publish(message) {
    this.bus.publish(message);
  }
  request(message, timeoutMs) {
    return this.bus.request(message, timeoutMs);
  }
  messages$(messageName, subscribeOptions) {
    return new Observable((subscriber) => {
      const off = this.bus.subscribe(
        messageName,
        (m) => {
          subscriber.next(m);
        },
        subscribeOptions
      );
      return () => {
        off();
      };
    });
  }
};
BusService = __decorateClass([
  Injectable({ providedIn: "root" })
], BusService);
var HostBridgeService = class {
  bridge = inject(HOST_BRIDGE_TOKEN);
  tryPublish(message) {
    return this.bridge.tryPublish(message);
  }
  getBus() {
    return this.bridge.getBus();
  }
};
HostBridgeService = __decorateClass([
  Injectable({ providedIn: "root" })
], HostBridgeService);

export { BUS_TOKEN, BusService, HOST_BRIDGE_TOKEN, HostBridgeService, injectBus, provideBus, provideHostBridge };
//# sourceMappingURL=chunk-F6MB7X3A.js.map
//# sourceMappingURL=chunk-F6MB7X3A.js.map