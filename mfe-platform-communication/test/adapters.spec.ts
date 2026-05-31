import '@angular/compiler';
import { afterEach, describe, expect, it } from 'vitest';
import { createEnvironmentInjector, Injector, type EnvironmentInjector } from '@angular/core';
import { Injector as LegacyInjector } from '@angular/core';
import { createElement } from 'react';
import { render, cleanup, act } from '@testing-library/react';
import { createApp, defineComponent, ref } from 'vue';
import { createBus } from '../src/core/bus.js';
import type { Bus } from '../src/core/bus.js';
import {
  BUS_TOKEN,
  BusService,
  HostBridgeService,
  provideBus,
  provideHostBridge,
  provideRemotePlatformBus,
} from '../src/angular/index.js';
import { BusProvider, HostBridgeProvider, useBus, usePublish, useSubscribe } from '../src/react/index.js';
import {
  createBusPlugin,
  createHostBridgePlugin,
  useBus as useVueBus,
  useSubscribe as useVueSubscribe,
} from '../src/vue/index.js';
import type { EventMessage } from '../src/contracts/event-message.js';
import type { CommandMessage } from '../src/contracts/command-message.js';
import type { MessageBase } from '../src/contracts/message-base.js';
import { createHostBridge, generateAccessToken } from '../src/core/host-bridge.js';
import { CommandMessageSchema } from '../src/schemas/command-message.schema.js';
import { OrdersFiltersEventSchema } from './helpers.js';

function createTestEnvironmentInjector(
  providers: Parameters<typeof createEnvironmentInjector>[0],
): EnvironmentInjector {
  return createEnvironmentInjector(providers, Injector.NULL as EnvironmentInjector);
}

describe('framework adapters', () => {
  afterEach(() => {
    cleanup();
  });

  it('Angular BusService wires Observable unsubscribe to bus subscription', () => {
    const injector = Injector.create({
      providers: [
        {
          provide: BUS_TOKEN,
          useFactory: () =>
            createBus({
              appId: 'shell',
              dispatch: 'sync',
              validators: {
                'orders:filters-changed': OrdersFiltersEventSchema,
              },
            }),
        },
        BusService,
      ],
    });
    const busSvc = injector.get(BusService);
    let count = 0;
    const sub = busSvc
      .messages$('orders:filters-changed')
      .subscribe(() => {
        count += 1;
      });
    busSvc.publish<EventMessage<{ filter: string }>>({
      messageName: 'orders:filters-changed',
      messageVersion: 1,
      messageId: crypto.randomUUID(),
      correlationId: crypto.randomUUID(),
      source: 'x',
      occurredAtUtc: new Date().toISOString(),
      kind: 'event',
      eventKind: 'orders.filters-changed',
      sensitivity: 'public',
      payload: { filter: 'open' },
    });
    expect(count).toBe(1);
    sub.unsubscribe();
    busSvc.publish<EventMessage<{ filter: string }>>({
      messageName: 'orders:filters-changed',
      messageVersion: 1,
      messageId: crypto.randomUUID(),
      correlationId: crypto.randomUUID(),
      source: 'x',
      occurredAtUtc: new Date().toISOString(),
      kind: 'event',
      eventKind: 'orders.filters-changed',
      sensitivity: 'public',
      payload: { filter: 'open' },
    });
    expect(count).toBe(1);
    injector.get(BUS_TOKEN).dispose();
  });

  it('Angular BusService throws readable error when provideBus is missing', () => {
    const injector = Injector.create({
      providers: [BusService],
    });
    const busSvc = injector.get(BusService);
    expect(() =>
      busSvc.publish<EventMessage<{ filter: string }>>({
        messageName: 'orders:filters-changed',
        messageVersion: 1,
        messageId: crypto.randomUUID(),
        correlationId: crypto.randomUUID(),
        source: 'x',
        occurredAtUtc: new Date().toISOString(),
        kind: 'event',
        eventKind: 'orders.filters-changed',
        sensitivity: 'public',
        payload: { filter: 'open' },
      }),
    ).toThrow('Call provideBus() in your application providers before injecting BusService.');
    expect(() =>
      busSvc.request({
        messageName: 'orders:filters-changed',
        messageVersion: 1,
        messageId: crypto.randomUUID(),
        correlationId: crypto.randomUUID(),
        source: 'x',
        occurredAtUtc: new Date().toISOString(),
        kind: 'event',
        eventKind: 'orders.filters-changed',
        sensitivity: 'public',
        payload: { filter: 'open' },
      }),
    ).toThrow('Call provideBus() in your application providers before injecting BusService.');
    let didError = false;
    busSvc.messages$('orders:filters-changed').subscribe({
      error: () => {
        didError = true;
      },
    });
    expect(didError).toBe(true);
  });

  it('Angular HostBridgeService throws readable error when provideHostBridge is missing', () => {
    const injector = Injector.create({
      providers: [
        {
          provide: BUS_TOKEN,
          useFactory: () =>
            createBus({
              appId: 'shell',
              dispatch: 'sync',
              validators: {},
              allowUnregisteredMessageNames: true,
            }),
        },
        HostBridgeService,
      ],
    });
    const service = injector.get(HostBridgeService);
    expect(() => service.getBus()).toThrow(
      'Call provideHostBridge() in your application providers before injecting HostBridgeService.',
    );
    expect(() =>
      service.tryPublish({
        messageName: 'orders:filters-changed',
        messageVersion: 1,
        messageId: crypto.randomUUID(),
        correlationId: crypto.randomUUID(),
        source: 'x',
        occurredAtUtc: new Date().toISOString(),
        kind: 'event',
        sensitivity: 'public',
      } satisfies MessageBase),
    ).toThrow('Call provideHostBridge() in your application providers before injecting HostBridgeService.');
    injector.get(BUS_TOKEN).dispose();
  });

  it('React useSubscribe cleans up on unmount', () => {
    let count = 0;
    let bus: Bus | null = null;

    function Probe() {
      bus = useBus();
      useSubscribe('orders:filters-changed', () => {
        count += 1;
      });
      return null;
    }

    const ui = render(
      createElement(BusProvider, {
        appId: 'shell',
        dispatch: 'sync',
        validators: { 'orders:filters-changed': OrdersFiltersEventSchema },
        children: createElement(Probe),
      }),
    );

    act(() => {
      bus?.publish<EventMessage<{ filter: string }>>({
        messageName: 'orders:filters-changed',
        messageVersion: 1,
        messageId: crypto.randomUUID(),
        correlationId: crypto.randomUUID(),
        source: 'x',
        occurredAtUtc: new Date().toISOString(),
        kind: 'event',
        eventKind: 'orders.filters-changed',
        sensitivity: 'public',
        payload: { filter: 'open' },
      });
    });
    expect(count).toBe(1);

    ui.unmount();

    act(() => {
      bus?.publish<EventMessage<{ filter: string }>>({
        messageName: 'orders:filters-changed',
        messageVersion: 1,
        messageId: crypto.randomUUID(),
        correlationId: crypto.randomUUID(),
        source: 'x',
        occurredAtUtc: new Date().toISOString(),
        kind: 'event',
        eventKind: 'orders.filters-changed',
        sensitivity: 'public',
        payload: { filter: 'open' },
      });
    });
    expect(count).toBe(1);
  });

  it('React HostBridgeProvider does not recreate bridge when remotes values are unchanged', () => {
    function Probe(props: { readonly tick: number }) {
      return createElement(HostBridgeProvider, {
        remotes: ['remote-a'],
        children: createElement('span', { 'data-testid': `tick-${props.tick}` }),
      });
    }

    const ui = render(
      createElement(BusProvider, {
        appId: 'shell',
        dispatch: 'sync',
        validators: {},
        allowUnregisteredMessageNames: true,
        children: createElement(Probe, { tick: 1 }),
      }),
    );

    expect(window.__MFE_BRIDGE__).toBeDefined();

    expect(() =>
      ui.rerender(
        createElement(BusProvider, {
          appId: 'shell',
          dispatch: 'sync',
          validators: {},
          allowUnregisteredMessageNames: true,
          children: createElement(Probe, { tick: 2 }),
        }),
      ),
    ).not.toThrow();

    ui.unmount();
  });

  it('React useSubscribe uses the latest inline handler closure after rerender', () => {
    const received: string[] = [];
    let bus: Bus | null = null;

    function Probe(props: { readonly label: string }) {
      bus = useBus();
      useSubscribe('orders:filters-changed', () => {
        received.push(props.label);
      });
      return null;
    }

    const ui = render(
      createElement(BusProvider, {
        appId: 'shell',
        dispatch: 'sync',
        validators: { 'orders:filters-changed': OrdersFiltersEventSchema },
        children: createElement(Probe, { label: 'first' }),
      }),
    );

    ui.rerender(
      createElement(BusProvider, {
        appId: 'shell',
        dispatch: 'sync',
        validators: { 'orders:filters-changed': OrdersFiltersEventSchema },
        children: createElement(Probe, { label: 'second' }),
      }),
    );

    act(() => {
      bus?.publish<EventMessage<{ filter: string }>>({
        messageName: 'orders:filters-changed',
        messageVersion: 1,
        messageId: crypto.randomUUID(),
        correlationId: crypto.randomUUID(),
        source: 'x',
        occurredAtUtc: new Date().toISOString(),
        kind: 'event',
        eventKind: 'orders.filters-changed',
        sensitivity: 'public',
        payload: { filter: 'open' },
      });
    });

    expect(received).toEqual(['second']);
    ui.unmount();
  });

  it('Vue useSubscribe cleans up on unmount', () => {
    const count = ref(0);
    const busRef: { current: Bus | null } = { current: null };

    const Root = defineComponent({
      setup() {
        busRef.current = useVueBus();
        useVueSubscribe('orders:filters-changed', () => {
          count.value += 1;
        });
        return {};
      },
      template: '<span />',
    });

    const el = document.createElement('div');
    const app = createApp(Root);
    app.use(
      createBusPlugin({
        appId: 'shell',
        dispatch: 'sync',
        validators: {
          'orders:filters-changed': OrdersFiltersEventSchema,
        },
      }),
    );
    app.mount(el);

    if (busRef.current === null) {
      throw new Error('expected bus');
    }
    busRef.current.publish<EventMessage<{ filter: string }>>({
      messageName: 'orders:filters-changed',
      messageVersion: 1,
      messageId: crypto.randomUUID(),
      correlationId: crypto.randomUUID(),
      source: 'x',
      occurredAtUtc: new Date().toISOString(),
      kind: 'event',
      eventKind: 'orders.filters-changed',
      sensitivity: 'public',
      payload: { filter: 'open' },
    });
    expect(count.value).toBe(1);

    app.unmount();

    if (busRef.current === null) {
      throw new Error('expected bus');
    }
    busRef.current.publish<EventMessage<{ filter: string }>>({
      messageName: 'orders:filters-changed',
      messageVersion: 1,
      messageId: crypto.randomUUID(),
      correlationId: crypto.randomUUID(),
      source: 'x',
      occurredAtUtc: new Date().toISOString(),
      kind: 'event',
      eventKind: 'orders.filters-changed',
      sensitivity: 'public',
      payload: { filter: 'open' },
    });
    expect(count.value).toBe(1);
  });

  it('two subscribers on one bus can model remote targeting', () => {
    const bus = createBus({
      appId: 'shell',
      dispatch: 'sync',
      validators: {
        'orders:filters-changed': OrdersFiltersEventSchema,
      },
    });
    let a = 0;
    let b = 0;
    bus.subscribe(
      'orders:filters-changed',
      () => {
        a += 1;
      },
      { subscriberId: 'remote-a' },
    );
    bus.subscribe(
      'orders:filters-changed',
      () => {
        b += 1;
      },
      { subscriberId: 'remote-b' },
    );
    bus.publish<EventMessage<{ filter: string }>>({
      messageName: 'orders:filters-changed',
      messageVersion: 1,
      messageId: crypto.randomUUID(),
      correlationId: crypto.randomUUID(),
      source: 'remote-a',
      target: 'remote-b',
      occurredAtUtc: new Date().toISOString(),
      kind: 'event',
      eventKind: 'orders.filters-changed',
      sensitivity: 'public',
      payload: { filter: 'open' },
    });
    expect(a).toBe(0);
    expect(b).toBe(1);
    bus.dispose();
  });

  it('Angular provideBus and provideHostBridge wire host services', () => {
    const injector = createTestEnvironmentInjector([
      provideBus({
        appId: 'shell',
        dispatch: 'sync',
        validators: {
          'orders:filters-changed': OrdersFiltersEventSchema,
        },
      }),
      provideHostBridge({ remotes: ['remote-orders'] }),
      BusService,
      HostBridgeService,
    ]);
    const busSvc = injector.get(BusService);
    const bridgeSvc = injector.get(HostBridgeService);
    expect(window.__MFE_BRIDGE__).toBeDefined();
    expect(bridgeSvc.getBus()).toBe(injector.get(BUS_TOKEN));
    let count = 0;
    busSvc.messages$('orders:filters-changed').subscribe(() => {
      count += 1;
    });
    busSvc.publish<EventMessage<{ filter: string }>>({
      messageName: 'orders:filters-changed',
      messageVersion: 1,
      messageId: crypto.randomUUID(),
      correlationId: crypto.randomUUID(),
      source: 'shell',
      occurredAtUtc: new Date().toISOString(),
      kind: 'event',
      eventKind: 'orders.filters-changed',
      sensitivity: 'public',
      payload: { filter: 'open' },
    });
    expect(count).toBe(1);
    injector.destroy();
  });

  it('Angular BusService.request resolves with matching response', async () => {
    const injector = createTestEnvironmentInjector([
      provideBus({
        appId: 'shell',
        dispatch: 'microtask',
        validators: {
          'orders:filters-changed': OrdersFiltersEventSchema,
        },
      }),
      BusService,
    ]);
    const busSvc = injector.get(BusService);
    const requestId = crypto.randomUUID();
    const responsePromise = busSvc.request(
      {
        messageName: 'orders:filters-changed',
        messageVersion: 1,
        messageId: requestId,
        correlationId: crypto.randomUUID(),
        source: 'shell',
        occurredAtUtc: new Date().toISOString(),
        kind: 'event',
        eventKind: 'orders.filters-changed',
        sensitivity: 'public',
        payload: { filter: 'pending' },
      },
      500,
      OrdersFiltersEventSchema,
    );
    busSvc.publish<EventMessage<{ filter: string }>>({
      messageName: 'orders:filters-changed',
      messageVersion: 1,
      messageId: crypto.randomUUID(),
      correlationId: crypto.randomUUID(),
      causationId: requestId,
      source: 'shell',
      occurredAtUtc: new Date().toISOString(),
      kind: 'event',
      eventKind: 'orders.filters-changed',
      sensitivity: 'public',
      payload: { filter: 'done' },
    });
    await Promise.resolve();
    const response = await responsePromise;
    expect(response.payload.filter).toBe('done');
    injector.destroy();
  });

  it('Angular provideBus disposes bus when injector is destroyed', () => {
    const injector = createTestEnvironmentInjector([
      provideBus({
          appId: 'shell',
          dispatch: 'sync',
          validators: {
            'orders:filters-changed': OrdersFiltersEventSchema,
          },
        }),
    ]);
    const bus = injector.get(BUS_TOKEN);
    let count = 0;
    bus.subscribe('orders:filters-changed', () => {
      count += 1;
    });
    injector.destroy();
    bus.publish<EventMessage<{ filter: string }>>({
      messageName: 'orders:filters-changed',
      messageVersion: 1,
      messageId: crypto.randomUUID(),
      correlationId: crypto.randomUUID(),
      source: 'shell',
      occurredAtUtc: new Date().toISOString(),
      kind: 'event',
      eventKind: 'orders.filters-changed',
      sensitivity: 'public',
      payload: { filter: 'open' },
    });
    expect(count).toBe(0);
  });

  it('Angular provideRemotePlatformBus reads bus from window bridge', () => {
    const hostBus = createBus({
      appId: 'shell',
      dispatch: 'sync',
      validators: {
        'orders:filters-changed': OrdersFiltersEventSchema,
      },
    });
    const bridge = createHostBridge({
      appId: 'shell',
      bus: hostBus,
      remotes: ['remote-orders'],
    });
    const injector = createTestEnvironmentInjector([provideRemotePlatformBus()]);
    expect(injector.get(BUS_TOKEN)).toBe(hostBus);
    injector.destroy();
    bridge.dispose();
    hostBus.dispose();
  });

  it('Angular BusService observeAll$ forwards all messages', () => {
    const injector = LegacyInjector.create({
      providers: [
        {
          provide: BUS_TOKEN,
          useFactory: () =>
            createBus({
              appId: 'shell',
              dispatch: 'sync',
              validators: {
                'orders:filters-changed': OrdersFiltersEventSchema,
              },
            }),
        },
        BusService,
      ],
    });
    const busSvc = injector.get(BusService);
    const names: string[] = [];
    const sub = busSvc.observeAll$().subscribe((m) => {
      names.push(m.messageName);
    });
    busSvc.publish<EventMessage<{ filter: string }>>({
      messageName: 'orders:filters-changed',
      messageVersion: 1,
      messageId: crypto.randomUUID(),
      correlationId: crypto.randomUUID(),
      source: 'shell',
      occurredAtUtc: new Date().toISOString(),
      kind: 'event',
      eventKind: 'orders.filters-changed',
      sensitivity: 'public',
      payload: { filter: 'open' },
    });
    expect(names).toEqual(['orders:filters-changed']);
    sub.unsubscribe();
    injector.get(BUS_TOKEN).dispose();
  });

  it('React usePublish publishes through bus context', () => {
    let count = 0;
    const publishRef: {
      current: (<M extends MessageBase>(message: M) => void) | null;
    } = { current: null };

    function Probe() {
      publishRef.current = usePublish();
      useSubscribe('orders:filters-changed', () => {
        count += 1;
      });
      return null;
    }

    const ui = render(
      createElement(BusProvider, {
        appId: 'shell',
        dispatch: 'sync',
        validators: { 'orders:filters-changed': OrdersFiltersEventSchema },
        children: createElement(Probe),
      }),
    );

    act(() => {
      if (publishRef.current === null) {
        throw new Error('expected publish');
      }
      publishRef.current<EventMessage<{ filter: string }>>({
        messageName: 'orders:filters-changed',
        messageVersion: 1,
        messageId: crypto.randomUUID(),
        correlationId: crypto.randomUUID(),
        source: 'x',
        occurredAtUtc: new Date().toISOString(),
        kind: 'event',
        eventKind: 'orders.filters-changed',
        sensitivity: 'public',
        payload: { filter: 'open' },
      });
    });
    expect(count).toBe(1);
    ui.unmount();
  });

  it('Angular provideRemotePlatformBus forwards the access token to the bridge', () => {
    const token = generateAccessToken();
    const hostBus = createBus({
      appId: 'shell',
      dispatch: 'sync',
      validators: {
        'orders:filters-changed': OrdersFiltersEventSchema,
      },
    });
    const bridge = createHostBridge({
      appId: 'shell',
      bus: hostBus,
      remotes: ['remote-orders'],
      accessToken: token,
    });
    const injector = createTestEnvironmentInjector([provideRemotePlatformBus({ accessToken: token })]);
    expect(injector.get(BUS_TOKEN)).toBe(hostBus);
    injector.destroy();
    bridge.dispose();
    hostBus.dispose();
  });

  it('Angular BusService.sendCommand resolves an Ack on acknowledgment', async () => {
    const injector = LegacyInjector.create({
      providers: [
        {
          provide: BUS_TOKEN,
          useFactory: () =>
            createBus({
              appId: 'shell',
              dispatch: 'sync',
              validators: {
                'orders:refresh': CommandMessageSchema,
                'orders:refresh:ack': OrdersFiltersEventSchema,
              },
            }),
        },
        BusService,
      ],
    });
    const busSvc = injector.get(BusService);
    const bus = injector.get(BUS_TOKEN);
    bus.subscribe('orders:refresh', (m) => {
      bus.publish<EventMessage<{ filter: string }>>({
        messageName: 'orders:refresh:ack',
        messageVersion: 1,
        messageId: crypto.randomUUID(),
        correlationId: m.correlationId,
        causationId: m.messageId,
        source: 'remote-orders',
        occurredAtUtc: new Date().toISOString(),
        kind: 'event',
        eventKind: 'orders.refresh.ack',
        sensitivity: 'public',
        payload: { filter: 'ok' },
      });
    });
    const command: CommandMessage<{ force: boolean }> = {
      messageName: 'orders:refresh',
      messageVersion: 1,
      messageId: crypto.randomUUID(),
      correlationId: crypto.randomUUID(),
      source: 'shell',
      occurredAtUtc: new Date().toISOString(),
      kind: 'command',
      commandName: 'orders.refresh',
      sensitivity: 'internal',
      payload: { force: true },
      ackTimeoutMs: 1000,
    };
    const ack = await busSvc.sendCommand(command);
    expect(ack.accepted).toBe(true);
    bus.dispose();
  });

  it('Vue createHostBridgePlugin exposes bridge on window', () => {
    const Root = defineComponent({
      setup() {
        useVueSubscribe('orders:filters-changed', () => undefined);
        return {};
      },
      template: '<span />',
    });
    const el = document.createElement('motion');
    const app = createApp(Root);
    app.use(
      createBusPlugin({
        appId: 'shell',
        dispatch: 'sync',
        validators: {
          'orders:filters-changed': OrdersFiltersEventSchema,
        },
      }),
    );
    app.use(createHostBridgePlugin({ remotes: ['remote-orders'] }));
    app.mount(el);
    expect(window.__MFE_BRIDGE__?.remotes).toEqual(['remote-orders']);
    app.unmount();
  });
});
