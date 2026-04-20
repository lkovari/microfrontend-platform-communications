import * as react from 'react';
import { ReactNode } from 'react';
import { B as Bus, d as CreateBusOptions, S as StateSyncAttachOptions, b as BusSubscribeOptions } from '../state-sync-DKBsV3AK.js';
import * as react_jsx_runtime from 'react/jsx-runtime';
import { M as MessageBase } from '../state-message-CmaW-XS3.js';
import 'zod';

declare const BusContext: react.Context<Bus | null>;

type BusProviderProps = CreateBusOptions & {
    readonly children: ReactNode;
};
declare function BusProvider(props: BusProviderProps): react_jsx_runtime.JSX.Element;

declare function HostBridgeProvider(props: {
    readonly remotes: readonly string[];
    readonly stateSync?: StateSyncAttachOptions;
    readonly children: ReactNode;
}): ReactNode;

declare function useBus(): Bus;

declare function useSubscribe<M extends MessageBase>(messageName: string, handler: (message: M) => void | Promise<void>, subscribeOptions?: BusSubscribeOptions): void;

declare function usePublish(): <M extends MessageBase>(message: M) => void;

export { BusContext, BusProvider, type BusProviderProps, HostBridgeProvider, useBus, usePublish, useSubscribe };
