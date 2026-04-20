import { Injectable, inject } from '@angular/core';
import type { MessageBase } from '../contracts/message-base.js';
import type { Bus, BusSubscribeOptions } from '../core/bus.js';
import { Observable } from 'rxjs';
import { BUS_TOKEN } from './provide-bus.js';

@Injectable({ providedIn: 'root' })
export class BusService {
  private readonly bus: Bus = inject(BUS_TOKEN);

  publish<M extends MessageBase>(message: M): void {
    this.bus.publish(message);
  }

  request<TReq extends MessageBase, TRes extends MessageBase>(
    message: TReq,
    timeoutMs?: number,
  ): Promise<TRes> {
    return this.bus.request(message, timeoutMs);
  }

  messages$<M extends MessageBase>(
    messageName: string,
    subscribeOptions?: BusSubscribeOptions,
  ): Observable<M> {
    return new Observable<M>((subscriber) => {
      const off = this.bus.subscribe<M>(
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
