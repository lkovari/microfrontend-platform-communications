import { Injectable, inject } from '@angular/core';
import type { MessageBase } from '../contracts/message-base.js';
import type { AckResult } from '../contracts/envelopes.js';
import { HOST_BRIDGE_TOKEN } from './provide-host-bridge.js';

@Injectable({ providedIn: 'root' })
export class HostBridgeService {
  private readonly bridge = inject(HOST_BRIDGE_TOKEN);

  tryPublish(message: MessageBase): AckResult {
    return this.bridge.tryPublish(message);
  }

  getBus() {
    return this.bridge.getBus();
  }
}
