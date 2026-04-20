'use strict';

var chunkYZPRVI4W_cjs = require('../chunk-YZPRVI4W.cjs');
require('../chunk-ZBDE64SD.cjs');
var react = require('react');
var jsxRuntime = require('react/jsx-runtime');

var BusContext = react.createContext(null);
function BusProvider(props) {
  const { children, ...opts } = props;
  const busRef = react.useRef(null);
  busRef.current ??= chunkYZPRVI4W_cjs.createBus(opts);
  return /* @__PURE__ */ jsxRuntime.jsx(BusContext.Provider, { value: busRef.current, children });
}
function useBus() {
  const bus = react.useContext(BusContext);
  if (!bus) {
    throw new Error("useBus must be used within BusProvider");
  }
  return bus;
}

// src/react/HostBridgeProvider.tsx
function HostBridgeProvider(props) {
  const bus = useBus();
  const bridgeRef = react.useRef(null);
  react.useEffect(() => {
    bridgeRef.current = chunkYZPRVI4W_cjs.createHostBridge({
      appId: bus.appId,
      bus,
      remotes: props.remotes,
      ...props.stateSync ? { stateSync: props.stateSync } : {}
    });
    return () => {
      bridgeRef.current?.dispose();
      bridgeRef.current = null;
    };
  }, [bus, props.remotes, props.stateSync]);
  return props.children;
}
function useSubscribe(messageName, handler, subscribeOptions) {
  const bus = useBus();
  react.useEffect(() => {
    const off = bus.subscribe(messageName, handler, subscribeOptions);
    return () => {
      off();
    };
  }, [bus, messageName, handler, subscribeOptions?.subscriberId]);
}
function usePublish() {
  const bus = useBus();
  return react.useCallback(
    (message) => {
      bus.publish(message);
    },
    [bus]
  );
}

exports.BusContext = BusContext;
exports.BusProvider = BusProvider;
exports.HostBridgeProvider = HostBridgeProvider;
exports.useBus = useBus;
exports.usePublish = usePublish;
exports.useSubscribe = useSubscribe;
//# sourceMappingURL=index.cjs.map
//# sourceMappingURL=index.cjs.map