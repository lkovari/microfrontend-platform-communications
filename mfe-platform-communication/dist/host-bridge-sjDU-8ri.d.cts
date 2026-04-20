import { M as MessageBase } from './state-message-CmaW-XS3.cjs';
import { a as AckResult } from './envelopes-77I3VM33.cjs';
import { B as Bus, S as StateSyncAttachOptions } from './state-sync-ypuRcM0l.cjs';

declare const MFE_BRIDGE_PROTOCOL_VERSION: 1;
interface MfeBridgeHandle {
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
interface CreateHostBridgeOptions {
    readonly appId: string;
    readonly bus: Bus;
    readonly remotes: readonly string[];
    readonly stateSync?: StateSyncAttachOptions;
}
declare function createHostBridge(options: CreateHostBridgeOptions): MfeBridgeHandle;

export { type CreateHostBridgeOptions as C, MFE_BRIDGE_PROTOCOL_VERSION as M, type MfeBridgeHandle as a, createHostBridge as c };
