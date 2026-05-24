# Examples workspace

Runnable Module Federation harness for [`@lkovari/microfrontend-platform-communication`](../mfe-platform-communication/). For architecture, security, and tech stack see the [repository README](../README.md) and [platform-communication-rfc.md](../platform-communication-rfc.md).

This document has two parts:

1. **How to run** the `examples/` workspace (host + remote + E2E).
2. **How to use the library** in all common integration shapes (host, remote, frameworks, message kinds, request/response, policy, state).

---

## How to run this workspace

### Layout

| Path | Role |
| --- | --- |
| `host/` | Shell: `createBus`, `createHostBridge`, `window.__MFE_BRIDGE__`, loads remote |
| `remote-orders/` | Federated remote: `tryPublish`, `getBus()`, targeted subscribe |
| `federation-e2e/` | Playwright smoke test on production builds |

Live code references:

- Host bootstrap: [`host/src/bootstrap.ts`](host/src/bootstrap.ts)
- Remote bootstrap: [`remote-orders/src/bootstrap.ts`](remote-orders/src/bootstrap.ts)

Demo message names: `person:updated` (remote → host), `orders:filters-changed` (host → remote subscription).

### Prerequisites

From the repository root:

```bash
pnpm install
pnpm --filter @lkovari/microfrontend-platform-communication build
```

### Development

```bash
cd examples
pnpm dev
```

Open http://localhost:4300 — host on port **4300**, remote entry on **4301**.

### Build and smoke test

```bash
cd examples
NODE_ENV=production pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
```

---

## How to use the library

### Golden rules

1. **One bus per page** — Host calls `createBus()` once and exposes it via `createHostBridge()` → `window.__MFE_BRIDGE__`. Remotes call `bridge.getBus()`. Separate `createBus()` instances **never** see each other’s events.
2. **Host-mediated remote-to-remote** — Remote A → Remote B always goes through the **same** host bus (`target` + `subscriberId` routing).
3. **Register validators** — Every `messageName` you publish needs a Zod schema in `createBus({ validators })` unless `allowUnregisteredMessageNames: true`.
4. **Validation runs before delivery** — Invalid messages are rejected at publish time; subscribers are not invoked.
5. **Remotes publish via `tryPublish`** — Empty `messageId` / `correlationId` / `occurredAtUtc` can be filled by the bridge; you get `Ack` / `Nack` synchronously.
6. **Do not put secrets on the bus** — No tokens, PII, or permission matrices. Use `public` / `internal` only for coordination payloads.

### Install and entry points

```bash
pnpm add @lkovari/microfrontend-platform-communication zod
```

| Import path | Use for |
| --- | --- |
| `@lkovari/microfrontend-platform-communication` | Contracts, schemas, core, Angular (root barrel) |
| `@lkovari/microfrontend-platform-communication/core` | `createBus`, `createHostBridge`, registry, observability |
| `@lkovari/microfrontend-platform-communication/schemas` | Zod schemas (`EventMessageSchema`, …) |
| `@lkovari/microfrontend-platform-communication/contracts` | TypeScript message types |
| `@lkovari/microfrontend-platform-communication/angular` | `provideBus`, `provideHostBridge`, `BusService`, … |
| `@lkovari/microfrontend-platform-communication/react` | `BusProvider`, hooks |
| `@lkovari/microfrontend-platform-communication/vue` | `createBusPlugin`, composables |

`occurredAtUtc` must be ISO-8601 with offset (e.g. `new Date().toISOString()`).

### Common setup (schemas)

Extend base schemas per topic payload:

```typescript
import { z } from 'zod';
import {
  createBus,
  createHostBridge,
  isValidMfeBridgeHandle,
} from '@lkovari/microfrontend-platform-communication/core';
import {
  CommandMessageSchema,
  EventMessageSchema,
  QueryMessageSchema,
  StateMessageSchema,
  UserContextMessageSchema,
} from '@lkovari/microfrontend-platform-communication/schemas';
import type { MessageBase } from '@lkovari/microfrontend-platform-communication/contracts';
import type { EventMessage } from '@lkovari/microfrontend-platform-communication/contracts';
```

Example topic schema:

```typescript
const UsageEventSchema = EventMessageSchema.extend({
  payload: z.object({ note: z.string() }),
});
```

In subscribe handlers the bus delivers `MessageBase`. Narrow with Zod when you need typed `payload`:

```typescript
bus.subscribe('usage:h2r:event', (message) => {
  const parsed = UsageEventSchema.safeParse(message);
  if (!parsed.success) {
    return;
  }
  console.log(parsed.data.payload.note);
});
```

---

## Host bootstrap (shell)

Minimal host (matches this repo’s [`host/src/bootstrap.ts`](host/src/bootstrap.ts)):

```typescript
const bus = createBus({
  appId: 'shell-host',
  dispatch: 'sync',
  dedupe: { enabled: true, windowMs: 5000 },
  validators: {
    'orders:filters-changed': EventMessageSchema,
    'person:updated': EventMessageSchema,
  },
});

createHostBridge({
  appId: 'shell-host',
  bus,
  remotes: ['remote-orders'],
  stateSync: { enabled: true, initialRevisions: { person: 0 } },
});
```

Optional host options:

| Option | Purpose |
| --- | --- |
| `defaultSubscriberId: 'shell-host'` | Default for `bus.subscribe` when remotes send `target: 'shell-host'` |
| `registry: topicRegistry` | `TopicRegistry` ACL per `messageName` |
| `messageTtlMs` | Reject stale `occurredAtUtc` |
| `observability` | `ObservabilityAdapter` hooks |
| `onDispatchError` / `onSubscriberError` | Error routing |
| `failFastOnDispatchError: true` | `request()` fails fast when publish errors under `onDispatchError` |

---

## Remote bootstrap (federated bundle)

Load **after** the host created `window.__MFE_BRIDGE__` (see [`remote-orders/src/bootstrap.ts`](remote-orders/src/bootstrap.ts)):

```typescript
import { isValidMfeBridgeHandle } from '@lkovari/microfrontend-platform-communication/core';

const bridge = window.__MFE_BRIDGE__;
if (!isValidMfeBridgeHandle(bridge)) {
  throw new Error('Invalid or missing window.__MFE_BRIDGE__');
}

const bus = bridge.getBus();

bus.subscribe(
  'orders:filters-changed',
  (message) => {
    console.log(message.messageName, message.correlationId);
  },
  { subscriberId: 'remote-orders' },
);

const result = bridge.tryPublish({
  messageName: 'person:updated',
  messageVersion: 1,
  messageId: crypto.randomUUID(),
  correlationId: crypto.randomUUID(),
  source: 'remote-orders',
  occurredAtUtc: new Date().toISOString(),
  kind: 'event',
  eventKind: 'person.updated',
  sensitivity: 'public',
  payload: { id: '1', name: 'Ada' },
});

if (!result.accepted) {
  console.error(result.errorCode, result.message);
}
```

`tryPublish` may leave `messageId`, `correlationId`, or `occurredAtUtc` empty; the bridge fills UUIDs and timestamp before validation.

---

## Routing: `target` and `subscriberId`

| Pattern | Publish | Subscribe |
| --- | --- | --- |
| Host → one remote | `target: 'remote-a'` | `{ subscriberId: 'remote-a' }` |
| Remote → host | `target: 'shell-host'` | Host: `defaultSubscriberId: 'shell-host'` or matching `subscriberId` |
| Remote → remote | `target: 'remote-b'` | `{ subscriberId: 'remote-b' }` |
| Broadcast | omit `target` | any subscriber for that `messageName` |

---

## Topology 1 — Host → Remote A

Remote subscribes with `{ subscriberId: 'remote-a' }`. Host publishes with `target: 'remote-a'`.

### `event`

**Host**

```typescript
const bus = createBus({
  appId: 'shell-host',
  dispatch: 'sync',
  validators: { 'usage:h2r:event': UsageEventSchema },
});

createHostBridge({ appId: 'shell-host', bus, remotes: ['remote-a'] });

window.__MFE_BRIDGE__?.tryPublish({
  messageName: 'usage:h2r:event',
  messageVersion: 1,
  messageId: '',
  correlationId: '',
  source: 'shell-host',
  target: 'remote-a',
  occurredAtUtc: '',
  kind: 'event',
  eventKind: 'usage.h2r.event',
  sensitivity: 'public',
  payload: { note: 'hello from host' },
});
```

**Remote A**

```typescript
const bus = window.__MFE_BRIDGE__?.getBus();
if (!bus) {
  throw new Error('bus missing');
}

bus.subscribe(
  'usage:h2r:event',
  (message) => {
    const parsed = UsageEventSchema.safeParse(message);
    if (!parsed.success) {
      return;
    }
    console.log(parsed.data.payload.note);
  },
  { subscriberId: 'remote-a' },
);
```

### `command`

Register `CommandMessageSchema.extend({ payload: … })`. Host `tryPublish` with `kind: 'command'`, `commandName`, optional `ackTimeoutMs` (app-layer hint only).

### `query` (host initiates `request`)

Host registers both query and result topic schemas. Remote answers with `causationId ===` query `messageId`.

**Host**

```typescript
const QuerySchema = QueryMessageSchema.extend({ payload: z.object({ q: z.string() }) });
const QueryResultSchema = EventMessageSchema.extend({
  payload: z.object({ answer: z.string() }),
});

const bus = createBus({
  appId: 'shell-host',
  dispatch: 'microtask',
  validators: {
    'usage:h2r:query': QuerySchema,
    'usage:h2r:query:result': QueryResultSchema,
  },
});

createHostBridge({ appId: 'shell-host', bus, remotes: ['remote-a'] });

const req = {
  messageName: 'usage:h2r:query',
  messageVersion: 1,
  messageId: crypto.randomUUID(),
  correlationId: crypto.randomUUID(),
  source: 'shell-host',
  target: 'remote-a',
  occurredAtUtc: new Date().toISOString(),
  kind: 'query' as const,
  queryName: 'usage.h2r.query',
  sensitivity: 'public' as const,
  payload: { q: 'status' },
  timeoutMs: 3000,
};

void bus.request(req, 3000, QueryResultSchema).then((res) => {
  console.log(res.payload.answer);
});
```

**Remote A**

```typescript
bus.subscribe(
  'usage:h2r:query',
  (message) => {
    const parsed = QuerySchema.safeParse(message);
    if (!parsed.success) {
      return;
    }
    const m = parsed.data;
    bus.publish<EventMessage<{ answer: string }>>({
      messageName: 'usage:h2r:query:result',
      messageVersion: 1,
      messageId: crypto.randomUUID(),
      correlationId: m.correlationId,
      causationId: m.messageId,
      source: 'remote-a',
      occurredAtUtc: new Date().toISOString(),
      kind: 'event',
      eventKind: 'usage.h2r.query.result',
      sensitivity: 'public',
      payload: { answer: 'ok-from-remote-a' },
    });
  },
  { subscriberId: 'remote-a' },
);
```

### `state`

`kind: 'state'`, `stateKey`, `operation` (`replace` | `patch` | `remove` | `reset`), `revision`, `payload`. Use `StateMessageSchema.extend({ payload: … })`.

### `user-context`

`kind: 'user-context'`, `UserContextMessageSchema`, structured payload (`userId`, `displayName`, `rolesForUi`, …). No tokens.

---

## Topology 2 — Remote A → Host

Host uses `defaultSubscriberId: 'shell-host'`. Remote `tryPublish` with `target: 'shell-host'`.

### `event`

**Remote A**

```typescript
window.__MFE_BRIDGE__?.tryPublish({
  messageName: 'usage:r2h:event',
  messageVersion: 1,
  messageId: '',
  correlationId: '',
  source: 'remote-a',
  target: 'shell-host',
  occurredAtUtc: '',
  kind: 'event',
  eventKind: 'usage.r2h.event',
  sensitivity: 'public',
  payload: { note: 'hello from remote' },
});
```

**Host**

```typescript
const bus = createBus({
  appId: 'shell-host',
  defaultSubscriberId: 'shell-host',
  dispatch: 'sync',
  validators: { 'usage:r2h:event': UsageEventSchema },
});

createHostBridge({ appId: 'shell-host', bus, remotes: ['remote-a'] });

bus.subscribe('usage:r2h:event', (message) => {
  const parsed = UsageEventSchema.safeParse(message);
  if (!parsed.success) {
    return;
  }
  console.log(parsed.data.payload.note);
});
```

### `command`, `state`, `user-context`

Same pattern as topology 1: remote `tryPublish` with `target: 'shell-host'`; host `subscribe` without extra `subscriberId` when `defaultSubscriberId` matches.

### `query` (remote initiates `request`)

Remote calls `bus.request(req, timeoutMs, ResultSchema)`; host handler publishes result with `causationId: m.messageId`.

---

## Topology 3 — Remote A → Remote B (via host)

One shared bus. Remote A publishes `target: 'remote-b'`. Remote B subscribes `{ subscriberId: 'remote-b' }`.

### `event`

**Remote A**

```typescript
window.__MFE_BRIDGE__?.tryPublish({
  messageName: 'usage:r2r:event',
  messageVersion: 1,
  messageId: '',
  correlationId: '',
  source: 'remote-a',
  target: 'remote-b',
  occurredAtUtc: '',
  kind: 'event',
  eventKind: 'usage.r2r.event',
  sensitivity: 'public',
  payload: { ping: 1 },
});
```

**Remote B**

```typescript
const bus = window.__MFE_BRIDGE__?.getBus();
if (!bus) {
  throw new Error('bus missing');
}

bus.subscribe(
  'usage:r2r:event',
  (message) => {
    const parsed = UsageEventSchema.extend({ payload: z.object({ ping: z.number() }) }).safeParse(
      message,
    );
    if (!parsed.success) {
      return;
    }
    console.log(parsed.data.payload.ping);
  },
  { subscriberId: 'remote-b' },
);
```

Other kinds follow the same `target` / `subscriberId` rules with the appropriate `kind` and schema.

---

## Publish APIs compared

| API | Who | On validation failure | On dedupe |
| --- | --- | --- | --- |
| `bus.publish(msg)` | Host (in-process) | Throws or `onDispatchError` | Silent drop |
| `bus.attemptPublish(msg)` | Host | `{ status: 'rejected' }` | `{ status: 'dedupe' }` + optional `onDedupe` |
| `bridge.tryPublish(msg)` | Remote | `Nack` (`errorCode`, `message`) | `Nack` with `errorCode: 'dedupe'` |

---

## Request / response

- Matching rule: response `causationId` **must equal** request `messageId` (correlation-only replies time out).
- Typed response: pass a Zod schema as the third argument: `bus.request(req, 5000, ResponseSchema)`.
- Without a response validator, return type is `MessageBase`.

---

## TopicRegistry (ACL)

```typescript
import { TopicRegistry } from '@lkovari/microfrontend-platform-communication/core';

const registry = new TopicRegistry();
registry.register({
  messageName: 'person:updated',
  allowedPublishers: ['remote-profile', 'shell-host'],
  allowedSubscribers: ['remote-orders', 'shell-host'],
  minMessageVersion: 1,
  maxMessageVersion: 1,
});

const bus = createBus({ appId: 'shell-host', validators, registry });
```

`source` on the message is checked against `allowedPublishers`; `subscriberId` against `allowedSubscribers`.

---

## State sync and bootstrap snapshot

Enable on the bridge:

```typescript
createHostBridge({
  appId: 'shell-host',
  bus,
  remotes: ['remote-orders'],
  stateSync: {
    enabled: true,
    initialRevisions: { person: 0 },
    conflictStrategy: 'last-writer-wins',
  },
});

const snapshot = window.__MFE_BRIDGE__?.getSnapshot?.('person');
```

`getSnapshot` returns `unknown` — narrow in app code (e.g. with your state Zod schema). Revisions and merge/patch semantics run in `registerBeforeDeliver` on the host bus.

---

## Framework adapters

### Angular (host)

```typescript
import { ApplicationConfig } from '@angular/core';
import {
  provideBus,
  provideHostBridge,
  BusService,
} from '@lkovari/microfrontend-platform-communication/angular';
import { EventMessageSchema } from '@lkovari/microfrontend-platform-communication/schemas';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBus({
      appId: 'shell-host',
      dispatch: 'microtask',
      validators: { 'orders:filters-changed': EventMessageSchema },
    }),
    provideHostBridge({ remotes: ['remote-orders'] }),
    BusService,
  ],
};
```

```typescript
import { inject } from '@angular/core';
import { BusService } from '@lkovari/microfrontend-platform-communication/angular';

const busSvc = inject(BusService);
busSvc.messages$('orders:filters-changed').subscribe((message) => {
  console.log(message.messageName);
});
```

Bus and bridge dispose automatically when the injector is destroyed.

### Angular (remote)

```typescript
import { provideRemotePlatformBus } from '@lkovari/microfrontend-platform-communication/angular';

export const remoteConfig: ApplicationConfig = {
  providers: [provideRemotePlatformBus()],
};
```

Requires a valid `window.__MFE_BRIDGE__` from the host before bootstrap.

### React

```tsx
import { BusProvider, HostBridgeProvider, useSubscribe, usePublish } from '@lkovari/microfrontend-platform-communication/react';
import { EventMessageSchema } from '@lkovari/microfrontend-platform-communication/schemas';

<BusProvider appId="shell-host" dispatch="sync" validators={{ 'orders:filters-changed': EventMessageSchema }}>
  <HostBridgeProvider remotes={['remote-orders']}>
    <App />
  </HostBridgeProvider>
</BusProvider>
```

```tsx
useSubscribe('orders:filters-changed', (message) => {
  console.log(message.messageName);
});
```

### Vue

```typescript
import { createApp } from 'vue';
import {
  createBusPlugin,
  createHostBridgePlugin,
  useSubscribe,
} from '@lkovari/microfrontend-platform-communication/vue';
import { EventMessageSchema } from '@lkovari/microfrontend-platform-communication/schemas';

const app = createApp(App);
app.use(
  createBusPlugin({
    appId: 'shell-host',
    dispatch: 'sync',
    validators: { 'orders:filters-changed': EventMessageSchema },
  }),
);
app.use(createHostBridgePlugin({ remotes: ['remote-orders'] }));
```

```typescript
useSubscribe('orders:filters-changed', (message) => {
  console.log(message.messageName);
});
```

---

## Observability

```typescript
import {
  ConsoleObservabilityAdapter,
  createBus,
} from '@lkovari/microfrontend-platform-communication/core';

const bus = createBus({
  appId: 'shell-host',
  validators,
  observability: new ConsoleObservabilityAdapter(),
});
```

Hooks: `onPublish`, `onDeliver`, `onError`, `onRequestTimeout`.

---

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Remote never receives | Same bus via `getBus()`? `target` matches remote `subscriberId`? Validator registered for `messageName`? |
| `tryPublish` → `Nack` validation | Payload/schema mismatch; empty UUIDs only work where bridge fills them |
| `tryPublish` → `Nack` dedupe | Duplicate `messageId` within dedupe window |
| `request()` times out | Responder used `causationId: request.messageId`? Result topic validator registered? |
| `restricted` rejected | Sensitivity policy — use `public` / `internal` only |
| Two remotes, no cross-talk | Expected if using two `createBus()` instances — use one host bus |

---

## Related docs

- [../README.md](../README.md) — topology, message kinds, security, tech implementation
- [../README.md](../README.md) — package API, topology, message kinds, security, tech implementation
- [../mfe-platform-communication/CHANGELOG.md](../mfe-platform-communication/CHANGELOG.md) — version migrations
