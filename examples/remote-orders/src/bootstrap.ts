import { isValidMfeBridgeHandle } from '@lkovari/microfrontend-platform-communication/core';

const bridge = window.__MFE_BRIDGE__;
if (!isValidMfeBridgeHandle(bridge)) {
  throw new Error('remote-orders: invalid window.__MFE_BRIDGE__');
}

const bus = bridge.getBus();
let received = 0;

bus.subscribe(
  'orders:filters-changed',
  (message) => {
    received += 1;
    const el = document.getElementById('remote-log');
    if (el) {
      el.textContent = `remote received (${received}): ${JSON.stringify(message)}`;
    }
  },
  { subscriberId: 'remote-orders' },
);

const publishResult = bridge.tryPublish({
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

const statusEl = document.getElementById('remote-status');
if (statusEl) {
  statusEl.textContent = publishResult.accepted
    ? 'remote connected and published person:updated'
    : `remote publish failed: ${publishResult.accepted === false ? publishResult.message : 'unknown'}`;
}
