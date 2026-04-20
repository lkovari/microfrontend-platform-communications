export type DispatchMode = 'sync' | 'microtask';

export interface MessageQueue {
  enqueue(task: () => void): void;
}

export function createMessageQueue(mode: DispatchMode): MessageQueue {
  const pending: (() => void)[] = [];
  let flushScheduled = false;

  function runFlush(): void {
    flushScheduled = false;
    while (pending.length > 0) {
      const next = pending.shift();
      if (next) {
        next();
      }
    }
  }

  return {
    enqueue(task: () => void): void {
      pending.push(task);
      if (flushScheduled) {
        return;
      }
      flushScheduled = true;
      if (mode === 'microtask') {
        queueMicrotask(runFlush);
      } else {
        runFlush();
      }
    },
  };
}
