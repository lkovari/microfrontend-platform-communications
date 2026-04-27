export type DispatchMode = 'sync' | 'microtask';

export interface MessageQueue {
  enqueue(task: () => void): void;
}

export function createMessageQueue(mode: DispatchMode): MessageQueue {
  const pending: (() => void)[] = [];
  let flushScheduled = false;
  let flushing = false;

  function runFlush(): void {
    if (flushing) {
      return;
    }
    flushing = true;
    flushScheduled = false;
    while (pending.length > 0) {
      const next = pending.shift();
      if (next) {
        next();
      }
    }
    flushing = false;
  }

  return {
    enqueue(task: () => void): void {
      pending.push(task);
      if (flushing) {
        return;
      }
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
