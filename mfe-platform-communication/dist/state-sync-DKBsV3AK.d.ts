import { M as MessageBase, b as StateMessage } from './state-message-CmaW-XS3.js';
import { ZodTypeAny } from 'zod';

type DispatchMode = 'sync' | 'microtask';
interface MessageQueue {
    enqueue(task: () => void): void;
}
declare function createMessageQueue(mode: DispatchMode): MessageQueue;

interface TopicRegistration {
    readonly messageName: string;
    readonly allowedPublishers?: readonly string[];
    readonly allowedSubscribers?: readonly string[];
    readonly minMessageVersion?: number;
    readonly maxMessageVersion?: number;
}
declare class TopicRegistry {
    private readonly topics;
    register(registration: TopicRegistration): void;
    assertCanPublish(message: MessageBase): void;
    assertCanSubscribe(messageName: string, subscriberId: string): void;
}

type Unsubscribe = () => void;
interface BusPublisher {
    publish<M extends MessageBase>(message: M): void;
    request<TReq extends MessageBase, TRes extends MessageBase>(message: TReq, timeoutMs?: number): Promise<TRes>;
}
interface BusSubscribeOptions {
    readonly subscriberId?: string;
}
interface BusSubscriber {
    subscribe<M extends MessageBase>(messageName: string, handler: (message: M) => void | Promise<void>, options?: BusSubscribeOptions): Unsubscribe;
}
interface Bus extends BusPublisher, BusSubscriber {
    readonly appId: string;
    observeAll(handler: (message: MessageBase) => void): Unsubscribe;
    registerBeforeDeliver(handler: (message: MessageBase) => void): Unsubscribe;
    dispose(): void;
}
interface CreateBusOptions {
    readonly appId: string;
    readonly defaultSubscriberId?: string;
    readonly dispatch?: DispatchMode;
    readonly dedupe?: {
        enabled: boolean;
        windowMs: number;
    };
    readonly validators: Readonly<Record<string, ZodTypeAny>>;
    readonly policy?: (message: MessageBase) => void;
    readonly registry?: TopicRegistry;
    readonly allowUnregisteredMessageNames?: boolean;
    readonly messageTtlMs?: number;
    readonly enableDefaultSensitivityPolicy?: boolean;
    readonly onDispatchError?: (error: unknown) => void;
}
declare function createBus(options: CreateBusOptions): Bus;

type ConflictStrategy = 'last-writer-wins' | 'reject-if-stale' | 'custom';
interface StateSyncCustomContext<TSnapshot> {
    readonly stateKey: string;
    readonly incoming: StateMessage<TSnapshot>;
    readonly currentRevision: number;
    readonly currentSnapshot: TSnapshot | undefined;
}
interface StateSyncAttachOptions {
    readonly enabled: boolean;
    readonly initialRevisions?: Readonly<Record<string, number>>;
    readonly initialSnapshots?: Readonly<Record<string, unknown>>;
    readonly conflictStrategy?: ConflictStrategy;
    readonly customConflict?: <TSnapshot>(ctx: StateSyncCustomContext<TSnapshot>) => 'accept' | 'reject';
}
interface StateSyncCoordinator {
    readonly getRevision: (stateKey: string) => number | undefined;
    readonly getSnapshot: <T>(stateKey: string) => T | undefined;
    readonly dispose: () => void;
}
declare function attachStateSync(bus: Bus, options: StateSyncAttachOptions): StateSyncCoordinator;

export { type Bus as B, type ConflictStrategy as C, type DispatchMode as D, type MessageQueue as M, type StateSyncAttachOptions as S, type TopicRegistration as T, type Unsubscribe as U, type BusPublisher as a, type BusSubscribeOptions as b, type BusSubscriber as c, type CreateBusOptions as d, type StateSyncCoordinator as e, type StateSyncCustomContext as f, TopicRegistry as g, attachStateSync as h, createBus as i, createMessageQueue as j };
