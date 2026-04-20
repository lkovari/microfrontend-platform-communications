import { InjectionKey, App } from 'vue';
import { B as Bus, d as CreateBusOptions, b as BusSubscribeOptions } from '../state-sync-DKBsV3AK.js';
import { a as MfeBridgeHandle, C as CreateHostBridgeOptions } from '../host-bridge-COmKa1Gu.js';
import { M as MessageBase } from '../state-message-CmaW-XS3.js';
import 'zod';
import '../envelopes-77I3VM33.js';

declare const BusKey: InjectionKey<Bus>;
declare function createBusPlugin(options: CreateBusOptions): {
    install(app: App): void;
};

declare const HostBridgeKey: InjectionKey<MfeBridgeHandle>;
declare function createHostBridgePlugin(options: Omit<CreateHostBridgeOptions, 'bus' | 'appId'>): {
    install(app: App): void;
};

declare function useBus(): Bus;

declare function useSubscribe<M extends MessageBase>(messageName: string, handler: (message: M) => void | Promise<void>, subscribeOptions?: BusSubscribeOptions): void;

export { BusKey, HostBridgeKey, createBusPlugin, createHostBridgePlugin, useBus, useSubscribe };
