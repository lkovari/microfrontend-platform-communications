import * as _angular_core from '@angular/core';
import { InjectionToken } from '@angular/core';
import { B as Bus, d as CreateBusOptions, b as BusSubscribeOptions } from '../state-sync-ypuRcM0l.cjs';
import { a as MfeBridgeHandle, C as CreateHostBridgeOptions } from '../host-bridge-sjDU-8ri.cjs';
import { M as MessageBase } from '../state-message-CmaW-XS3.cjs';
import { Observable } from 'rxjs';
import { a as AckResult } from '../envelopes-77I3VM33.cjs';
import 'zod';

declare const BUS_TOKEN: InjectionToken<Bus>;
declare function provideBus(options: CreateBusOptions): _angular_core.EnvironmentProviders;
declare function injectBus(): Bus;

declare const HOST_BRIDGE_TOKEN: InjectionToken<MfeBridgeHandle>;
declare function provideHostBridge(options: Omit<CreateHostBridgeOptions, 'bus' | 'appId'>): _angular_core.EnvironmentProviders;

declare class BusService {
    private readonly bus;
    publish<M extends MessageBase>(message: M): void;
    request<TReq extends MessageBase, TRes extends MessageBase>(message: TReq, timeoutMs?: number): Promise<TRes>;
    messages$<M extends MessageBase>(messageName: string, subscribeOptions?: BusSubscribeOptions): Observable<M>;
}

declare class HostBridgeService {
    private readonly bridge;
    tryPublish(message: MessageBase): AckResult;
    getBus(): Bus;
}

export { BUS_TOKEN, BusService, HOST_BRIDGE_TOKEN, HostBridgeService, injectBus, provideBus, provideHostBridge };
