import { createBus, createHostBridge } from '../chunk-X57D7T3Z.js';
import '../chunk-EUXUH3YW.js';
import { createContext, useRef, useContext, useEffect, useCallback } from 'react';
import { jsx } from 'react/jsx-runtime';

var BusContext = createContext(null);
function BusProvider(props) {
  const { children, ...opts } = props;
  const busRef = useRef(null);
  busRef.current ??= createBus(opts);
  return /* @__PURE__ */ jsx(BusContext.Provider, { value: busRef.current, children });
}
function useBus() {
  const bus = useContext(BusContext);
  if (!bus) {
    throw new Error("useBus must be used within BusProvider");
  }
  return bus;
}

// src/react/HostBridgeProvider.tsx
function HostBridgeProvider(props) {
  const bus = useBus();
  const bridgeRef = useRef(null);
  useEffect(() => {
    bridgeRef.current = createHostBridge({
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
  useEffect(() => {
    const off = bus.subscribe(messageName, handler, subscribeOptions);
    return () => {
      off();
    };
  }, [bus, messageName, handler, subscribeOptions?.subscriberId]);
}
function usePublish() {
  const bus = useBus();
  return useCallback(
    (message) => {
      bus.publish(message);
    },
    [bus]
  );
}

export { BusContext, BusProvider, HostBridgeProvider, useBus, usePublish, useSubscribe };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map