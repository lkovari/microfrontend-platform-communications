import {
  createBus,
  createHostBridge,
  MFE_BRIDGE_PROTOCOL_VERSION,
} from '@lkovari/microfrontend-platform-communication/core';
import { EventMessageSchema } from '@lkovari/microfrontend-platform-communication/schemas';

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

bus.subscribe('person:updated', (message) => {
  const el = document.getElementById('host-log');
  if (el) {
    el.textContent = `host received: ${JSON.stringify(message)}`;
  }
});

document.getElementById('host-status')?.replaceChildren(
  document.createTextNode(`bridge v${MFE_BRIDGE_PROTOCOL_VERSION} ready`),
);

void import('remoteOrders/bootstrap');
