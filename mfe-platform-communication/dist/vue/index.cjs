'use strict';

var chunkYZPRVI4W_cjs = require('../chunk-YZPRVI4W.cjs');
require('../chunk-ZBDE64SD.cjs');
var vue = require('vue');

// src/vue/internal-app-bus.ts
var busByApp = /* @__PURE__ */ new WeakMap();
function rememberBusForApp(app, bus) {
  busByApp.set(app, bus);
}
function getBusForApp(app) {
  return busByApp.get(app);
}

// src/vue/createBusPlugin.ts
var BusKey = /* @__PURE__ */ Symbol("@lkovari/microfrontend-platform-communication/bus");
function createBusPlugin(options) {
  return {
    install(app) {
      const bus = chunkYZPRVI4W_cjs.createBus(options);
      app.provide(BusKey, bus);
      rememberBusForApp(app, bus);
    }
  };
}

// src/vue/createHostBridgePlugin.ts
var HostBridgeKey = /* @__PURE__ */ Symbol(
  "@lkovari/microfrontend-platform-communication/host-bridge"
);
function createHostBridgePlugin(options) {
  return {
    install(app) {
      const bus = getBusForApp(app);
      if (!bus) {
        throw new Error("createBusPlugin must be installed before createHostBridgePlugin");
      }
      const bridge = chunkYZPRVI4W_cjs.createHostBridge({
        appId: bus.appId,
        bus,
        remotes: options.remotes,
        ...options.stateSync ? { stateSync: options.stateSync } : {}
      });
      app.provide(HostBridgeKey, bridge);
    }
  };
}
function useBus() {
  const bus = vue.inject(BusKey);
  if (!bus) {
    throw new Error("useBus must be used after createBusPlugin");
  }
  return bus;
}
function useSubscribe(messageName, handler, subscribeOptions) {
  const bus = useBus();
  const off = bus.subscribe(messageName, handler, subscribeOptions);
  vue.onUnmounted(() => {
    off();
  });
}

exports.BusKey = BusKey;
exports.HostBridgeKey = HostBridgeKey;
exports.createBusPlugin = createBusPlugin;
exports.createHostBridgePlugin = createHostBridgePlugin;
exports.useBus = useBus;
exports.useSubscribe = useSubscribe;
//# sourceMappingURL=index.cjs.map
//# sourceMappingURL=index.cjs.map