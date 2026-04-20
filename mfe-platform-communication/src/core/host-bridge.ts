import type { MessageBase } from '../contracts/message-base.js';
import type { AckResult } from '../contracts/envelopes.js';
import type { Bus } from './bus.js';
import { BusPolicyError, BusValidationError } from './errors.js';
import { attachStateSync, type StateSyncAttachOptions, type StateSyncCoordinator } from './state-sync.js';

export const MFE_BRIDGE_PROTOCOL_VERSION = 1 as const;

export interface MfeBridgeHandle {
  readonly protocolVersion: typeof MFE_BRIDGE_PROTOCOL_VERSION;
  readonly appId: string;
  readonly remotes: readonly string[];
  readonly getBus: () => Bus;
  tryPublish: (message: MessageBase) => AckResult;
  dispose: () => void;
}

declare global {
  interface Window {
    __MFE_BRIDGE__?: MfeBridgeHandle;
  }
}

export interface CreateHostBridgeOptions {
  readonly appId: string;
  readonly bus: Bus;
  readonly remotes: readonly string[];
  readonly stateSync?: StateSyncAttachOptions;
}

function withGeneratedIds(message: MessageBase): MessageBase {
  return {
    ...message,
    messageId: message.messageId || crypto.randomUUID(),
    correlationId: message.correlationId || crypto.randomUUID(),
    occurredAtUtc: message.occurredAtUtc || new Date().toISOString(),
  };
}

function toAckResult(correlationId: string, err: unknown): AckResult {
  const receivedAtUtc = new Date().toISOString();
  if (err instanceof BusPolicyError) {
    return {
      ok: false,
      correlationId,
      errorCode: err.code,
      message: err.message,
      receivedAtUtc,
    };
  }
  if (err instanceof BusValidationError) {
    return {
      ok: false,
      correlationId,
      errorCode: err.code,
      message: err.message,
      receivedAtUtc,
    };
  }
  return {
    ok: false,
    correlationId,
    errorCode: 'unknown',
    message: err instanceof Error ? err.message : 'unknown error',
    receivedAtUtc,
  };
}

export function createHostBridge(options: CreateHostBridgeOptions): MfeBridgeHandle {
  let stateCoordinator: StateSyncCoordinator | undefined;
  if (options.stateSync) {
    stateCoordinator = attachStateSync(options.bus, options.stateSync);
  }

  const handle: MfeBridgeHandle = {
    protocolVersion: MFE_BRIDGE_PROTOCOL_VERSION,
    appId: options.appId,
    remotes: options.remotes,
    getBus: () => options.bus,
    tryPublish: (message: MessageBase) => {
      const correlationId = message.correlationId || crypto.randomUUID();
      try {
        const normalized = withGeneratedIds({
          ...message,
          correlationId,
        });
        options.bus.publish(normalized);
        return {
          ok: true,
          correlationId: normalized.correlationId,
          receivedAtUtc: new Date().toISOString(),
        };
      } catch (err) {
        return toAckResult(correlationId, err);
      }
    },
    dispose: () => {
      stateCoordinator?.dispose();
      if (typeof window !== 'undefined' && window.__MFE_BRIDGE__ === handle) {
        delete window.__MFE_BRIDGE__;
      }
    },
  };

  if (typeof window !== 'undefined') {
    window.__MFE_BRIDGE__ = handle;
  }

  return handle;
}
