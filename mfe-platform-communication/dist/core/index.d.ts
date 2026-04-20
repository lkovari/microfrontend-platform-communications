export { B as Bus, a as BusPublisher, b as BusSubscribeOptions, c as BusSubscriber, C as ConflictStrategy, d as CreateBusOptions, D as DispatchMode, M as MessageQueue, S as StateSyncAttachOptions, e as StateSyncCoordinator, f as StateSyncCustomContext, T as TopicRegistration, g as TopicRegistry, U as Unsubscribe, h as attachStateSync, i as createBus, j as createMessageQueue } from '../state-sync-DKBsV3AK.js';
import { B as BusErrorCode } from '../envelopes-77I3VM33.js';
import { M as MessageBase } from '../state-message-CmaW-XS3.js';
export { C as CreateHostBridgeOptions, M as MFE_BRIDGE_PROTOCOL_VERSION, a as MfeBridgeHandle, c as createHostBridge } from '../host-bridge-COmKa1Gu.js';
import 'zod';

interface DedupeGate {
    shouldDrop(messageId: string, nowMs: number): boolean;
}
declare function createDedupeGate(windowMs: number): DedupeGate;

declare class BusPolicyError extends Error {
    readonly code: BusErrorCode;
    constructor(message: string, code?: BusErrorCode);
}
declare class BusValidationError extends Error {
    readonly code: BusErrorCode;
    constructor(message: string, code?: BusErrorCode);
}

declare function defaultSensitivityPolicy(message: MessageBase): void;
declare function composePolicies(...policies: ((message: MessageBase) => void)[]): (message: MessageBase) => void;

declare class RequestResponseCoordinator {
    private readonly pendingByCausationId;
    waitForResponse(causationId: string, timeoutMs: number): Promise<MessageBase>;
    tryResolve(incoming: MessageBase): boolean;
    dispose(): void;
}

export { BusPolicyError, BusValidationError, type DedupeGate, RequestResponseCoordinator, composePolicies, createDedupeGate, defaultSensitivityPolicy };
