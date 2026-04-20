import type { App } from 'vue';
import type { Bus } from '../core/bus.js';

const busByApp = new WeakMap<App, Bus>();

export function rememberBusForApp(app: App, bus: Bus): void {
  busByApp.set(app, bus);
}

export function getBusForApp(app: App): Bus | undefined {
  return busByApp.get(app);
}
