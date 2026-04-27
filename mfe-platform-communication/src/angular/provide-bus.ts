import { inject, InjectionToken, makeEnvironmentProviders, type EnvironmentProviders } from '@angular/core';
import type { Bus } from '../core/bus.js';
import { createBus, type CreateBusOptions } from '../core/bus.js';

export const BUS_TOKEN = new InjectionToken<Bus>('@lkovari/microfrontend-platform-communication/bus');

export function provideBus(options: CreateBusOptions): EnvironmentProviders {
  return makeEnvironmentProviders([
    {
      provide: BUS_TOKEN,
      useFactory: () => createBus(options),
    },
  ]);
}

export function injectBus(): Bus {
  return inject(BUS_TOKEN);
}
