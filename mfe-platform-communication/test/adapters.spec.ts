import '@angular/compiler';
import { afterEach, describe, expect, it } from 'vitest';
import { Injector } from '@angular/core';
import { createElement } from 'react';
import { render, cleanup, act } from '@testing-library/react';
import { createApp, defineComponent, ref } from 'vue';
import { createBus } from '../src/core/bus.js';
import type { Bus } from '../src/core/bus.js';
import { BUS_TOKEN, BusService, HostBridgeService } from '../src/angular/index.js';
import { BusProvider, HostBridgeProvider, useBus, useSubscribe } from '../src/react/index.js';
import { createBusPlugin, useBus as useVueBus, useSubscribe as useVueSubscribe } from '../src/vue/index.js';
import type { EventMessage } from '../src/contracts/event-message.js';
import type { MessageBase } from '../src/contracts/message-base.js';
import { OrdersFiltersEventSchema } from './helpers.js';

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
      .messages$<EventMessage<{ filter: string }>>('orders:filters-changed')
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
      busSvc.request<EventMessage<{ filter: string }>, EventMessage<{ filter: string }>>({
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
    busSvc.messages$<EventMessage<{ filter: string }>>('orders:filters-changed').subscribe({
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
      useSubscribe<EventMessage<{ filter: string }>>('orders:filters-changed', () => {
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
      useSubscribe<EventMessage<{ filter: string }>>('orders:filters-changed', () => {
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
        useVueSubscribe<EventMessage<{ filter: string }>>('orders:filters-changed', () => {
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
    bus.subscribe<EventMessage<{ filter: string }>>(
      'orders:filters-changed',
      () => {
        a += 1;
      },
      { subscriberId: 'remote-a' },
    );
    bus.subscribe<EventMessage<{ filter: string }>>(
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
});
