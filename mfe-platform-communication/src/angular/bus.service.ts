import { Injectable, inject } from '@angular/core';
import type { ZodType } from 'zod';
import type { MessageBase } from '../contracts/message-base.js';
import type { Bus, BusSubscribeOptions, Unsubscribe } from '../core/bus.js';
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

  request<TReq extends MessageBase>(message: TReq, timeoutMs?: number): Promise<MessageBase>;
  request<TReq extends MessageBase, TRes extends MessageBase>(
    message: TReq,
    timeoutMs: number | undefined,
    responseValidator: ZodType<TRes>,
  ): Promise<TRes>;
  request<TReq extends MessageBase, TRes extends MessageBase>(
    message: TReq,
    timeoutMs?: number,
    responseValidator?: ZodType<TRes>,
  ): Promise<MessageBase | TRes> {
    if (responseValidator) {
      return this.requiredBus.request(message, timeoutMs, responseValidator);
    }
    return this.requiredBus.request(message, timeoutMs);
  }

  messages$(messageName: string, subscribeOptions?: BusSubscribeOptions): Observable<MessageBase> {
    return new Observable<MessageBase>((subscriber) => {
      const off = this.requiredBus.subscribe(
        messageName,
        (message) => {
          subscriber.next(message);
        },
        subscribeOptions,
      );
      return () => {
        off();
      };
    });
  }

  observeAll$(): Observable<MessageBase> {
    return new Observable<MessageBase>((subscriber) => {
      const off = this.requiredBus.observeAll((message) => {
        subscriber.next(message);
      });
      return () => {
        off();
      };
    });
  }

  registerBeforeDeliver(handler: (message: MessageBase) => void): Unsubscribe {
    return this.requiredBus.registerBeforeDeliver(handler);
  }

  dispose(): void {
    this.requiredBus.dispose();
  }
}
