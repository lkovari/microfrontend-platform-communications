# @lkovari/microfrontend-platform-communication

Framework-agnostic, host-orchestrated messaging for native-federated microfrontends (Angular, React, Vue). The runtime bus uses the browser `EventTarget` and `CustomEvent` primitives behind a typed API. Contracts are pure TypeScript types; Zod validates every envelope at the bus boundary.

## Topology

```text
 ┌────────────┐      typed messages      ┌───────────────┐
 │  Remote A  │ ───────────────────────▶ │               │
 └────────────┘                          │               │
                                         │    Host /     │
 ┌────────────┐      typed messages      │   Shell Bus   │
 │  Remote B  │ ───────────────────────▶ │ + Host Bridge │
 └────────────┘                          │ + Policy      │
                                         │ + State sync  │
 ┌────────────┐      typed messages      │               │
 │  Remote C  │ ───────────────────────▶ │               │
 └────────────┘                          └──────┬────────┘
                                                │
                                                ▼
                                         ┌───────────────┐
                                         │ Backend / BFF │
                                         └───────────────┘
```

Host and remotes share one bus instance exposed through `window.__MFE_BRIDGE__` (versioned handshake). Remote-to-remote traffic uses the same bus with `target` addressing; separate `createBus()` instances never see each other’s events.

## Install

```bash
pnpm add @lkovari/microfrontend-platform-communication zod
```

Peer dependencies (optional by subpath): `@angular/core`, `react`, `rxjs`, `vue`.

## Entry points

- `@lkovari/microfrontend-platform-communication` — contracts, schemas, core, Angular adapter
- `@lkovari/microfrontend-platform-communication/contracts` — types only
- `@lkovari/microfrontend-platform-communication/schemas` — Zod schemas
- `@lkovari/microfrontend-platform-communication/core` — `createBus`, `createHostBridge`, policy, registry, state sync
- `@lkovari/microfrontend-platform-communication/angular` — `provideBus`, `provideHostBridge`, `BusService`
- `@lkovari/microfrontend-platform-communication/react` — `BusProvider`, `HostBridgeProvider`, hooks
- `@lkovari/microfrontend-platform-communication/vue` — `createBusPlugin`, `createHostBridgePlugin`, composables

React and Vue hooks are not re-exported from the package root to avoid name collisions; import them from `/react` or `/vue`.

## Quick usage

Host creates the bus with validators keyed by `messageName`, then the bridge:

```ts
import { createBus, createHostBridge } from '@lkovari/microfrontend-platform-communication/core';
import { EventMessageSchema } from '@lkovari/microfrontend-platform-communication/schemas';

const bus = createBus({
  appId: 'shell-host',
  dispatch: 'microtask',
  dedupe: { enabled: true, windowMs: 5_000 },
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
```

Remotes obtain the same bus via `window.__MFE_BRIDGE__.getBus()` and subscribe with an explicit `subscriberId` matching their remote id when using targeted messages:

```ts
const bridge = window.__MFE_BRIDGE__;
const bus = bridge.getBus();

bus.subscribe(
  'person:updated',
  (msg) => console.log(msg.payload),
  { subscriberId: 'remote-profile' },
);
```

Use `bridge.tryPublish(message)` when the shell should normalize missing `messageId` / `correlationId` / `occurredAtUtc` and surface `Ack` / `Nack` results (for example `restricted` sensitivity yields `errorCode: 'unauthorized'`).

## Message categories (examples)

| Area | Examples |
| --- | --- |
| Auth and session | `auth:login-completed`, `auth:logout-completed`, `session:expired` |
| User and roles | `user:context-updated`, `roles:changed` |
| Navigation | `navigation:requested`, `navigation:completed` |
| Cross-app context | `tenant:changed`, `person:updated`, `orders:filters-changed` |
| Feature / runtime | `feature-flags:updated`, `runtime:manifest-updated` |
| Invalidation | `cache:invalidated`, `<slice>:refresh-requested` |
| Health | `remote:ready`, `remote:failed`, `telemetry:event` |

## Security model

Display-safe context may cross the bus (names, tenant, locale, UI role hints, feature flags, navigation context). Do not put access tokens, refresh tokens, full claim sets, or authoritative permission matrices on the bus. Treat `UserContext.rolesForUi` as a UX hint only; the backend remains the source of truth for authorization.

## Three kinds of state

Distinguish server truth, cached client snapshots, and derived UI state. The bus coordinates signals between apps; it does not replace your API or security boundary.

## When this pattern fits

Strong fit: multiple frameworks, independent remotes, backend-first security, low lock-in. Less sufficient alone for guaranteed delivery, complex cross-app orchestration, or teams without disciplined public contracts.

## Design summary

- One package with tree-shakable subpaths.
- Contracts describe message shapes; Zod validates; core enforces policy, dedupe, TTL hooks, correlation, and optional state sync.
- Host-orchestrated routing with `target` vs broadcast semantics on a single bus instance.
- Default sensitivity policy rejects `restricted` messages unless disabled.

## Adapter examples

**Angular** — `provideBus` / `provideHostBridge`, `BusService.messages$('person:updated')` with `takeUntilDestroyed`.

**React** — `BusProvider` + `HostBridgeProvider`, `useSubscribe('person:updated', handler)`.

**Vue** — `createBusPlugin` then `createHostBridgePlugin`, `useSubscribe` in `setup`.

See the spec document you used to generate this library for full snippet blocks.

## Examples workspace

The `examples/` folder is reserved for a shell plus Angular, React, and Vue remotes demonstrating `person:updated` and `orders:filters-changed`. It is not required to use the published package.

## License

MIT
