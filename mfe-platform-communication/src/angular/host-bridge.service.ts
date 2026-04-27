import { Injectable, inject } from '@angular/core';
import type { MessageBase } from '../contracts/message-base.js';
import type { AckResult } from '../contracts/envelopes.js';
import type { Bus } from '../core/bus.js';
import { HOST_BRIDGE_TOKEN } from './provide-host-bridge.js';

@Injectable({ providedIn: 'root' })
export class HostBridgeService {
  private readonly bridge = inject(HOST_BRIDGE_TOKEN, { optional: true });

  private get requiredBridge() {
    if (this.bridge === null) {
      throw new Error(
        'HostBridgeService requires HOST_BRIDGE_TOKEN. Call provideHostBridge() in your application providers before injecting HostBridgeService.',
      );
    }
    return this.bridge;
  }

  tryPublish(message: MessageBase): AckResult {
    return this.requiredBridge.tryPublish(message);
  }

  getBus(): Bus {
    return this.requiredBridge.getBus();
  }
}
