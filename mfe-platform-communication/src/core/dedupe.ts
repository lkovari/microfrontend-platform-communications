export interface DedupeGate {
  shouldDrop(messageId: string, nowMs: number): boolean;
}

export function createDedupeGate(windowMs: number): DedupeGate {
  const seen = new Map<string, number>();

  function prune(nowMs: number): void {
    for (const [id, t] of seen) {
      if (nowMs - t > windowMs) {
        seen.delete(id);
      }
    }
  }

  return {
    shouldDrop(messageId: string, nowMs: number): boolean {
      prune(nowMs);
      if (seen.has(messageId)) {
        return true;
      }
      seen.set(messageId, nowMs);
      return false;
    },
  };
}
