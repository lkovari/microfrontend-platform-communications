// src/core/dedupe.ts
function createDedupeGate(windowMs) {
  const seen = /* @__PURE__ */ new Map();
  function prune(nowMs) {
    for (const [id, t] of seen) {
      if (nowMs - t > windowMs) {
        seen.delete(id);
      }
    }
  }
  return {
    shouldDrop(messageId, nowMs) {
      prune(nowMs);
      if (seen.has(messageId)) {
        return true;
      }
      seen.set(messageId, nowMs);
      return false;
    }
  };
}

// src/core/dispatcher.ts
function createMessageQueue(mode) {
  const pending = [];
  let flushScheduled = false;
  function runFlush() {
    flushScheduled = false;
    while (pending.length > 0) {
      const next = pending.shift();
      if (next) {
        next();
      }
    }
  }
  return {
    enqueue(task) {
      pending.push(task);
      if (flushScheduled) {
        return;
      }
      flushScheduled = true;
      if (mode === "microtask") {
        queueMicrotask(runFlush);
      } else {
        runFlush();
      }
    }
  };
}

// src/core/errors.ts
var BusPolicyError = class extends Error {
  code;
  constructor(message, code = "unauthorized") {
    super(message);
    this.name = "BusPolicyError";
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
};
var BusValidationError = class extends Error {
  code;
  constructor(message, code = "validation") {
    super(message);
    this.name = "BusValidationError";
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
};

// src/core/policy.ts
function defaultSensitivityPolicy(message) {
  if (message.sensitivity === "restricted") {
    throw new BusPolicyError("restricted messages are not allowed on the bus", "unauthorized");
  }
}
function composePolicies(...policies) {
  return (message) => {
    for (const p of policies) {
      p(message);
    }
  };
}

// src/core/request-response.ts
var RequestResponseCoordinator = class {
  pendingByCausationId = /* @__PURE__ */ new Map();
  waitForResponse(causationId, timeoutMs) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingByCausationId.delete(causationId);
        reject(new BusValidationError("request timed out", "timeout"));
      }, timeoutMs);
      this.pendingByCausationId.set(causationId, {
        resolve,
        reject,
        timer
      });
    });
  }
  tryResolve(incoming) {
    if (!incoming.causationId) {
      return false;
    }
    const pending = this.pendingByCausationId.get(incoming.causationId);
    if (!pending) {
      return false;
    }
    clearTimeout(pending.timer);
    this.pendingByCausationId.delete(incoming.causationId);
    pending.resolve(incoming);
    return true;
  }
  dispose() {
    for (const p of this.pendingByCausationId.values()) {
      clearTimeout(p.timer);
      p.reject(new BusValidationError("bus disposed", "delivery"));
    }
    this.pendingByCausationId.clear();
  }
};

// src/core/bus.ts
var BUS_EVENT_TYPE = "@lkovari/microfrontend-platform-communication/message";
function assertIsoWithinTtl(occurredAtUtc, ttlMs) {
  const t = Date.parse(occurredAtUtc);
  if (Number.isNaN(t)) {
    throw new BusValidationError("invalid occurredAtUtc", "validation");
  }
  if (Date.now() - t > ttlMs) {
    throw new BusValidationError("message expired", "timeout");
  }
}
function createBus(options) {
  const defaultSubscriberId = options.defaultSubscriberId ?? options.appId;
  const target = new EventTarget();
  const queue = createMessageQueue(options.dispatch ?? "microtask");
  const dedupe = options.dedupe?.enabled === true ? createDedupeGate(options.dedupe.windowMs) : void 0;
  const rr = new RequestResponseCoordinator();
  const allowUnregistered = options.allowUnregisteredMessageNames === true;
  const ttlMs = options.messageTtlMs;
  const defaultPolicyOn = options.enableDefaultSensitivityPolicy ?? true;
  const policy = composePolicies(
    ...defaultPolicyOn ? [defaultSensitivityPolicy] : [],
    ...options.policy ? [options.policy] : []
  );
  const listenerRecords = [];
  const observeRecords = [];
  const beforeDeliverHooks = [];
  function validate(message) {
    const schema = options.validators[message.messageName];
    if (!schema) {
      if (!allowUnregistered) {
        throw new BusValidationError(`no validator registered for ${message.messageName}`, "validation");
      }
      return;
    }
    const parsed = schema.safeParse(message);
    if (!parsed.success) {
      throw new BusValidationError(parsed.error.message, "validation");
    }
  }
  function deliver(message) {
    const event = new CustomEvent(BUS_EVENT_TYPE, {
      detail: message,
      bubbles: false,
      cancelable: false
    });
    target.dispatchEvent(event);
  }
  function prepareSync(message) {
    if (ttlMs !== void 0) {
      assertIsoWithinTtl(message.occurredAtUtc, ttlMs);
    }
    validate(message);
    if (dedupe) {
      const now = Date.now();
      if (dedupe.shouldDrop(message.messageId, now)) {
        return false;
      }
    }
    policy(message);
    options.registry?.assertCanPublish(message);
    for (const hook of beforeDeliverHooks) {
      hook(message);
    }
    return true;
  }
  const bus = {
    appId: options.appId,
    publish(message) {
      try {
        if (!prepareSync(message)) {
          return;
        }
      } catch (err) {
        if (options.onDispatchError) {
          options.onDispatchError(err);
          return;
        }
        if (err instanceof Error) {
          throw err;
        }
        throw new BusValidationError("unknown publish failure", "unknown");
      }
      queue.enqueue(() => {
        deliver(message);
        rr.tryResolve(message);
      });
    },
    async request(message, timeoutMs = 5e3) {
      const wait = rr.waitForResponse(message.messageId, timeoutMs);
      bus.publish(message);
      const result = await wait;
      return result;
    },
    subscribe(messageName, handler, subscribeOptions) {
      const subscriberId = subscribeOptions?.subscriberId ?? defaultSubscriberId;
      options.registry?.assertCanSubscribe(messageName, subscriberId);
      const listener = (event) => {
        const ce = event;
        const detail = ce.detail;
        if (detail.messageName !== messageName) {
          return;
        }
        if (detail.target !== void 0 && detail.target !== subscriberId) {
          return;
        }
        void Promise.resolve(handler(detail)).catch(() => void 0);
      };
      target.addEventListener(BUS_EVENT_TYPE, listener);
      listenerRecords.push({ messageName, listener });
      return () => {
        target.removeEventListener(BUS_EVENT_TYPE, listener);
        const idx = listenerRecords.findIndex((r) => r.listener === listener);
        if (idx >= 0) {
          listenerRecords.splice(idx, 1);
        }
      };
    },
    observeAll(handler) {
      const listener = (event) => {
        const ce = event;
        handler(ce.detail);
      };
      target.addEventListener(BUS_EVENT_TYPE, listener);
      observeRecords.push({ listener });
      return () => {
        target.removeEventListener(BUS_EVENT_TYPE, listener);
        const idx = observeRecords.findIndex((r) => r.listener === listener);
        if (idx >= 0) {
          observeRecords.splice(idx, 1);
        }
      };
    },
    registerBeforeDeliver(handler) {
      beforeDeliverHooks.push(handler);
      return () => {
        const idx = beforeDeliverHooks.indexOf(handler);
        if (idx >= 0) {
          beforeDeliverHooks.splice(idx, 1);
        }
      };
    },
    dispose() {
      rr.dispose();
      for (const record of listenerRecords) {
        target.removeEventListener(BUS_EVENT_TYPE, record.listener);
      }
      listenerRecords.length = 0;
      for (const record of observeRecords) {
        target.removeEventListener(BUS_EVENT_TYPE, record.listener);
      }
      observeRecords.length = 0;
      beforeDeliverHooks.length = 0;
    }
  };
  return bus;
}

// src/core/state-sync.ts
function attachStateSync(bus, options) {
  if (!options.enabled) {
    return {
      getRevision: () => void 0,
      getSnapshot: () => void 0,
      dispose: () => void 0
    };
  }
  const strategy = options.conflictStrategy ?? "last-writer-wins";
  const revisions = new Map(
    options.initialRevisions ? Object.entries(options.initialRevisions) : []
  );
  const snapshots = new Map(
    options.initialSnapshots ? Object.entries(options.initialSnapshots) : []
  );
  function applyReplace(stateKey, incoming) {
    const currentRev = revisions.get(stateKey) ?? 0;
    const incomingRev = incoming.revision;
    if (strategy === "reject-if-stale" && incomingRev <= currentRev) {
      throw new BusValidationError("stale state revision", "delivery");
    }
    if (strategy === "custom" && options.customConflict) {
      const decision = options.customConflict({
        stateKey,
        incoming,
        currentRevision: currentRev,
        currentSnapshot: snapshots.get(stateKey)
      });
      if (decision === "reject") {
        throw new BusValidationError("state conflict rejected", "delivery");
      }
    }
    revisions.set(stateKey, incomingRev);
    snapshots.set(stateKey, incoming.payload);
  }
  function applyPatch(stateKey, incoming) {
    const prev = snapshots.get(stateKey) ?? {};
    const merged = { ...prev, ...incoming.payload };
    const synthetic = {
      ...incoming,
      operation: "replace",
      payload: merged
    };
    applyReplace(stateKey, synthetic);
  }
  const off = bus.registerBeforeDeliver((message) => {
    if (message.kind !== "state") {
      return;
    }
    const stateMessage = message;
    const key = stateMessage.stateKey;
    if (stateMessage.operation === "replace") {
      applyReplace(key, stateMessage);
      return;
    }
    if (stateMessage.operation === "patch") {
      applyPatch(key, stateMessage);
      return;
    }
    if (stateMessage.operation === "remove") {
      revisions.delete(key);
      snapshots.delete(key);
      return;
    }
    if (stateMessage.operation === "reset") {
      revisions.set(key, 0);
      snapshots.delete(key);
    }
  });
  return {
    getRevision: (stateKey) => revisions.get(stateKey),
    getSnapshot: (stateKey) => snapshots.get(stateKey),
    dispose: () => {
      off();
    }
  };
}

// src/core/host-bridge.ts
var MFE_BRIDGE_PROTOCOL_VERSION = 1;
function withGeneratedIds(message) {
  return {
    ...message,
    messageId: message.messageId || crypto.randomUUID(),
    correlationId: message.correlationId || crypto.randomUUID(),
    occurredAtUtc: message.occurredAtUtc || (/* @__PURE__ */ new Date()).toISOString()
  };
}
function toAckResult(correlationId, err) {
  const receivedAtUtc = (/* @__PURE__ */ new Date()).toISOString();
  if (err instanceof BusPolicyError) {
    return {
      ok: false,
      correlationId,
      errorCode: err.code,
      message: err.message,
      receivedAtUtc
    };
  }
  if (err instanceof BusValidationError) {
    return {
      ok: false,
      correlationId,
      errorCode: err.code,
      message: err.message,
      receivedAtUtc
    };
  }
  return {
    ok: false,
    correlationId,
    errorCode: "unknown",
    message: err instanceof Error ? err.message : "unknown error",
    receivedAtUtc
  };
}
function createHostBridge(options) {
  let stateCoordinator;
  if (options.stateSync) {
    stateCoordinator = attachStateSync(options.bus, options.stateSync);
  }
  const handle = {
    protocolVersion: MFE_BRIDGE_PROTOCOL_VERSION,
    appId: options.appId,
    remotes: options.remotes,
    getBus: () => options.bus,
    tryPublish: (message) => {
      const correlationId = message.correlationId || crypto.randomUUID();
      try {
        const normalized = withGeneratedIds({
          ...message,
          correlationId
        });
        options.bus.publish(normalized);
        return {
          ok: true,
          correlationId: normalized.correlationId,
          receivedAtUtc: (/* @__PURE__ */ new Date()).toISOString()
        };
      } catch (err) {
        return toAckResult(correlationId, err);
      }
    },
    dispose: () => {
      stateCoordinator?.dispose();
      if (typeof window !== "undefined" && window.__MFE_BRIDGE__ === handle) {
        delete window.__MFE_BRIDGE__;
      }
    }
  };
  if (typeof window !== "undefined") {
    window.__MFE_BRIDGE__ = handle;
  }
  return handle;
}

export { BusPolicyError, BusValidationError, MFE_BRIDGE_PROTOCOL_VERSION, RequestResponseCoordinator, attachStateSync, composePolicies, createBus, createDedupeGate, createHostBridge, createMessageQueue, defaultSensitivityPolicy };
//# sourceMappingURL=chunk-X57D7T3Z.js.map
//# sourceMappingURL=chunk-X57D7T3Z.js.map