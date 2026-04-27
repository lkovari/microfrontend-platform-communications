# @lkovari/microfrontend-platform-communication current status is a PoC.

The publishable package lives in [`mfe-platform-communication/`](mfe-platform-communication/) as `@lkovari/microfrontend-platform-communication
(https://www.npmjs.com/package/@lkovari/microfrontend-platform-communication)

# WARNING!
In the current version of the library, I basically put in everything that came to my mind — from the simplest stuff to more complex features — and we’ll refine it later.

# TODO list

## Security Privacy
Security and Privacy: Prioritize the protection of sensitive data by implementing robust security measures to prevent unauthorized access. Adhere to best practices in data sharing to maintain the confidentiality and privacy of user information. Safety and privacy should always be at the forefront of your data communication strategy.

# @lkovari/microfrontend-platform-communication

This library is framework-agnostic solution for messaging between microfrontends (Angular, React, Vue).
It use host-orchestrated communication model. Runtime bus is based on browser EventTarget and CustomEvent,
wrapped with typed API. Contracts are simple TypeScript types and validation is done by Zod on bus boundary.

## Topology

Microfrontends (remotes) are not communicate directly with each other.
All messages go through Host (Shell Bus).

```text
                             typed messages
 Remote A  ──────────────────────────────►  ┌────────────────────────────┐
                                             │ Host / Shell Bus           │
                             typed messages  │ + Host Bridge              │
 Remote B  ──────────────────────────────►  │ + Policy                   │
                                             │ + State sync               │
                             typed messages  │                            │
 Remote C  ──────────────────────────────►  └─────────────┬──────────────┘
                                                         │
                                                         ▼
                                                ┌──────────────────────────────────────┐
                                                │ Backend / BFF (optional, e.g. NestJS)│
                                                └──────────────────────────────────────┘
```

**Remotes → Host**

```text
Remote A ---> Host Bus
Remote B ---> Host Bus
Remote C ---> Host Bus
```

**Remote → Remote (only via Host; no direct remote-to-remote)**

```text
Remote A ---> Host Bus <--- Remote B
Remote C ---> Host Bus
```

**Host → Remotes (simplified)**

```text
Host Bus ---> Remote A
Host Bus ---> Remote B
Host Bus ---> Remote C
```

Host may also connect to Backend / BFF (optional, e.g. NestJS).

One shared bus instance exist, exposed via window.__MFE_BRIDGE__.

Important:
- Remote-to-remote communication also go via Host
- Separate createBus() instances cannot see each other events

## Install

pnpm add @lkovari/microfrontend-platform-communication zod

Optional peer dependencies:
- @angular/core
- react
- rxjs
- vue

## Entry points

- root package: contracts, schemas, core, Angular adapter
- /contracts: only types
- /schemas: Zod validation schemas
- /core: createBus, createHostBridge, policy, registry, state sync
- /angular: Angular providers and service
- /react: React providers and hooks
- /vue: Vue plugins and composables

Note:
React and Vue hooks are NOT exported from root, must import from /react or /vue.

## Quick usage

Host side:

Create bus with validators, then create bridge.

Example:

const bus = createBus({
  appId: 'shell-host',
  dispatch: 'microtask',
  dedupe: { enabled: true, windowMs: 5000 },
  validators: {
    'orders:filters-changed': EventMessageSchema,
  },
});

createHostBridge({
  appId: 'shell-host',
  bus,
  remotes: ['remote-orders', 'remote-profile'],
  stateSync: { enabled: true, initialRevisions: { person: 0 } },
});

Remote side:

Get bus from global bridge:

const bridge = window.__MFE_BRIDGE__;
const bus = bridge.getBus();

Subscribe:

bus.subscribe(
  'person:updated',
  (msg) => console.log(msg.payload),
  { subscriberId: 'remote-profile' },
);

Publishing:

Use bridge.tryPublish(message)
Host will fill missing metadata like:
- messageId
- correlationId
- occurredAtUtc

Also return Ack / Nack result.

## Message kinds (`MessageKind`)

The sections **`event`** through **`user-context`** below are the kinds implemented in code. See also **[Possible future kinds (not in code)](#possible-future-kinds-not-in-code)** for ideas not in `MessageKind` today.

Every message has a `kind` field that classifies how the bus and host should treat it. All kinds share the same base envelope (`messageName`, `messageVersion`, `messageId`, `correlationId`, optional `causationId`, `source`, optional `target`, `occurredAtUtc`, `sensitivity`, optional `validationDescriptor`). Zod schemas live under `/schemas`; TypeScript contracts under `/contracts`.

### `event`

Fire-and-forget notifications: something already happened and subscribers may react. There is no built-in reply channel; use `correlationId` / separate messages if you need follow-up traffic.

| Field | Role |
| --- | --- |
| `eventKind` | Non-empty string sub-type of the event (e.g. domain-specific label alongside `messageName`). |
| `payload` | Arbitrary data for subscribers. |

Typical uses: filters changed, navigation completed, feature flags updated, remote readiness signals.

### `command`

An imperative action the host or another participant should perform. Commands often imply acknowledgement semantics at the bridge layer (see host bridge / policy); the contract includes an optional timeout for waiting on that acknowledgement. (I don't know this will be real usage or not currently)

| Field | Role |
| --- | --- |
| `commandName` | Non-empty string naming the command. |
| `payload` | Arguments for the handler. |
| `ackTimeoutMs` | Optional positive integer: how long to wait for an ack, in milliseconds. |

Typical uses: request navigation, trigger a host-side operation, ask another remote to refresh.

### `query`

A request for information that expects a result shape. The contract allows naming the query, passing input `payload`, and optionally describing or bounding the response and wait time. (I don't know this will be real usage or not currently)

| Field | Role |
| --- | --- |
| `queryName` | Non-empty string naming the query. |
| `payload` | Input to the query. |
| `expectedResult` | Optional string hint (e.g. result type or schema id) for validators or routing. |
| `timeoutMs` | Optional positive integer: how long to wait for a result. |

Typical uses: read shared UI or host state without mutating it, resolve a capability or configuration snapshot.

### `state`

Synchronized shared state under a key, with explicit revisions and an operation that says how to apply the payload. Host bridge state sync is aligned with this model when enabled.

| Field | Role |
| --- | --- |
| `stateKey` | Non-empty string identifying the state slice (e.g. `person`, domain entity). |
| `operation` | One of `replace`, `patch`, `remove`, `reset` (see below). |
| `revision` | Non-negative integer; monotonic per `stateKey` for optimistic concurrency and ordering. |
| `payload` | The state value or delta, depending on operation and convention. |

**State operations**

| Operation | Meaning |
| --- | --- |
| `replace` | Substitute the entire value for `stateKey` with `payload`. |
| `patch` | Apply a partial update; `payload` is typically a merge or JSON-patch style delta (by convention). |
| `remove` | Drop the value for `stateKey` (payload may be empty or carry metadata). |
| `reset` | Restore initial or default state for that key. |

Typical uses: shared entity snapshot across remotes, host-managed session-scoped data with revision checks.

### `user-context`

A dedicated kind for the signed-in user’s **non-sensitive** display and routing context. The payload is structured (`UserContext`), not an unconstrained blob: user id, display name, optional avatar, UI roles, optional tenant, locale, feature flags, optional session version string.

Typical uses: broadcast after login, tenant or locale switch, role changes that affect UI only. Tokens and authorization matrices still belong on the server; this kind is for coordination and display alignment across microfrontends.

## Possible future kinds (not in code)

These values are **not** part of `MessageKind` in this repository; they are suggestions only. Teams sometimes model similar ideas on top of `event`, `command`, or `query`, or keep a separate enum outside the bus contracts:

| Kind (hypothetical) | Why it might exist |
| --- | --- |
| `notification` | User-visible alerts (toast, banner) with severity, deduplication id, and optional action ids—distinct from domain `event` noise. |
| `error` | Standardized failure envelope (code, message, retryable flag) for correlated replies instead of ad hoc error shapes in payloads. |
| `lifecycle` | Explicit mount/unmount, activation, or route-attached scope for a remote (host orchestration). |
| `capability` | Advertise or negotiate features, versions, or message names a remote supports (discovery). |
| `heartbeat` | Cheap periodic liveness or SLA probes, possibly with stricter TTL than generic events. |
| `dead-letter` | Move undeliverable or invalid messages to an auditable channel for tooling. |

Adding a new kind would require updating `MessageKind`, the corresponding Zod schemas, host bridge policy, and documentation together.

## Message categories

Auth:
- auth:login-completed
- auth:logout-completed
- session:expired

User:
- user:context-updated
- roles:changed

Navigation:
- navigation:requested
- navigation:completed

Cross-app:
- tenant:changed
- person:updated
- orders:filters-changed

Runtime:
- feature-flags:updated
- runtime:manifest-updated

Invalidation:
- cache:invalidated
- refresh-requested

Health:
- remote:ready
- remote:failed
- telemetry:event

## Security model

Important rule:
Do NOT send sensitive data via bus.

Allowed:
- names
- tenant
- locale
- UI roles (only for display)
- feature flags

Not allowed:
- access tokens
- refresh tokens
- full claims
- permission matrix

Backend is ALWAYS source of truth.

## Three types of state

1. Server state (truth)
2. Client cached state
3. UI derived state

Bus is only for coordination, NOT replace API or security.

## When to use

Good fit:
- multiple frameworks
- independent remotes
- backend-driven security
- low coupling

Not enough alone for:
- guaranteed delivery
- complex orchestration
- weak contract discipline teams

## Design summary

- Single package with subpath exports
- Contracts define message structure
- Zod validate messages
- Core handle policy, dedupe, TTL, correlation
- Host control routing (target vs broadcast)
- Restricted messages blocked by default

## Adapter examples

Angular:
- provideBus
- provideHostBridge
- BusService.messages$('person:updated')

React:
- BusProvider
- HostBridgeProvider
- useSubscribe()

Vue:
- createBusPlugin
- createHostBridgePlugin
- useSubscribe()

## Examples workspace

examples/ folder contain demo:
- shell
- Angular remote
- React remote
- Vue remote

It show:
- person:updated
- orders:filters-changed

Not required for usage.

## Issues 1-19 updates (what changed and why)

1. Adapter `onConflict` forwarding: Angular/React/Vue now pass `onConflict` to `createHostBridge`; purpose is consistent bridge conflict behavior across frameworks.
2. Strict request matching: `request()` now resolves only when `response.causationId === request.messageId`; purpose is deterministic request-response correlation.
3. React HostBridgeProvider stability: remotes dependency tracking is stable for equal values; purpose is avoiding unnecessary bridge recreation.
4. React `useSubscribe` handler stability: latest handler is used without resubscribe churn; purpose is runtime stability with inline closures.
5. Angular DI guard errors: BusService and HostBridgeService throw clear provider setup errors; purpose is actionable diagnostics instead of opaque injector failures.
6. Schema/contract drift hardening: contracts are derived from schemas; purpose is reducing schema/type divergence risk.
7. Nullish metadata generation: metadata fallback uses nullish behavior; purpose is preserving valid falsy values.
8. Query contract cleanup: removed phantom `_TResult`; purpose is cleaner and less misleading query typing.
9. `avatarUrl` validation: URL format validation added; purpose is stronger payload correctness.
10. Ack semantics: `AckResult` uses `accepted` discriminant; purpose is explicit acceptance semantics.
11. State patch semantics: patch follows merge-patch style behavior; purpose is predictable and consistent patch application.
12. Sync dispatcher re-entrancy guard: queue flush is re-entrancy-safe; purpose is preventing recursion-related runtime failures.
13. Vue subscription lifecycle: `useSubscribe` subscribes on mounted/unmounted lifecycle; purpose is avoiding premature or leaked subscriptions.
14. HostBridgeService typing: `getBus()` has explicit return type; purpose is API clarity and stronger typing.
15. Angular provider return types: provider helpers return explicit `EnvironmentProviders`; purpose is stronger Angular API typing.
16. TTL coverage: dedicated tests verify expired/invalid/future timestamp behavior; purpose is reliable temporal validation.
17. Root barrel consistency: Angular is not exported from root barrel; purpose is consistent subpath entry strategy.
18. `validationDescriptor` structure validation: known shape is validated; purpose is stricter runtime metadata validation.
19. Response validation + Angular matrix CI: optional response validator in request path and Angular compatibility workflow; purpose is runtime safety and multi-version confidence.

## Test list with purpose

### `test/bus.spec.ts`
- `publish/subscribe roundtrip` - verifies base bus delivery path.
- `microtask vs synchronous ordering` - verifies dispatch mode ordering guarantees.
- `subscribe returns Unsubscribe and dispose clears listeners` - verifies unsubscribe and dispose listener cleanup.
- `reentrancy-safe nested publish via queue` - verifies nested publish ordering without loss.
- `sync dispatch handles long re-entrant chains without stack overflow` - verifies re-entrant sync stability under depth.
- `dedupe drops duplicate messageId within window` - verifies deduplication window behavior.
- `validator rejects invalid envelopes` - verifies schema validation on publish.
- `targeted delivery only reaches matching subscriberId on shared bus` - verifies one-target routing.
- `broadcast from host reaches all remotes on shared bus` - verifies host-to-all remotes broadcast.
- `targeted remote-to-host delivery reaches only host subscriber` - verifies remote-to-host targeted direction.
- `supports command messages via runtime publish-subscribe` - verifies command kind runtime path.
- `supports query messages via runtime publish-subscribe` - verifies query kind runtime path.
- `supports user-context messages via runtime publish-subscribe` - verifies user-context kind runtime path.
- `request resolves when response references causationId` - verifies strict causation success path.
- `request times out when response only references correlationId` - verifies correlation-only response is rejected.
- `request times out when response has no matching causationId or correlationId` - verifies unmatched response timeout.
- `request times out when causationId does not match request messageId` - verifies strict causation mismatch timeout.
- `request resolves with first matching response when duplicate responses arrive` - verifies first response wins.
- `onDispatchError captures microtask validation failures` - verifies dispatch error hook behavior.
- `onSubscriberError is invoked when subscribe handler returns a rejected Promise` - verifies async subscriber error routing.
- `onSubscriberError is preferred over onDispatchError for subscribe failures` - verifies subscriber error precedence.
- `logs to console when subscribe fails and no error handlers are set` - verifies fallback error visibility.
- `observeAll forwards sync handler throws to onSubscriberError` - verifies observeAll error pipeline.
- `request validates response when validator is provided` - verifies response schema validation path.
- `TTL rejects expired and invalid timestamps` - verifies TTL rejection for invalid/expired messages.
- `TTL accepts future timestamps and non-expired messages` - verifies TTL acceptance for valid timing.

### `test/host-bridge.spec.ts`
- `exposes window.__MFE_BRIDGE__ with versioned handshake` - verifies bridge registration and protocol metadata.
- `tryPublish rejects empty string ids and reports Nack` - verifies invalid inbound metadata handling.
- `tryPublish returns accepted ack for valid messages` - verifies happy-path ack response.
- `restricted sensitivity returns unauthorized Nack` - verifies sensitivity policy enforcement.
- `policy hook runs on publish path` - verifies policy integration.
- `remote-to-remote is host-mediated: separate buses do not cross-deliver` - verifies isolation across independent buses.
- `remote-to-remote works when sharing host bus instance` - verifies host-mediated remote routing on shared bus.
- `default onConflict throws when a valid bridge is already on window` - verifies default conflict policy.
- `onConflict return-existing returns the same handle when options match` - verifies idempotent return-existing behavior.
- `onConflict return-existing throws when remotes differ` - verifies mismatch protection.
- `onConflict replace disposes the previous handle and sets a new bridge` - verifies replace behavior.
- `throws when window has an invalid global and onConflict is throw` - verifies invalid global handling in throw mode.
- `onConflict replace removes invalid value from window and creates a real bridge` - verifies invalid global recovery in replace mode.
- `isValidMfeBridgeHandle rejects plain objects and accepts real handles` - verifies bridge-handle type guard.

### `test/state-sync.spec.ts`
- `applies replace, patch, remove, reset` - verifies core state operation flow.
- `patch performs deep object merge for nested fields` - verifies nested merge behavior.
- `patch follows merge-patch semantics for non-object payloads` - verifies non-object replacement semantics.
- `reject-if-stale blocks non-monotonic revisions` - verifies stale revision protection.
- `custom conflict strategy can reject` - verifies extensible conflict strategy handling.

### `test/validation.spec.ts`
- `accepts valid envelopes` - verifies baseline schema acceptance.
- `rejects bad uuid` - verifies UUID field enforcement.
- `rejects bad occurredAtUtc` - verifies timestamp format enforcement.
- `rejects missing kind` - verifies required kind discriminator.
- `rejects wrong sensitivity` - verifies allowed sensitivity enum.
- `rejects negative revision for state messages` - verifies revision bounds.
- `ValidationDescriptor metadata validates known structure` - verifies accepted metadata structure.
- `rejects invalid ValidationDescriptor shape` - verifies malformed metadata rejection.
- `rejects invalid avatarUrl values` - verifies avatar URL format rules.

### `test/adapters.spec.ts`
- `Angular BusService wires Observable unsubscribe to bus subscription` - verifies Angular RxJS cleanup.
- `Angular BusService throws readable error when provideBus is missing` - verifies Angular missing-provider diagnostics.
- `Angular HostBridgeService throws readable error when provideHostBridge is missing` - verifies bridge provider diagnostics.
- `React useSubscribe cleans up on unmount` - verifies React unmount cleanup.
- `React HostBridgeProvider does not recreate bridge when remotes values are unchanged` - verifies React bridge stability.
- `React useSubscribe uses the latest inline handler closure after rerender` - verifies React latest closure behavior.
- `Vue useSubscribe cleans up on unmount` - verifies Vue lifecycle cleanup.
- `two subscribers on one bus can model remote targeting` - verifies targeting model across subscribers.

## License

MIT

