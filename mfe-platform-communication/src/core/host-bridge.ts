import type { MessageBase } from '../contracts/message-base.js';
import type { AckResult } from '../contracts/envelopes.js';
import type { Bus } from './bus.js';
import { BusPolicyError, BusValidationError, HostBridgeError } from './errors.js';
import {
  attachStateSync,
  type StateSyncAttachOptions,
  type StateSyncCoordinator,
} from './state-sync.js';

export const MFE_BRIDGE_PROTOCOL_VERSION = 1 as const;

export interface MfeBridgeHandle {
  readonly protocolVersion: typeof MFE_BRIDGE_PROTOCOL_VERSION;
  readonly appId: string;
  readonly remotes: readonly string[];
  readonly stateSync?: StateSyncAttachOptions;
  readonly getBus: (token?: string) => Bus;
  readonly getSnapshot?: (stateKey: string) => unknown;
  tryPublish: (message: MessageBase, token?: string) => AckResult;
  dispose: () => void;
}

declare global {
  interface Window {
    __MFE_BRIDGE__?: MfeBridgeHandle;
  }
}

export type HostBridgeConflictPolicy = 'throw' | 'return-existing' | 'replace';

export interface CreateHostBridgeOptions {
  readonly appId: string;
  readonly bus: Bus;
  readonly remotes: readonly string[];
  readonly stateSync?: StateSyncAttachOptions;
  readonly onConflict?: HostBridgeConflictPolicy;
  readonly accessToken?: string;
}

const ACCESS_TOKEN_BYTES = 16;

export function generateAccessToken(): string {
  const bytes = new Uint8Array(ACCESS_TOKEN_BYTES);
  crypto.getRandomValues(bytes);
  let out = '';
  for (const byte of bytes) {
    out += byte.toString(16).padStart(2, '0');
  }
  return out;
}

function tokensEqual(expected: string, provided: string | undefined): boolean {
  if (typeof provided !== 'string') {
    return false;
  }
  if (expected.length !== provided.length) {
    return false;
  }
  let mismatch = 0;
  for (let i = 0; i < expected.length; i += 1) {
    mismatch |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
  }
  return mismatch === 0;
}

function withGeneratedIds(message: MessageBase): MessageBase {
  return {
    ...message,
    messageId: message.messageId ?? crypto.randomUUID(),
    correlationId: message.correlationId ?? crypto.randomUUID(),
    occurredAtUtc: message.occurredAtUtc ?? new Date().toISOString(),
  };
}

function toAckResult(correlationId: string, err: unknown): AckResult {
  const receivedAtUtc = new Date().toISOString();
  if (err instanceof HostBridgeError && err.code === 'unauthorized') {
    return {
      accepted: false,
      correlationId,
      errorCode: 'unauthorized',
      message: err.message,
      receivedAtUtc,
    };
  }
  if (err instanceof BusPolicyError) {
    return {
      accepted: false,
      correlationId,
      errorCode: err.code,
      message: err.message,
      receivedAtUtc,
    };
  }
  if (err instanceof BusValidationError) {
    return {
      accepted: false,
      correlationId,
      errorCode: err.code,
      message: err.message,
      receivedAtUtc,
    };
  }
  return {
    accepted: false,
    correlationId,
    errorCode: 'unknown',
    message: err instanceof Error ? err.message : 'unknown error',
    receivedAtUtc,
  };
}

function remotesEqual(a: readonly string[] | undefined, b: readonly string[] | undefined): boolean {
  if (a === undefined && b === undefined) {
    return true;
  }
  if (a === undefined || b === undefined) {
    return false;
  }
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}

function stateSyncMatches(
  a: StateSyncAttachOptions | undefined,
  b: StateSyncAttachOptions | undefined,
): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function isValidMfeBridgeHandle(value: unknown): value is MfeBridgeHandle {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  if (Reflect.get(value, 'protocolVersion') !== MFE_BRIDGE_PROTOCOL_VERSION) {
    return false;
  }
  const appIdUnknown: unknown = Reflect.get(value, 'appId');
  if (typeof appIdUnknown !== 'string' || appIdUnknown.length === 0) {
    return false;
  }
  if (!Array.isArray(Reflect.get(value, 'remotes'))) {
    return false;
  }
  if (
    typeof Reflect.get(value, 'getBus') !== 'function' ||
    typeof Reflect.get(value, 'tryPublish') !== 'function' ||
    typeof Reflect.get(value, 'dispose') !== 'function'
  ) {
    return false;
  }
  return true;
}

function assertReturnableExisting(
  existing: MfeBridgeHandle,
  options: CreateHostBridgeOptions,
): void {
  if (existing.appId !== options.appId) {
    throw new HostBridgeError(
      'Existing host bridge has a different appId; cannot reuse with onConflict: return-existing',
      'mismatch',
    );
  }
  if (existing.getBus(options.accessToken) !== options.bus) {
    throw new HostBridgeError(
      'Existing host bridge is bound to a different bus instance; cannot reuse with onConflict: return-existing',
      'mismatch',
    );
  }
  if (!remotesEqual(options.remotes, existing.remotes)) {
    throw new HostBridgeError(
      'Existing host bridge has different remotes; cannot reuse with onConflict: return-existing',
      'mismatch',
    );
  }
  if (!stateSyncMatches(options.stateSync, existing.stateSync)) {
    throw new HostBridgeError(
      'Existing host bridge has different stateSync options; cannot reuse with onConflict: return-existing',
      'mismatch',
    );
  }
}

function resolveWindowConflict(
  options: CreateHostBridgeOptions,
  mode: HostBridgeConflictPolicy,
): MfeBridgeHandle | null {
  if (typeof window === 'undefined') {
    return null;
  }
  const existing = window.__MFE_BRIDGE__;
  if (existing === undefined) {
    return null;
  }

  if (mode === 'return-existing') {
    if (!isValidMfeBridgeHandle(existing)) {
      throw new HostBridgeError(
        'window.__MFE_BRIDGE__ is not a valid MfeBridgeHandle. Remove it, use onConflict: replace, or fix the page script that set it.',
        'invalid-global',
      );
    }
    assertReturnableExisting(existing, options);
    return existing;
  }

  if (mode === 'throw') {
    if (!isValidMfeBridgeHandle(existing)) {
      throw new HostBridgeError(
        'window.__MFE_BRIDGE__ is already set to an invalid value. Remove it or use onConflict: replace before initializing the host bridge.',
        'invalid-global',
      );
    }
    throw new HostBridgeError(
      'Host bridge already initialized. Dispose the existing handle, use onConflict: return-existing with matching options, or onConflict: replace.',
      'conflict',
    );
  }

  if (isValidMfeBridgeHandle(existing)) {
    existing.dispose();
  } else {
    delete window.__MFE_BRIDGE__;
  }
  return null;
}

export function createHostBridge(options: CreateHostBridgeOptions): MfeBridgeHandle {
  const mode: HostBridgeConflictPolicy = options.onConflict ?? 'throw';

  if (typeof window !== 'undefined') {
    const early = resolveWindowConflict(options, mode);
    if (early) {
      return early;
    }
  }

  let stateCoordinator: StateSyncCoordinator | undefined;
  if (options.stateSync) {
    stateCoordinator = attachStateSync(options.bus, options.stateSync);
  }

  const accessToken = options.accessToken;

  function assertAuthorized(token: string | undefined): void {
    if (accessToken === undefined) {
      return;
    }
    if (!tokensEqual(accessToken, token)) {
      throw new HostBridgeError(
        'Access denied: a valid host bridge access token is required to use the bus.',
        'unauthorized',
      );
    }
  }

  const handle: MfeBridgeHandle = {
    protocolVersion: MFE_BRIDGE_PROTOCOL_VERSION,
    appId: options.appId,
    remotes: options.remotes,
    ...(options.stateSync ? { stateSync: options.stateSync } : {}),
    getBus: (token?: string) => {
      assertAuthorized(token);
      return options.bus;
    },
    tryPublish: (message: MessageBase, token?: string) => {
      const correlationId = message.correlationId ?? crypto.randomUUID();
      const receivedAtUtc = new Date().toISOString();
      try {
        assertAuthorized(token);
        const normalized = withGeneratedIds({
          ...message,
          correlationId,
        });
        const outcome = options.bus.attemptPublish(normalized);
        if (outcome.status === 'dedupe') {
          return {
            accepted: false,
            correlationId: normalized.correlationId,
            errorCode: 'dedupe',
            message: 'duplicate messageId',
            receivedAtUtc,
          };
        }
        if (outcome.status === 'rejected') {
          return {
            accepted: false,
            correlationId: normalized.correlationId,
            errorCode: 'delivery',
            message: 'publish rejected',
            receivedAtUtc,
          };
        }
        return {
          accepted: true,
          correlationId: normalized.correlationId,
          receivedAtUtc,
        };
      } catch (err) {
        return toAckResult(correlationId, err);
      }
    },
    ...(stateCoordinator
      ? {
          getSnapshot: (stateKey: string) => stateCoordinator.getSnapshot(stateKey),
        }
      : {}),
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
