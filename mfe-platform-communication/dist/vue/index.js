import { createBus, createHostBridge } from '../chunk-X57D7T3Z.js';
import '../chunk-EUXUH3YW.js';
import { inject, onUnmounted } from 'vue';

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
      const bus = createBus(options);
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
      const bridge = createHostBridge({
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
  const bus = inject(BusKey);
  if (!bus) {
    throw new Error("useBus must be used after createBusPlugin");
  }
  return bus;
}
function useSubscribe(messageName, handler, subscribeOptions) {
  const bus = useBus();
  const off = bus.subscribe(messageName, handler, subscribeOptions);
  onUnmounted(() => {
    off();
  });
}

export { BusKey, HostBridgeKey, createBusPlugin, createHostBridgePlugin, useBus, useSubscribe };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map