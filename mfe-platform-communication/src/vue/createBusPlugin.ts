import type { App, InjectionKey } from 'vue';
import type { Bus } from '../core/bus.js';
import { createBus, type CreateBusOptions } from '../core/bus.js';
import { rememberBusForApp } from './internal-app-bus.js';

export const BusKey: InjectionKey<Bus> = Symbol('@lkovari/microfrontend-platform-communication/bus');

export function createBusPlugin(options: CreateBusOptions) {
  return {
    install(app: App) {
      const bus = createBus(options);
      app.provide(BusKey, bus);
      rememberBusForApp(app, bus);
    },
  };
}
