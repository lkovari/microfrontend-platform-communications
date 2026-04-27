import { Injectable, inject } from '@angular/core';
import type { ZodTypeAny } from 'zod';
import type { MessageBase } from '../contracts/message-base.js';
import type { Bus, BusSubscribeOptions } from '../core/bus.js';
import { Observable } from 'rxjs';
import { BUS_TOKEN } from './provide-bus.js';

@Injectable({ providedIn: 'root' })
export class BusService {
  private readonly bus = inject(BUS_TOKEN, { optional: true });

  private get requiredBus(): Bus {
    if (this.bus === null) {
      throw new Error(
        'BusService requires BUS_TOKEN. Call provideBus() in your application providers before injecting BusService.',
      );
    }
    return this.bus;
  }

  publish<M extends MessageBase>(message: M): void {
    this.requiredBus.publish(message);
  }

  request<TReq extends MessageBase, TRes extends MessageBase>(
    message: TReq,
    timeoutMs?: number,
    responseValidator?: ZodTypeAny,
  ): Promise<TRes> {
    return this.requiredBus.request(message, timeoutMs, responseValidator);
  }

  messages$<M extends MessageBase>(
    messageName: string,
    subscribeOptions?: BusSubscribeOptions,
  ): Observable<M> {
    return new Observable<M>((subscriber) => {
      const off = this.requiredBus.subscribe<M>(
        messageName,
        (m) => {
          subscriber.next(m);
        },
        subscribeOptions,
      );
      return () => {
        off();
      };
    });
  }
}
