import type { StateMessage } from '../contracts/state-message.js';
import type { MessageBase } from '../contracts/message-base.js';
import type { Bus } from './bus.js';
import { BusValidationError } from './errors.js';

export type ConflictStrategy = 'last-writer-wins' | 'reject-if-stale' | 'custom';

export interface StateSyncCustomContext<TSnapshot> {
  readonly stateKey: string;
  readonly incoming: StateMessage;
  readonly currentRevision: number;
  readonly currentSnapshot: TSnapshot | undefined;
}

export interface StateSyncAttachOptions {
  readonly enabled: boolean;
  readonly initialRevisions?: Readonly<Record<string, number>>;
  readonly initialSnapshots?: Readonly<Record<string, unknown>>;
  readonly conflictStrategy?: ConflictStrategy;
  readonly customConflict?: <TSnapshot>(
    ctx: StateSyncCustomContext<TSnapshot>,
  ) => 'accept' | 'reject';
}

export interface StateSyncCoordinator {
  readonly getRevision: (stateKey: string) => number | undefined;
  readonly getSnapshot: <T>(stateKey: string) => T | undefined;
  readonly dispose: () => void;
}

function isMergeObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  return true;
}

function mergePatch(target: unknown, patch: unknown): unknown {
  if (!isMergeObject(patch)) {
    return patch;
  }
  const base = isMergeObject(target) ? target : {};
  const merged: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) {
      delete merged[key];
      continue;
    }
    merged[key] = mergePatch(merged[key], value);
  }
  return merged;
}

export function attachStateSync(bus: Bus, options: StateSyncAttachOptions): StateSyncCoordinator {
  if (!options.enabled) {
    return {
      getRevision: () => undefined,
      getSnapshot: () => undefined,
      dispose: () => undefined,
    };
  }

  const strategy: ConflictStrategy = options.conflictStrategy ?? 'last-writer-wins';
  const revisions = new Map<string, number>(
    options.initialRevisions ? Object.entries(options.initialRevisions) : [],
  );
  const snapshots = new Map<string, unknown>(
    options.initialSnapshots ? Object.entries(options.initialSnapshots) : [],
  );

  function applyReplace<T>(stateKey: string, incoming: StateMessage): void {
    const currentRev = revisions.get(stateKey) ?? 0;
    const incomingRev = incoming.revision;

    if (strategy === 'reject-if-stale' && incomingRev <= currentRev) {
      throw new BusValidationError('stale state revision', 'delivery');
    }

    if (strategy === 'custom' && options.customConflict) {
      const decision = options.customConflict<T>({
        stateKey,
        incoming,
        currentRevision: currentRev,
        currentSnapshot: snapshots.get(stateKey) as T | undefined,
      });
      if (decision === 'reject') {
        throw new BusValidationError('state conflict rejected', 'delivery');
      }
    }

    revisions.set(stateKey, incomingRev);
    snapshots.set(stateKey, incoming.payload);
  }

  function applyPatch(stateKey: string, incoming: StateMessage): void {
    const current = snapshots.get(stateKey);
    const merged = mergePatch(current, incoming.payload);
    const synthetic: StateMessage = {
      ...incoming,
      operation: 'replace',
      payload: merged,
    };
    applyReplace(stateKey, synthetic);
  }

  const off = bus.registerBeforeDeliver((message: MessageBase) => {
    if (message.kind !== 'state') {
      return;
    }
    const stateMessage = message as StateMessage;
    const key = stateMessage.stateKey;
    if (stateMessage.operation === 'replace') {
      applyReplace(key, stateMessage);
      return;
    }
    if (stateMessage.operation === 'patch') {
      applyPatch(key, stateMessage);
      return;
    }
    if (stateMessage.operation === 'remove') {
      revisions.delete(key);
      snapshots.delete(key);
      return;
    }
    if (stateMessage.operation === 'reset') {
      revisions.set(key, 0);
      snapshots.delete(key);
    }
  });

  return {
    getRevision: (stateKey: string) => revisions.get(stateKey),
    getSnapshot: <T>(stateKey: string) => snapshots.get(stateKey) as T | undefined,
    dispose: () => {
      off();
    },
  };
}
