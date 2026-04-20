'use strict';

var chunkYZPRVI4W_cjs = require('./chunk-YZPRVI4W.cjs');
var chunkZBDE64SD_cjs = require('./chunk-ZBDE64SD.cjs');
var core = require('@angular/core');
var rxjs = require('rxjs');

var BUS_TOKEN = new core.InjectionToken("@lkovari/microfrontend-platform-communication/bus");
function provideBus(options) {
  return core.makeEnvironmentProviders([
    {
      provide: BUS_TOKEN,
      useFactory: () => chunkYZPRVI4W_cjs.createBus(options)
    }
  ]);
}
function injectBus() {
  return core.inject(BUS_TOKEN);
}
var HOST_BRIDGE_TOKEN = new core.InjectionToken(
  "@lkovari/microfrontend-platform-communication/host-bridge"
);
function provideHostBridge(options) {
  return core.makeEnvironmentProviders([
    {
      provide: HOST_BRIDGE_TOKEN,
      useFactory: () => {
        const bus = core.inject(BUS_TOKEN);
        return chunkYZPRVI4W_cjs.createHostBridge({
          appId: bus.appId,
          bus,
          remotes: options.remotes,
          ...options.stateSync ? { stateSync: options.stateSync } : {}
        });
      }
    }
  ]);
}
exports.BusService = class BusService {
  bus = core.inject(BUS_TOKEN);
  publish(message) {
    this.bus.publish(message);
  }
  request(message, timeoutMs) {
    return this.bus.request(message, timeoutMs);
  }
  messages$(messageName, subscribeOptions) {
    return new rxjs.Observable((subscriber) => {
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
exports.BusService = chunkZBDE64SD_cjs.__decorateClass([
  core.Injectable({ providedIn: "root" })
], exports.BusService);
exports.HostBridgeService = class HostBridgeService {
  bridge = core.inject(HOST_BRIDGE_TOKEN);
  tryPublish(message) {
    return this.bridge.tryPublish(message);
  }
  getBus() {
    return this.bridge.getBus();
  }
};
exports.HostBridgeService = chunkZBDE64SD_cjs.__decorateClass([
  core.Injectable({ providedIn: "root" })
], exports.HostBridgeService);

exports.BUS_TOKEN = BUS_TOKEN;
exports.HOST_BRIDGE_TOKEN = HOST_BRIDGE_TOKEN;
exports.injectBus = injectBus;
exports.provideBus = provideBus;
exports.provideHostBridge = provideHostBridge;
//# sourceMappingURL=chunk-CDZPW6UF.cjs.map
//# sourceMappingURL=chunk-CDZPW6UF.cjs.map