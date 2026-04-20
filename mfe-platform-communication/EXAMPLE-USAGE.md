# Example usage (copy-paste style)

Hello, this document I wrote for myself originally when I was wiring the first host and remotes together. English is not my first language (Hungarian), so maybe the wording is a bit straight — but the code is what matters here.

Below you find three topologies that we use in practice:

1. Host sends something to Remote A, and Remote A receives it.
2. Remote A sends something to Host, and Host receives it.
3. Remote A sends to Remote B, but always through the same host bus (shared `createBus` / `window.__MFE_BRIDGE__`).

Important detail from the library: **two different `createBus()` instances never see each other**. So the “via host” story really means **one** bus instance that Host created and exposed on `window.__MFE_BRIDGE__`.

Every block uses **one** `MessageKind` (`event`, `command`, `query`, `state`, `user-context`) so you can map it mentally to the enum in `MessageKind`.

Common imports I assume at the top of your module:

```typescript
import { z } from 'zod';
import {
  createBus,
  createHostBridge,
} from '@lkovari/microfrontend-platform-communication';
import {
  CommandMessageSchema,
  EventMessageSchema,
  QueryMessageSchema,
  StateMessageSchema,
  UserContextMessageSchema,
} from '@lkovari/microfrontend-platform-communication/schemas';
import type { CommandMessage } from '@lkovari/microfrontend-platform-communication/contracts';
import type { EventMessage } from '@lkovari/microfrontend-platform-communication/contracts';
import type { QueryMessage } from '@lkovari/microfrontend-platform-communication/contracts';
import type { StateMessage } from '@lkovari/microfrontend-platform-communication/contracts';
import type { UserContextMessage } from '@lkovari/microfrontend-platform-communication/contracts';
```

`occurredAtUtc` must be ISO-8601 with offset (what `new Date().toISOString()` gives).

---

## 1. Host → Remote A (send and receive)

Remote A subscribes with `{ subscriberId: 'remote-a' }`. Host publishes with `target: 'remote-a'` so only that remote’s handler runs.

### 1.1 `event`

**Host (shell)**

```typescript
const bus = createBus({
  appId: 'shell-host',
  dispatch: 'sync',
  validators: {
    'usage:h2r:event': EventMessageSchema.extend({
      payload: z.object({ note: z.string() }),
    }),
  },
});

createHostBridge({
  appId: 'shell-host',
  bus,
  remotes: ['remote-a'],
});

const shellBridge = window.__MFE_BRIDGE__;
if (!shellBridge) {
  throw new Error('bridge missing');
}

shellBridge.tryPublish({
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
const bridge = window.__MFE_BRIDGE__;
if (!bridge) {
  throw new Error('bridge missing');
}
const bus = bridge.getBus();

bus.subscribe<EventMessage<{ note: string }>>(
  'usage:h2r:event',
  (msg) => {
    console.log(msg.payload.note);
  },
  { subscriberId: 'remote-a' },
);
```

### 1.2 `command`

**Host**

```typescript
const bus = createBus({
  appId: 'shell-host',
  dispatch: 'sync',
  validators: {
    'usage:h2r:command': CommandMessageSchema.extend({
      payload: z.object({ action: z.string() }),
    }),
  },
});

createHostBridge({ appId: 'shell-host', bus, remotes: ['remote-a'] });
const shellBridge = window.__MFE_BRIDGE__;
if (!shellBridge) {
  throw new Error('bridge missing');
}

shellBridge.tryPublish({
  messageName: 'usage:h2r:command',
  messageVersion: 1,
  messageId: '',
  correlationId: '',
  source: 'shell-host',
  target: 'remote-a',
  occurredAtUtc: '',
  kind: 'command',
  commandName: 'usage.h2r.command',
  sensitivity: 'public',
  payload: { action: 'refresh-grid' },
  ackTimeoutMs: 2000,
});
```

**Remote A**

```typescript
const bus = window.__MFE_BRIDGE__?.getBus();
if (!bus) {
  throw new Error('bus missing');
}

bus.subscribe<CommandMessage<{ action: string }>>(
  'usage:h2r:command',
  (msg) => {
    console.log(msg.payload.action);
  },
  { subscriberId: 'remote-a' },
);
```

### 1.3 `query`

Host uses `bus.request`. Remote answers with a second message whose `causationId` equals the incoming query’s `messageId` (this is how `request` pairs the reply).

**Host**

```typescript
const bus = createBus({
  appId: 'shell-host',
  dispatch: 'microtask',
  validators: {
    'usage:h2r:query': QueryMessageSchema.extend({
      payload: z.object({ q: z.string() }),
    }),
    'usage:h2r:query:result': EventMessageSchema.extend({
      payload: z.object({ answer: z.string() }),
    }),
  },
});

createHostBridge({ appId: 'shell-host', bus, remotes: ['remote-a'] });
const shared = window.__MFE_BRIDGE__?.getBus();
if (!shared) {
  throw new Error('bus missing');
}

const req: QueryMessage<{ q: string }> = {
  messageName: 'usage:h2r:query',
  messageVersion: 1,
  messageId: crypto.randomUUID(),
  correlationId: crypto.randomUUID(),
  source: 'shell-host',
  target: 'remote-a',
  occurredAtUtc: new Date().toISOString(),
  kind: 'query',
  queryName: 'usage.h2r.query',
  sensitivity: 'public',
  payload: { q: 'status' },
  timeoutMs: 3000,
};

void shared
  .request<QueryMessage<{ q: string }>, EventMessage<{ answer: string }>>(req, 3000)
  .then((res) => {
    console.log(res.payload.answer);
  });
```

**Remote A**

```typescript
const bus = window.__MFE_BRIDGE__?.getBus();
if (!bus) {
  throw new Error('bus missing');
}

bus.subscribe<QueryMessage<{ q: string }>>(
  'usage:h2r:query',
  (m) => {
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

### 1.4 `state`

**Host**

```typescript
const bus = createBus({
  appId: 'shell-host',
  dispatch: 'sync',
  validators: {
    'usage:h2r:state': StateMessageSchema.extend({
      payload: z.object({ value: z.number() }),
    }),
  },
});

createHostBridge({ appId: 'shell-host', bus, remotes: ['remote-a'] });
const shellBridge = window.__MFE_BRIDGE__;
if (!shellBridge) {
  throw new Error('bridge missing');
}

shellBridge.tryPublish({
  messageName: 'usage:h2r:state',
  messageVersion: 1,
  messageId: '',
  correlationId: '',
  source: 'shell-host',
  target: 'remote-a',
  occurredAtUtc: '',
  kind: 'state',
  sensitivity: 'internal',
  stateKey: 'usage:h2r:counter',
  operation: 'replace',
  revision: 1,
  payload: { value: 42 },
});
```

**Remote A**

```typescript
const bus = window.__MFE_BRIDGE__?.getBus();
if (!bus) {
  throw new Error('bus missing');
}

bus.subscribe<StateMessage<{ value: number }>>(
  'usage:h2r:state',
  (msg) => {
    console.log(msg.payload.value);
  },
  { subscriberId: 'remote-a' },
);
```

### 1.5 `user-context`

**Host**

```typescript
const bus = createBus({
  appId: 'shell-host',
  dispatch: 'sync',
  validators: {
    'usage:h2r:user-context': UserContextMessageSchema,
  },
});

createHostBridge({ appId: 'shell-host', bus, remotes: ['remote-a'] });
const shellBridge = window.__MFE_BRIDGE__;
if (!shellBridge) {
  throw new Error('bridge missing');
}

const msg: UserContextMessage = {
  messageName: 'usage:h2r:user-context',
  messageVersion: 1,
  messageId: '',
  correlationId: '',
  source: 'shell-host',
  target: 'remote-a',
  occurredAtUtc: '',
  kind: 'user-context',
  sensitivity: 'public',
  payload: {
    userId: 'u-1',
    displayName: 'Test User',
    rolesForUi: ['viewer'],
    locale: 'hu-HU',
  },
};

shellBridge.tryPublish(msg);
```

**Remote A**

```typescript
const bus = window.__MFE_BRIDGE__?.getBus();
if (!bus) {
  throw new Error('bus missing');
}

bus.subscribe<UserContextMessage>(
  'usage:h2r:user-context',
  (m) => {
    console.log(m.payload.displayName);
  },
  { subscriberId: 'remote-a' },
);
```

---

## 2. Remote A → Host (send and receive)

Host side uses the default subscriber id `shell-host` (we pass `defaultSubscriberId: 'shell-host'` to `createBus`). Remote publishes with `target: 'shell-host'` so the host handler is the one that catches it, not another remote that forgot to filter.

### 2.1 `event`

**Remote A**

```typescript
const bridge = window.__MFE_BRIDGE__;
if (!bridge) {
  throw new Error('bridge missing');
}

bridge.tryPublish({
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
  validators: {
    'usage:r2h:event': EventMessageSchema.extend({
      payload: z.object({ note: z.string() }),
    }),
  },
});

createHostBridge({ appId: 'shell-host', bus, remotes: ['remote-a'] });

bus.subscribe<EventMessage<{ note: string }>>('usage:r2h:event', (msg) => {
  console.log(msg.payload.note);
});
```

### 2.2 `command`

**Remote A**

```typescript
const bridge = window.__MFE_BRIDGE__;
if (!bridge) {
  throw new Error('bridge missing');
}

bridge.tryPublish({
  messageName: 'usage:r2h:command',
  messageVersion: 1,
  messageId: '',
  correlationId: '',
  source: 'remote-a',
  target: 'shell-host',
  occurredAtUtc: '',
  kind: 'command',
  commandName: 'usage.r2h.command',
  sensitivity: 'public',
  payload: { action: 'open-drawer' },
});
```

**Host**

```typescript
const bus = createBus({
  appId: 'shell-host',
  defaultSubscriberId: 'shell-host',
  dispatch: 'sync',
  validators: {
    'usage:r2h:command': CommandMessageSchema.extend({
      payload: z.object({ action: z.string() }),
    }),
  },
});

createHostBridge({ appId: 'shell-host', bus, remotes: ['remote-a'] });

bus.subscribe<CommandMessage<{ action: string }>>('usage:r2h:command', (msg) => {
  console.log(msg.payload.action);
});
```

### 2.3 `query`

**Remote A**

```typescript
const bus = window.__MFE_BRIDGE__?.getBus();
if (!bus) {
  throw new Error('bus missing');
}

const req: QueryMessage<{ q: string }> = {
  messageName: 'usage:r2h:query',
  messageVersion: 1,
  messageId: crypto.randomUUID(),
  correlationId: crypto.randomUUID(),
  source: 'remote-a',
  target: 'shell-host',
  occurredAtUtc: new Date().toISOString(),
  kind: 'query',
  queryName: 'usage.r2h.query',
  sensitivity: 'public',
  payload: { q: 'theme' },
  timeoutMs: 3000,
};

void bus
  .request<QueryMessage<{ q: string }>, EventMessage<{ answer: string }>>(req, 3000)
  .then((res) => {
    console.log(res.payload.answer);
  });
```

**Host**

```typescript
const bus = createBus({
  appId: 'shell-host',
  defaultSubscriberId: 'shell-host',
  dispatch: 'microtask',
  validators: {
    'usage:r2h:query': QueryMessageSchema.extend({
      payload: z.object({ q: z.string() }),
    }),
    'usage:r2h:query:result': EventMessageSchema.extend({
      payload: z.object({ answer: z.string() }),
    }),
  },
});

createHostBridge({ appId: 'shell-host', bus, remotes: ['remote-a'] });

bus.subscribe<QueryMessage<{ q: string }>>('usage:r2h:query', (m) => {
  bus.publish<EventMessage<{ answer: string }>>({
    messageName: 'usage:r2h:query:result',
    messageVersion: 1,
    messageId: crypto.randomUUID(),
    correlationId: m.correlationId,
    causationId: m.messageId,
    source: 'shell-host',
    occurredAtUtc: new Date().toISOString(),
    kind: 'event',
    eventKind: 'usage.r2h.query.result',
    sensitivity: 'public',
    payload: { answer: 'dark' },
  });
});
```

### 2.4 `state`

**Remote A**

```typescript
const bridge = window.__MFE_BRIDGE__;
if (!bridge) {
  throw new Error('bridge missing');
}

bridge.tryPublish({
  messageName: 'usage:r2h:state',
  messageVersion: 1,
  messageId: '',
  correlationId: '',
  source: 'remote-a',
  target: 'shell-host',
  occurredAtUtc: '',
  kind: 'state',
  sensitivity: 'internal',
  stateKey: 'usage:r2h:selection',
  operation: 'replace',
  revision: 1,
  payload: { rowId: 'r-9' },
});
```

**Host**

```typescript
const bus = createBus({
  appId: 'shell-host',
  defaultSubscriberId: 'shell-host',
  dispatch: 'sync',
  validators: {
    'usage:r2h:state': StateMessageSchema.extend({
      payload: z.object({ rowId: z.string() }),
    }),
  },
});

createHostBridge({ appId: 'shell-host', bus, remotes: ['remote-a'] });

bus.subscribe<StateMessage<{ rowId: string }>>('usage:r2h:state', (msg) => {
  console.log(msg.payload.rowId);
});
```

### 2.5 `user-context`

**Remote A**

```typescript
const bridge = window.__MFE_BRIDGE__;
if (!bridge) {
  throw new Error('bridge missing');
}

bridge.tryPublish({
  messageName: 'usage:r2h:user-context',
  messageVersion: 1,
  messageId: '',
  correlationId: '',
  source: 'remote-a',
  target: 'shell-host',
  occurredAtUtc: '',
  kind: 'user-context',
  sensitivity: 'public',
  payload: {
    userId: 'u-77',
    displayName: 'Remote User',
    rolesForUi: ['editor'],
  },
});
```

**Host**

```typescript
const bus = createBus({
  appId: 'shell-host',
  defaultSubscriberId: 'shell-host',
  dispatch: 'sync',
  validators: {
    'usage:r2h:user-context': UserContextMessageSchema,
  },
});

createHostBridge({ appId: 'shell-host', bus, remotes: ['remote-a'] });

bus.subscribe<UserContextMessage>('usage:r2h:user-context', (m) => {
  console.log(m.payload.userId);
});
```

---

## 3. Remote A → Remote B via host (same shared bus)

Here Host still creates **one** `bus` and `createHostBridge`. Remote A and Remote B both call `window.__MFE_BRIDGE__.getBus()` — so it is physically the same bus. Remote A publishes with `source: 'remote-a'` and `target: 'remote-b'`. Remote B subscribes with `{ subscriberId: 'remote-b' }`.

### 3.1 `event`

**Remote A (sender)**

```typescript
const bridge = window.__MFE_BRIDGE__;
if (!bridge) {
  throw new Error('bridge missing');
}

bridge.tryPublish({
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

**Remote B (receiver)**

```typescript
const bus = window.__MFE_BRIDGE__?.getBus();
if (!bus) {
  throw new Error('bus missing');
}

bus.subscribe<EventMessage<{ ping: number }>>(
  'usage:r2r:event',
  (msg) => {
    console.log(msg.payload.ping);
  },
  { subscriberId: 'remote-b' },
);
```

### 3.2 `command`

**Remote A**

```typescript
const bridge = window.__MFE_BRIDGE__;
if (!bridge) {
  throw new Error('bridge missing');
}

bridge.tryPublish({
  messageName: 'usage:r2r:command',
  messageVersion: 1,
  messageId: '',
  correlationId: '',
  source: 'remote-a',
  target: 'remote-b',
  occurredAtUtc: '',
  kind: 'command',
  commandName: 'usage.r2r.command',
  sensitivity: 'public',
  payload: { task: 'recalculate' },
});
```

**Remote B**

```typescript
const bus = window.__MFE_BRIDGE__?.getBus();
if (!bus) {
  throw new Error('bus missing');
}

bus.subscribe<CommandMessage<{ task: string }>>(
  'usage:r2r:command',
  (msg) => {
    console.log(msg.payload.task);
  },
  { subscriberId: 'remote-b' },
);
```

### 3.3 `query`

**Remote A**

```typescript
const bus = window.__MFE_BRIDGE__?.getBus();
if (!bus) {
  throw new Error('bus missing');
}

const req: QueryMessage<{ q: string }> = {
  messageName: 'usage:r2r:query',
  messageVersion: 1,
  messageId: crypto.randomUUID(),
  correlationId: crypto.randomUUID(),
  source: 'remote-a',
  target: 'remote-b',
  occurredAtUtc: new Date().toISOString(),
  kind: 'query',
  queryName: 'usage.r2r.query',
  sensitivity: 'public',
  payload: { q: 'inventory' },
  timeoutMs: 3000,
};

void bus
  .request<QueryMessage<{ q: string }>, EventMessage<{ answer: string }>>(req, 3000)
  .then((res) => {
    console.log(res.payload.answer);
  });
```

**Remote B**

```typescript
const bus = window.__MFE_BRIDGE__?.getBus();
if (!bus) {
  throw new Error('bus missing');
}

bus.subscribe<QueryMessage<{ q: string }>>(
  'usage:r2r:query',
  (m) => {
    bus.publish<EventMessage<{ answer: string }>>({
      messageName: 'usage:r2r:query:result',
      messageVersion: 1,
      messageId: crypto.randomUUID(),
      correlationId: m.correlationId,
      causationId: m.messageId,
      source: 'remote-b',
      occurredAtUtc: new Date().toISOString(),
      kind: 'event',
      eventKind: 'usage.r2r.query.result',
      sensitivity: 'public',
      payload: { answer: '42-units' },
    });
  },
  { subscriberId: 'remote-b' },
);
```

### 3.4 `state`

**Remote A**

```typescript
const bridge = window.__MFE_BRIDGE__;
if (!bridge) {
  throw new Error('bridge missing');
}

bridge.tryPublish({
  messageName: 'usage:r2r:state',
  messageVersion: 1,
  messageId: '',
  correlationId: '',
  source: 'remote-a',
  target: 'remote-b',
  occurredAtUtc: '',
  kind: 'state',
  sensitivity: 'internal',
  stateKey: 'usage:r2r:shared',
  operation: 'replace',
  revision: 3,
  payload: { snapshot: 'v3' },
});
```

**Remote B**

```typescript
const bus = window.__MFE_BRIDGE__?.getBus();
if (!bus) {
  throw new Error('bus missing');
}

bus.subscribe<StateMessage<{ snapshot: string }>>(
  'usage:r2r:state',
  (msg) => {
    console.log(msg.payload.snapshot);
  },
  { subscriberId: 'remote-b' },
);
```

### 3.5 `user-context`

**Remote A**

```typescript
const bridge = window.__MFE_BRIDGE__;
if (!bridge) {
  throw new Error('bridge missing');
}

bridge.tryPublish({
  messageName: 'usage:r2r:user-context',
  messageVersion: 1,
  messageId: '',
  correlationId: '',
  source: 'remote-a',
  target: 'remote-b',
  occurredAtUtc: '',
  kind: 'user-context',
  sensitivity: 'public',
  payload: {
    userId: 'u-shared',
    displayName: 'Shared Label',
    rolesForUi: ['guest'],
  },
});
```

**Remote B**

```typescript
const bus = window.__MFE_BRIDGE__?.getBus();
if (!bus) {
  throw new Error('bus missing');
}

bus.subscribe<UserContextMessage>(
  'usage:r2r:user-context',
  (m) => {
    console.log(m.payload.displayName);
  },
  { subscriberId: 'remote-b' },
);
```

---

## Small closing note

If you wire this in Angular, the idea is the same: `provideBus` + `provideHostBridge` on the host, and in the remote bundle you still read `window.__MFE_BRIDGE__` after the shell loaded. The `tryPublish` path is nice on remote because metadata can be empty strings and the bridge fills UUIDs and timestamp for you.

When something does not arrive, first check you really use **one** bus, second check `target` and `subscriberId` spelling matches exactly what you think.
